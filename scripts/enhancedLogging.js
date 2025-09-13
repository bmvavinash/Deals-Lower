#!/usr/bin/env node

/**
 * Enhanced logging system for scheduler monitoring
 * Provides detailed statistics and real-time monitoring
 */

const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('enhancedLogging');

// Statistics tracking
let stats = {
  schedulerTriggers: 0,
  productsCreated: 0,
  productsUpdated: 0,
  productsSkipped: 0,
  errors: 0,
  lastReset: new Date().toISOString(),
  platformStats: {},
  hourlyStats: {}
};

/**
 * Log scheduler trigger with detailed information
 */
function logSchedulerTrigger(platform, triggerType = 'scheduled') {
  stats.schedulerTriggers++;
  
  const hour = new Date().getHours();
  if (!stats.hourlyStats[hour]) {
    stats.hourlyStats[hour] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.hourlyStats[hour].triggers++;

  if (!stats.platformStats[platform]) {
    stats.platformStats[platform] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.platformStats[platform].triggers++;

  logger.info('Scheduler triggered', {
    platform,
    triggerType,
    totalTriggers: stats.schedulerTriggers,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log product creation
 */
function logProductCreated(platform, productCode, source = 'website') {
  stats.productsCreated++;
  
  const hour = new Date().getHours();
  if (!stats.hourlyStats[hour]) {
    stats.hourlyStats[hour] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.hourlyStats[hour].created++;

  if (!stats.platformStats[platform]) {
    stats.platformStats[platform] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.platformStats[platform].created++;

  logger.info('Product created', {
    platform,
    productCode,
    source,
    totalCreated: stats.productsCreated,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log product update
 */
function logProductUpdated(platform, productCode, changeType = 'unknown', changeCount = 0) {
  stats.productsUpdated++;
  
  const hour = new Date().getHours();
  if (!stats.hourlyStats[hour]) {
    stats.hourlyStats[hour] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.hourlyStats[hour].updated++;

  if (!stats.platformStats[platform]) {
    stats.platformStats[platform] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.platformStats[platform].updated++;

  logger.info('Product updated', {
    platform,
    productCode,
    changeType,
    changeCount,
    totalUpdated: stats.productsUpdated,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log product skipped (no changes)
 */
function logProductSkipped(platform, productCode, reason = 'no_changes') {
  stats.productsSkipped++;
  
  logger.info('Product skipped', {
    platform,
    productCode,
    reason,
    totalSkipped: stats.productsSkipped,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log error
 */
function logError(platform, error, context = {}) {
  stats.errors++;
  
  const hour = new Date().getHours();
  if (!stats.hourlyStats[hour]) {
    stats.hourlyStats[hour] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.hourlyStats[hour].errors++;

  if (!stats.platformStats[platform]) {
    stats.platformStats[platform] = { triggers: 0, created: 0, updated: 0, errors: 0 };
  }
  stats.platformStats[platform].errors++;

  logger.error('Scheduler error', {
    platform,
    error: error.message || error,
    stack: error.stack,
    context,
    totalErrors: stats.errors,
    timestamp: new Date().toISOString()
  });
}

/**
 * Generate comprehensive statistics report
 */
function generateStatsReport() {
  const totalOperations = stats.productsCreated + stats.productsUpdated + stats.productsSkipped;
  const successRate = totalOperations > 0 ? ((stats.productsCreated + stats.productsUpdated) / totalOperations * 100).toFixed(1) : 0;
  const errorRate = stats.schedulerTriggers > 0 ? (stats.errors / stats.schedulerTriggers * 100).toFixed(1) : 0;

  const report = {
    summary: {
      schedulerTriggers: stats.schedulerTriggers,
      productsCreated: stats.productsCreated,
      productsUpdated: stats.productsUpdated,
      productsSkipped: stats.productsSkipped,
      errors: stats.errors,
      successRate: `${successRate}%`,
      errorRate: `${errorRate}%`,
      lastReset: stats.lastReset
    },
    platformBreakdown: stats.platformStats,
    hourlyBreakdown: stats.hourlyStats,
    efficiency: {
      productsPerTrigger: stats.schedulerTriggers > 0 ? (totalOperations / stats.schedulerTriggers).toFixed(2) : 0,
      updateRate: totalOperations > 0 ? (stats.productsUpdated / totalOperations * 100).toFixed(1) : 0
    }
  };

  return report;
}

/**
 * Reset statistics
 */
function resetStats() {
  stats = {
    schedulerTriggers: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    errors: 0,
    lastReset: new Date().toISOString(),
    platformStats: {},
    hourlyStats: {}
  };
  
  logger.info('Statistics reset', { timestamp: new Date().toISOString() });
}

/**
 * Save statistics to file
 */
function saveStatsToFile() {
  const report = generateStatsReport();
  const statsFile = path.join(__dirname, '..', 'logs', 'scheduler-stats.json');
  
  try {
    fs.writeFileSync(statsFile, JSON.stringify(report, null, 2));
    logger.info('Statistics saved to file', { file: statsFile });
  } catch (error) {
    logger.error('Failed to save statistics', { error: error.message });
  }
}

/**
 * Load statistics from file
 */
function loadStatsFromFile() {
  const statsFile = path.join(__dirname, '..', 'logs', 'scheduler-stats.json');
  
  try {
    if (fs.existsSync(statsFile)) {
      const data = fs.readFileSync(statsFile, 'utf8');
      const savedStats = JSON.parse(data);
      
      // Merge with current stats (preserve current session data)
      if (savedStats.summary) {
        stats.schedulerTriggers += savedStats.summary.schedulerTriggers || 0;
        stats.productsCreated += savedStats.summary.productsCreated || 0;
        stats.productsUpdated += savedStats.summary.productsUpdated || 0;
        stats.productsSkipped += savedStats.summary.productsSkipped || 0;
        stats.errors += savedStats.summary.errors || 0;
      }
      
      logger.info('Statistics loaded from file', { file: statsFile });
    }
  } catch (error) {
    logger.error('Failed to load statistics', { error: error.message });
  }
}

// Auto-save statistics every 5 minutes
setInterval(saveStatsToFile, 5 * 60 * 1000);

// Load existing statistics on startup
loadStatsFromFile();

module.exports = {
  logSchedulerTrigger,
  logProductCreated,
  logProductUpdated,
  logProductSkipped,
  logError,
  generateStatsReport,
  resetStats,
  saveStatsToFile,
  loadStatsFromFile,
  getStats: () => stats
};



