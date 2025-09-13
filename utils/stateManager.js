/**
 * Persistent State Manager for Scheduler
 * Stores last updated time, scheduler duration, and other state information
 * to enable efficient resume after restarts
 */

const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stateManager');

// Default state file path
const STATE_FILE_PATH = path.join(__dirname, '..', 'config', 'schedulerState.json');

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
  updatedAt: new Date().toISOString()
};

/**
 * Load state from file
 * @returns {Object} Current state or default state if file doesn't exist
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      const state = JSON.parse(data);
      
      // Merge with default state to ensure all fields exist
      const mergedState = { ...DEFAULT_STATE, ...state };
      mergedState.updatedAt = new Date().toISOString();
      
      logger.info('State loaded successfully', { 
        lastUpdated: mergedState.lastUpdated,
        schedulerDuration: mergedState.schedulerDuration,
        totalRuns: mergedState.totalRuns
      });
      
      return mergedState;
    } else {
      logger.info('No state file found, using default state');
      return { ...DEFAULT_STATE };
    }
  } catch (error) {
    logger.error('Failed to load state, using default', { error: error.message });
    return { ...DEFAULT_STATE };
  }
}

/**
 * Save state to file
 * @param {Object} state - State object to save
 * @returns {boolean} Success status
 */
function saveState(state) {
  try {
    // Ensure updatedAt is current
    state.updatedAt = new Date().toISOString();
    
    // Create directory if it doesn't exist
    const dir = path.dirname(STATE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write state to file
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
    
    logger.debug('State saved successfully', { 
      lastUpdated: state.lastUpdated,
      totalRuns: state.totalRuns
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to save state', { error: error.message });
    return false;
  }
}

/**
 * Update last updated time
 * @param {string} platform - Platform name (optional)
 * @returns {boolean} Success status
 */
function updateLastUpdated(platform = null) {
  const state = loadState();
  state.lastUpdated = new Date().toISOString();
  
  if (platform) {
    if (!state.platformStates[platform]) {
      state.platformStates[platform] = {};
    }
    state.platformStates[platform].lastUpdated = state.lastUpdated;
  }
  
  return saveState(state);
}

/**
 * Update scheduler duration
 * @param {number} durationMs - Duration in milliseconds
 * @returns {boolean} Success status
 */
function updateSchedulerDuration(durationMs) {
  const state = loadState();
  state.schedulerDuration = durationMs;
  
  logger.info('Scheduler duration updated', { 
    oldDuration: state.schedulerDuration,
    newDuration: durationMs
  });
  
  return saveState(state);
}

/**
 * Update last bulk run time
 * @returns {boolean} Success status
 */
function updateLastBulkRun() {
  const state = loadState();
  state.lastBulkRun = new Date().toISOString();
  state.totalRuns++;
  
  return saveState(state);
}

/**
 * Update platform-specific state
 * @param {string} platform - Platform name
 * @param {Object} platformData - Platform-specific data
 * @returns {boolean} Success status
 */
function updatePlatformState(platform, platformData) {
  const state = loadState();
  
  if (!state.platformStates[platform]) {
    state.platformStates[platform] = {};
  }
  
  state.platformStates[platform] = {
    ...state.platformStates[platform],
    ...platformData,
    lastUpdated: new Date().toISOString()
  };
  
  return saveState(state);
}

/**
 * Get time since last update
 * @param {string} platform - Platform name (optional)
 * @returns {number} Milliseconds since last update
 */
function getTimeSinceLastUpdate(platform = null) {
  const state = loadState();
  
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
}

/**
 * Check if it's time for next update
 * @param {string} platform - Platform name (optional)
 * @returns {boolean} Whether it's time for update
 */
function isTimeForUpdate(platform = null) {
  const timeSinceLastUpdate = getTimeSinceLastUpdate(platform);
  const state = loadState();
  
  return timeSinceLastUpdate >= state.schedulerDuration;
}

/**
 * Get next update time
 * @param {string} platform - Platform name (optional)
 * @returns {Date} Next update time
 */
function getNextUpdateTime(platform = null) {
  const state = loadState();
  
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
}

/**
 * Update error information
 * @param {Error} error - Error object
 * @param {string} platform - Platform name (optional)
 * @returns {boolean} Success status
 */
function updateError(error, platform = null) {
  const state = loadState();
  
  state.lastError = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    platform: platform
  };
  
  if (platform && state.platformStates[platform]) {
    state.platformStates[platform].lastError = state.lastError;
  }
  
  return saveState(state);
}

/**
 * Clear error information
 * @returns {boolean} Success status
 */
function clearError() {
  const state = loadState();
  state.lastError = null;
  
  // Clear platform-specific errors too
  Object.keys(state.platformStates).forEach(platform => {
    if (state.platformStates[platform].lastError) {
      state.platformStates[platform].lastError = null;
    }
  });
  
  return saveState(state);
}

/**
 * Get state summary for logging
 * @returns {Object} State summary
 */
function getStateSummary() {
  const state = loadState();
  
  return {
    lastUpdated: state.lastUpdated,
    schedulerDuration: state.schedulerDuration,
    lastBulkRun: state.lastBulkRun,
    totalRuns: state.totalRuns,
    totalProductsProcessed: state.totalProductsProcessed,
    hasError: !!state.lastError,
    platformCount: Object.keys(state.platformStates).length,
    nextUpdateTime: getNextUpdateTime(),
    timeSinceLastUpdate: getTimeSinceLastUpdate()
  };
}

/**
 * Reset state (use with caution)
 * @returns {boolean} Success status
 */
function resetState() {
  const resetState = { ...DEFAULT_STATE };
  resetState.createdAt = new Date().toISOString();
  
  logger.warn('State reset requested', { 
    previousTotalRuns: loadState().totalRuns 
  });
  
  return saveState(resetState);
}

/**
 * Backup current state
 * @returns {string} Backup file path
 */
function backupState() {
  const state = loadState();
  const backupPath = STATE_FILE_PATH.replace('.json', `_backup_${Date.now()}.json`);
  
  try {
    fs.writeFileSync(backupPath, JSON.stringify(state, null, 2));
    logger.info('State backed up', { backupPath });
    return backupPath;
  } catch (error) {
    logger.error('Failed to backup state', { error: error.message });
    return null;
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
  resetState,
  backupState,
  STATE_FILE_PATH
};



