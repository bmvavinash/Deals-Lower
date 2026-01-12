/**
 * Auto Monitor and Run Script
 * 
 * This script automatically:
 * 1. Runs bulk updates at regular intervals
 * 2. Monitors Telegram bot processing
 * 3. Logs performance metrics
 * 4. Runs continuously without user intervention
 */

const { runBulkUpdateAll } = require('./bulkUpdateAllPlatforms');
const { runTelegramBot } = require('../run_telegram_bot');
const { getModuleLogger } = require('../logger/logger');
const constants = require('../config/constants');

const logger = getModuleLogger('auto-monitor');

// Configuration
const BULK_UPDATE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TELEGRAM_BOT_CHECK_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

let isBulkRunning = false;
let isTelegramRunning = false;
let lastBulkUpdateTime = null;
let lastTelegramCheckTime = null;
let bulkUpdateCount = 0;
let telegramCheckCount = 0;

/**
 * Run bulk updates for all platforms
 */
async function runBulkUpdates() {
  if (isBulkRunning) {
    logger.info('Bulk update already running, skipping...');
    return;
  }

  isBulkRunning = true;
  const startTime = Date.now();
  bulkUpdateCount++;

  try {
    logger.info('🚀 Starting automated bulk update...', {
      runNumber: bulkUpdateCount,
      timestamp: new Date().toISOString()
    });

    const result = await runBulkUpdateAll('website', 'deals');
    const duration = Date.now() - startTime;

    lastBulkUpdateTime = new Date();

    logger.info('✅ Bulk update completed', {
      runNumber: bulkUpdateCount,
      duration: `${Math.round(duration / 60000)} minutes`,
      totalPlatforms: result.totalPlatforms,
      successfulPlatforms: result.successfulPlatforms,
      failedPlatforms: result.failedPlatforms,
      totalProducts: result.totalProducts,
      successRate: result.successRate
    });

    console.log('\n📊 BULK UPDATE SUMMARY:');
    console.log('==============================================');
    console.log(`⏱️  Duration: ${Math.round(duration / 60000)} minutes`);
    console.log(`🌐 Total platforms: ${result.totalPlatforms}`);
    console.log(`✅ Successful: ${result.successfulPlatforms}`);
    console.log(`❌ Failed: ${result.failedPlatforms}`);
    console.log(`📦 Total products: ${result.totalProducts}`);
    console.log(`🎯 Success rate: ${result.successRate}%`);
    console.log('==============================================\n');

  } catch (error) {
    logger.error('❌ Bulk update failed', {
      runNumber: bulkUpdateCount,
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Bulk update failed:', error.message);
  } finally {
    isBulkRunning = false;
  }
}

/**
 * Check and ensure Telegram bot is running
 */
async function checkAndRunTelegramBot() {
  if (isTelegramRunning) {
    logger.debug('Telegram bot already running, skipping check...');
    return;
  }

  telegramCheckCount++;
  lastTelegramCheckTime = new Date();

  try {
    logger.info('🤖 Checking Telegram bot status...', {
      checkNumber: telegramCheckCount,
      timestamp: new Date().toISOString()
    });

    // Start Telegram bot (it runs continuously)
    isTelegramRunning = true;
    
    // Run Telegram bot in background
    runTelegramBot().catch(error => {
      logger.error('Telegram bot error', {
        error: error.message,
        stack: error.stack
      });
      isTelegramRunning = false;
    });

    logger.info('✅ Telegram bot started', {
      checkNumber: telegramCheckCount
    });

  } catch (error) {
    logger.error('❌ Failed to start Telegram bot', {
      checkNumber: telegramCheckCount,
      error: error.message,
      stack: error.stack
    });
    isTelegramRunning = false;
  }
}

/**
 * Print status report
 */
function printStatusReport() {
  console.log('\n📊 AUTO MONITOR STATUS REPORT');
  console.log('==============================================');
  console.log(`🔄 Bulk Updates:`);
  console.log(`   - Total runs: ${bulkUpdateCount}`);
  console.log(`   - Last run: ${lastBulkUpdateTime ? lastBulkUpdateTime.toLocaleString() : 'Never'}`);
  console.log(`   - Status: ${isBulkRunning ? '🟢 Running' : '⚪ Idle'}`);
  console.log(`\n🤖 Telegram Bot:`);
  console.log(`   - Checks: ${telegramCheckCount}`);
  console.log(`   - Last check: ${lastTelegramCheckTime ? lastTelegramCheckTime.toLocaleString() : 'Never'}`);
  console.log(`   - Status: ${isTelegramRunning ? '🟢 Running' : '⚪ Stopped'}`);
  console.log(`\n⏰ Next Actions:`);
  const nextBulk = lastBulkUpdateTime 
    ? new Date(lastBulkUpdateTime.getTime() + BULK_UPDATE_INTERVAL_MS)
    : new Date(Date.now() + BULK_UPDATE_INTERVAL_MS);
  console.log(`   - Next bulk update: ${nextBulk.toLocaleString()}`);
  console.log('==============================================\n');
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  logger.info('🚀 Starting Auto Monitor and Run System...', {
    bulkUpdateInterval: `${BULK_UPDATE_INTERVAL_MS / 60000} minutes`,
    monitorInterval: `${MONITOR_INTERVAL_MS / 6000} minutes`,
    telegramCheckInterval: `${TELEGRAM_BOT_CHECK_INTERVAL_MS / 60000} minutes`
  });

  console.log('\n🚀 AUTO MONITOR AND RUN SYSTEM STARTED');
  console.log('==============================================');
  console.log(`📦 Bulk Update Interval: ${BULK_UPDATE_INTERVAL_MS / 60000} minutes`);
  console.log(`📊 Monitor Interval: ${MONITOR_INTERVAL_MS / 60000} minutes`);
  console.log(`🤖 Telegram Check Interval: ${TELEGRAM_BOT_CHECK_INTERVAL_MS / 60000} minutes`);
  console.log('==============================================\n');

  // Initial run
  await runBulkUpdates();
  await checkAndRunTelegramBot();

  // Set up intervals
  setInterval(async () => {
    const timeSinceLastBulk = lastBulkUpdateTime 
      ? Date.now() - lastBulkUpdateTime.getTime()
      : Infinity;

    if (timeSinceLastBulk >= BULK_UPDATE_INTERVAL_MS) {
      await runBulkUpdates();
    }
  }, MONITOR_INTERVAL_MS);

  // Check Telegram bot periodically
  setInterval(async () => {
    await checkAndRunTelegramBot();
  }, TELEGRAM_BOT_CHECK_INTERVAL_MS);

  // Print status report every 30 minutes
  setInterval(() => {
    printStatusReport();
  }, 30 * 60 * 1000);

  // Print initial status
  printStatusReport();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down Auto Monitor...');
  console.log('\n🛑 Shutting down Auto Monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Shutting down Auto Monitor...');
  console.log('\n🛑 Shutting down Auto Monitor...');
  process.exit(0);
});

// Start the monitoring system
if (require.main === module) {
  startMonitoring().catch(error => {
    logger.error('💥 Fatal error in Auto Monitor', {
      error: error.message,
      stack: error.stack
    });
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  startMonitoring,
  runBulkUpdates,
  checkAndRunTelegramBot
};












