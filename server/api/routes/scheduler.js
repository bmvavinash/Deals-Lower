const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { 
  loadState, 
  getStateSummary,
  updateLastBulkRun,
  updatePlatformState
} = require('../../../database/firebaseDB/schedulerStateDB');
const { runBulkUpdateAll } = require('../../../scripts/bulkUpdateAllPlatforms');

const logger = getModuleLogger('scheduler-api');

// In-memory scheduler state (can be persisted to Firebase)
let schedulerState = {
  isPaused: false,
  isRunning: false,
  lastRun: null,
  nextRun: null,
  executionHistory: []
};

/**
 * GET /api/scheduler/status
 * Get current scheduler state
 */
router.get('/status', async (req, res, next) => {
  try {
    const stateSummary = await getStateSummary();
    const state = await loadState();
    
    res.json({
      success: true,
      data: {
        ...schedulerState,
        ...stateSummary,
        state: state,
        isActive: !schedulerState.isPaused && !schedulerState.isRunning
      }
    });
  } catch (error) {
    logger.error('Error fetching scheduler status', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/scheduler/pause
 * Pause the scheduler
 */
router.post('/pause', async (req, res, next) => {
  try {
    schedulerState.isPaused = true;
    logger.info('Scheduler paused via API');
    
    res.json({
      success: true,
      message: 'Scheduler paused successfully',
      data: schedulerState
    });
  } catch (error) {
    logger.error('Error pausing scheduler', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/scheduler/resume
 * Resume the scheduler
 */
router.post('/resume', async (req, res, next) => {
  try {
    schedulerState.isPaused = false;
    logger.info('Scheduler resumed via API');
    
    res.json({
      success: true,
      message: 'Scheduler resumed successfully',
      data: schedulerState
    });
  } catch (error) {
    logger.error('Error resuming scheduler', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/scheduler/trigger
 * Manually trigger scheduler execution
 */
router.post('/trigger', async (req, res, next) => {
  try {
    if (schedulerState.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'Scheduler is already running'
      });
    }

    schedulerState.isRunning = true;
    schedulerState.lastRun = new Date().toISOString();
    
    logger.info('Scheduler manually triggered via API');
    
    // Trigger bulk update in background
    runBulkUpdateAll('website', 'productdeals')
      .then(result => {
        schedulerState.isRunning = false;
        schedulerState.executionHistory.unshift({
          timestamp: new Date().toISOString(),
          success: true,
          result: result
        });
        // Keep only last 50 executions
        if (schedulerState.executionHistory.length > 50) {
          schedulerState.executionHistory = schedulerState.executionHistory.slice(0, 50);
        }
        logger.info('Manual scheduler execution completed', result);
      })
      .catch(error => {
        schedulerState.isRunning = false;
        schedulerState.executionHistory.unshift({
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message
        });
        logger.error('Manual scheduler execution failed', { error: error.message });
      });

    res.json({
      success: true,
      message: 'Scheduler triggered successfully',
      note: 'Execution is running in background. Check execution history for results.'
    });
  } catch (error) {
    schedulerState.isRunning = false;
    logger.error('Error triggering scheduler', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/scheduler/history
 * Get scheduler execution history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    const history = schedulerState.executionHistory.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    logger.error('Error fetching scheduler history', { error: error.message });
    next(error);
  }
});

module.exports = router;


















