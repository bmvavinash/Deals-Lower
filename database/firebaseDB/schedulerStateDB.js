/**
 * Database-based State Management for Scheduler
 * Stores scheduler state in Firebase for persistence across restarts
 * Perfect for Telegram bot that needs to maintain state
 */

const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('schedulerStateDB');

// Initialize Firebase Admin if not already initialized
const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
if (!admin.apps.some(app => app.name === '[DEFAULT]')) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  if (!serviceAccount) {
    try {
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    } catch (e) {
      console.error(`Firebase credentials file not found at ${constants.pathToFile}/${filePath}.json and no FIREBASE_SERVICE_ACCOUNT_JSON env variable provided.`);
      throw e;
    }
  }
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

// State collection paths
const STATE_COLLECTION = 'schedulerState';
const PREVIOUS_STATE_COLLECTION = 'schedulerPreviousState';

// Default state structure
const DEFAULT_STATE = {
  lastUpdated: null,
  schedulerDuration: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  lastBulkRun: null,
  lastHealthCheck: null,
  totalRuns: 0,
  totalProductsProcessed: 0,
  lastError: null,
  platformStates: {},
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true
};

// Default previous state structure
const DEFAULT_PREVIOUS_STATE = {
  lastUpdatedScheduler: null,
  schedulerTriggerDuration: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  previousBulkRun: null,
  previousTotalRuns: 0,
  previousProductsProcessed: 0,
  previousError: null,
  previousPlatformStates: {},
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Get state reference
 * @returns {Object} Firebase reference to state
 */
function getStateRef() {
  return db.ref(`${STATE_COLLECTION}/main`);
}

/**
 * Get previous state reference
 * @returns {Object} Firebase reference to previous state
 */
function getPreviousStateRef() {
  return db.ref(`${PREVIOUS_STATE_COLLECTION}/main`);
}

/**
 * Load state from database
 * @returns {Promise<Object>} Current state or default state
 */
async function loadState() {
  try {
    console.log('[schedulerStateDB] loadState called');
    const stateRef = getStateRef();
    console.log('[schedulerStateDB] calling once(value) on stateRef');
    const snapshot = await stateRef.once('value');
    console.log('[schedulerStateDB] once(value) returned');
    
    if (snapshot.exists()) {
      const state = snapshot.val();
      
      // Merge with default state to ensure all fields exist
      const mergedState = { ...DEFAULT_STATE, ...state };
      mergedState.updatedAt = new Date().toISOString();
      
      logger.info('State loaded from database', { 
        lastUpdated: mergedState.lastUpdated,
        schedulerDuration: mergedState.schedulerDuration,
        totalRuns: mergedState.totalRuns,
        isActive: mergedState.isActive
      });
      
      return mergedState;
    } else {
      logger.info('No state found in database, using default state');
      // Save default state to database
      await saveState(DEFAULT_STATE);
      return { ...DEFAULT_STATE };
    }
  } catch (error) {
    logger.error('Failed to load state from database, using default', { error: error.message });
    return { ...DEFAULT_STATE };
  }
}

/**
 * Save state to database
 * @param {Object} state - State object to save
 * @returns {Promise<boolean>} Success status
 */
async function saveState(state) {
  try {
    // Ensure updatedAt is current
    state.updatedAt = new Date().toISOString();
    
    const stateRef = getStateRef();
    await stateRef.set(state);
    
    logger.debug('State saved to database', { 
      lastUpdated: state.lastUpdated,
      totalRuns: state.totalRuns,
      schedulerDuration: state.schedulerDuration
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to save state to database', { error: error.message });
    return false;
  }
}

/**
 * Update last updated time
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<boolean>} Success status
 */
async function updateLastUpdated(platform = null) {
  try {
    const state = await loadState();
    state.lastUpdated = new Date().toISOString();
    
    if (platform) {
      if (!state.platformStates[platform]) {
        state.platformStates[platform] = {};
      }
      state.platformStates[platform].lastUpdated = state.lastUpdated;
    }
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update last updated time', { error: error.message });
    return false;
  }
}

/**
 * Update scheduler duration
 * @param {number} durationMs - Duration in milliseconds
 * @returns {Promise<boolean>} Success status
 */
async function updateSchedulerDuration(durationMs) {
  try {
    const state = await loadState();
    const oldDuration = state.schedulerDuration;
    state.schedulerDuration = durationMs;
    
    logger.info('Scheduler duration updated in database', { 
      oldDuration,
      newDuration: durationMs,
      oldDurationHours: oldDuration / (60 * 60 * 1000),
      newDurationHours: durationMs / (60 * 60 * 1000)
    });
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update scheduler duration', { error: error.message });
    return false;
  }
}

/**
 * Update last bulk run time
 * @returns {Promise<boolean>} Success status
 */
async function updateLastBulkRun() {
  try {
    const state = await loadState();
    state.lastBulkRun = new Date().toISOString();
    state.totalRuns++;
    
    logger.info('Last bulk run updated', {
      totalRuns: state.totalRuns,
      lastBulkRun: state.lastBulkRun
    });
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update last bulk run', { error: error.message });
    return false;
  }
}

/**
 * Update platform-specific state
 * @param {string} platform - Platform name
 * @param {Object} platformData - Platform-specific data
 * @returns {Promise<boolean>} Success status
 */
async function updatePlatformState(platform, platformData) {
  try {
    const state = await loadState();
    
    if (!state.platformStates[platform]) {
      state.platformStates[platform] = {};
    }
    
    state.platformStates[platform] = {
      ...state.platformStates[platform],
      ...platformData,
      lastUpdated: new Date().toISOString()
    };
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update platform state', { error: error.message, platform });
    return false;
  }
}

/**
 * Get time since last update
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<number>} Milliseconds since last update
 */
async function getTimeSinceLastUpdate(platform = null) {
  try {
    const state = await loadState();
    
    let lastUpdateTime = null;
    
    if (platform && state.platformStates[platform]) {
      lastUpdateTime = state.platformStates[platform].lastUpdated;
    } else {
      lastUpdateTime = state.lastUpdated;
    }
    
    if (!lastUpdateTime) {
      return Infinity; // Never updated
    }
    
    return Date.now() - new Date(lastUpdateTime).getTime();
  } catch (error) {
    logger.error('Failed to get time since last update', { error: error.message });
    return Infinity;
  }
}

/**
 * Check if it's time for next update
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<boolean>} Whether it's time for update
 */
async function isTimeForUpdate(platform = null) {
  try {
    const timeSinceLastUpdate = await getTimeSinceLastUpdate(platform);
    const state = await loadState();
    
    return timeSinceLastUpdate >= state.schedulerDuration;
  } catch (error) {
    logger.error('Failed to check if time for update', { error: error.message });
    return true; // Default to true if error
  }
}

/**
 * Get next update time
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<Date>} Next update time
 */
async function getNextUpdateTime(platform = null) {
  try {
    const state = await loadState();
    
    let lastUpdateTime = null;
    
    if (platform && state.platformStates[platform]) {
      lastUpdateTime = state.platformStates[platform].lastUpdated;
    } else {
      lastUpdateTime = state.lastUpdated;
    }
    
    if (!lastUpdateTime) {
      return new Date(); // Update now if never updated
    }
    
    return new Date(new Date(lastUpdateTime).getTime() + state.schedulerDuration);
  } catch (error) {
    logger.error('Failed to get next update time', { error: error.message });
    return new Date();
  }
}

/**
 * Update error information
 * @param {Error} error - Error object
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<boolean>} Success status
 */
async function updateError(error, platform = null) {
  try {
    const state = await loadState();
    
    state.lastError = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      platform: platform
    };
    
    if (platform && state.platformStates[platform]) {
      state.platformStates[platform].lastError = state.lastError;
    }
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update error', { error: error.message });
    return false;
  }
}

/**
 * Clear error information
 * @returns {Promise<boolean>} Success status
 */
async function clearError() {
  try {
    const state = await loadState();
    state.lastError = null;
    
    // Clear platform-specific errors too
    Object.keys(state.platformStates).forEach(platform => {
      if (state.platformStates[platform].lastError) {
        state.platformStates[platform].lastError = null;
      }
    });
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to clear error', { error: error.message });
    return false;
  }
}

/**
 * Get state summary for logging
 * @returns {Promise<Object>} State summary
 */
async function getStateSummary() {
  try {
    const state = await loadState();
    const nextUpdateTime = await getNextUpdateTime();
    const timeSinceLastUpdate = await getTimeSinceLastUpdate();
    
    return {
      lastUpdated: state.lastUpdated,
      schedulerDuration: state.schedulerDuration,
      lastBulkRun: state.lastBulkRun,
      totalRuns: state.totalRuns,
      totalProductsProcessed: state.totalProductsProcessed,
      hasError: !!state.lastError,
      platformCount: Object.keys(state.platformStates).length,
      nextUpdateTime: nextUpdateTime.toISOString(),
      timeSinceLastUpdate,
      isActive: state.isActive
    };
  } catch (error) {
    logger.error('Failed to get state summary', { error: error.message });
    return {};
  }
}

/**
 * Set active status
 * @param {boolean} isActive - Whether scheduler is active
 * @returns {Promise<boolean>} Success status
 */
async function setActiveStatus(isActive) {
  try {
    const state = await loadState();
    state.isActive = isActive;
    
    logger.info('Scheduler active status updated', { isActive });
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to set active status', { error: error.message });
    return false;
  }
}

/**
 * Reset state (use with caution)
 * @returns {Promise<boolean>} Success status
 */
async function resetState() {
  try {
    const resetState = { ...DEFAULT_STATE };
    resetState.createdAt = new Date().toISOString();
    
    const oldState = await loadState();
    logger.warn('State reset requested', { 
      previousTotalRuns: oldState.totalRuns 
    });
    
    return await saveState(resetState);
  } catch (error) {
    logger.error('Failed to reset state', { error: error.message });
    return false;
  }
}

/**
 * Update products processed count
 * @param {number} count - Number of products processed
 * @returns {Promise<boolean>} Success status
 */
async function updateProductsProcessed(count) {
  try {
    const state = await loadState();
    state.totalProductsProcessed += count;
    
    return await saveState(state);
  } catch (error) {
    logger.error('Failed to update products processed count', { error: error.message });
    return false;
  }
}

/**
 * Load previous state from database
 * @returns {Promise<Object>} Previous state or default previous state
 */
async function loadPreviousState() {
  try {
    const previousStateRef = getPreviousStateRef();
    const snapshot = await previousStateRef.once('value');
    
    if (snapshot.exists()) {
      const previousState = snapshot.val();
      
      // Merge with default previous state to ensure all fields exist
      const mergedState = { ...DEFAULT_PREVIOUS_STATE, ...previousState };
      mergedState.updatedAt = new Date().toISOString();
      
      logger.info('Previous state loaded from database', { 
        lastUpdatedScheduler: mergedState.lastUpdatedScheduler,
        schedulerTriggerDuration: mergedState.schedulerTriggerDuration,
        previousTotalRuns: mergedState.previousTotalRuns
      });
      
      return mergedState;
    } else {
      logger.info('No previous state found in database, using default previous state');
      // Save default previous state to database
      await savePreviousState(DEFAULT_PREVIOUS_STATE);
      return { ...DEFAULT_PREVIOUS_STATE };
    }
  } catch (error) {
    logger.error('Failed to load previous state from database, using default', { error: error.message });
    return { ...DEFAULT_PREVIOUS_STATE };
  }
}

/**
 * Save previous state to database
 * @param {Object} previousState - Previous state object to save
 * @returns {Promise<boolean>} Success status
 */
async function savePreviousState(previousState) {
  try {
    // Ensure updatedAt is current
    previousState.updatedAt = new Date().toISOString();
    
    const previousStateRef = getPreviousStateRef();
    await previousStateRef.set(previousState);
    
    logger.debug('Previous state saved to database', { 
      lastUpdatedScheduler: previousState.lastUpdatedScheduler,
      schedulerTriggerDuration: previousState.schedulerTriggerDuration,
      previousTotalRuns: previousState.previousTotalRuns
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to save previous state to database', { error: error.message });
    return false;
  }
}

/**
 * Update last updated scheduler time
 * @param {string} platform - Platform name (optional)
 * @returns {Promise<boolean>} Success status
 */
async function updateLastUpdatedScheduler(platform = null) {
  try {
    const previousState = await loadPreviousState();
    previousState.lastUpdatedScheduler = new Date().toISOString();
    
    if (platform) {
      if (!previousState.previousPlatformStates[platform]) {
        previousState.previousPlatformStates[platform] = {};
      }
      previousState.previousPlatformStates[platform].lastUpdatedScheduler = previousState.lastUpdatedScheduler;
    }
    
    return await savePreviousState(previousState);
  } catch (error) {
    logger.error('Failed to update last updated scheduler time', { error: error.message });
    return false;
  }
}

/**
 * Update scheduler trigger duration
 * @param {number} durationMs - Duration in milliseconds
 * @returns {Promise<boolean>} Success status
 */
async function updateSchedulerTriggerDuration(durationMs) {
  try {
    const previousState = await loadPreviousState();
    const oldDuration = previousState.schedulerTriggerDuration;
    previousState.schedulerTriggerDuration = durationMs;
    
    logger.info('Scheduler trigger duration updated in previous state', { 
      oldDuration,
      newDuration: durationMs,
      oldDurationHours: oldDuration / (60 * 60 * 1000),
      newDurationHours: durationMs / (60 * 60 * 1000)
    });
    
    return await savePreviousState(previousState);
  } catch (error) {
    logger.error('Failed to update scheduler trigger duration in previous state', { error: error.message });
    return false;
  }
}

/**
 * Backup current state to previous state before making changes
 * @returns {Promise<boolean>} Success status
 */
async function backupCurrentStateToPrevious() {
  try {
    const currentState = await loadState();
    const previousState = {
      lastUpdatedScheduler: currentState.lastUpdated,
      schedulerTriggerDuration: currentState.schedulerDuration,
      previousBulkRun: currentState.lastBulkRun,
      previousTotalRuns: currentState.totalRuns,
      previousProductsProcessed: currentState.totalProductsProcessed,
      previousError: currentState.lastError,
      previousPlatformStates: currentState.platformStates,
      version: currentState.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    logger.info('Current state backed up to previous state', {
      lastUpdatedScheduler: previousState.lastUpdatedScheduler,
      schedulerTriggerDuration: previousState.schedulerTriggerDuration,
      previousTotalRuns: previousState.previousTotalRuns
    });
    
    return await savePreviousState(previousState);
  } catch (error) {
    logger.error('Failed to backup current state to previous state', { error: error.message });
    return false;
  }
}

/**
 * Get previous state summary for logging
 * @returns {Promise<Object>} Previous state summary
 */
async function getPreviousStateSummary() {
  try {
    const previousState = await loadPreviousState();
    
    return {
      lastUpdatedScheduler: previousState.lastUpdatedScheduler,
      schedulerTriggerDuration: previousState.schedulerTriggerDuration,
      previousBulkRun: previousState.previousBulkRun,
      previousTotalRuns: previousState.previousTotalRuns,
      previousProductsProcessed: previousState.previousProductsProcessed,
      hasPreviousError: !!previousState.previousError,
      platformCount: Object.keys(previousState.previousPlatformStates).length,
      updatedAt: previousState.updatedAt
    };
  } catch (error) {
    logger.error('Failed to get previous state summary', { error: error.message });
    return {};
  }
}

/**
 * Reset previous state (use with caution)
 * @returns {Promise<boolean>} Success status
 */
async function resetPreviousState() {
  try {
    const resetState = { ...DEFAULT_PREVIOUS_STATE };
    resetState.createdAt = new Date().toISOString();
    
    const oldState = await loadPreviousState();
    logger.warn('Previous state reset requested', { 
      previousTotalRuns: oldState.previousTotalRuns 
    });
    
    return await savePreviousState(resetState);
  } catch (error) {
    logger.error('Failed to reset previous state', { error: error.message });
    return false;
  }
}

module.exports = {
  loadState,
  saveState,
  updateLastUpdated,
  updateSchedulerDuration,
  updateLastBulkRun,
  updatePlatformState,
  getTimeSinceLastUpdate,
  isTimeForUpdate,
  getNextUpdateTime,
  updateError,
  clearError,
  getStateSummary,
  setActiveStatus,
  resetState,
  updateProductsProcessed,
  // Previous state functions
  loadPreviousState,
  savePreviousState,
  updateLastUpdatedScheduler,
  updateSchedulerTriggerDuration,
  backupCurrentStateToPrevious,
  getPreviousStateSummary,
  resetPreviousState,
  // Collection names
  STATE_COLLECTION,
  PREVIOUS_STATE_COLLECTION
};

