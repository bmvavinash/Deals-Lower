process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();

const { verifyAndUpdateTodaysDeals } = require('../services/dealExpirationService');
const { cleanupExpiredDealsAndBanners } = require('./cleanupExpiredDeals');
const { getModuleLogger } = require('../logger/logger');
const { executionTracker } = require('../services/executionTracker');

const logger = getModuleLogger('verifyAndUpdateDeals');

async function main() {
  logger.info('🚀 Starting Deal Verification & Expiration Job...');

  const isDryRun = process.argv.includes('--dry-run');
  const skipLive = process.argv.includes('--skip-live');
  const maxDealsArg = process.argv.find(arg => arg.startsWith('--max='));
  const maxDeals = maxDealsArg ? parseInt(maxDealsArg.split('=')[1], 10) : 100;

  const sourceType = process.env.TRIGGER_SOURCE || (process.env.GITHUB_ACTIONS ? 'github-actions' : 'cron');

  try {
    await executionTracker.startDbUpdateExecution('verifyAndUpdateDeals', sourceType);
  } catch (trackErr) {
    logger.debug('Could not start execution tracker:', { error: trackErr.message });
  }

  try {
    // 1. Verify today's active deals (live price check, price hikes, out of stock, timers)
    logger.info(`Checking today's deals (max: ${maxDeals}, liveCheck: ${!skipLive})...`);
    const dealStats = await verifyAndUpdateTodaysDeals({
      maxDealsToCheck: maxDeals,
      liveCheck: !skipLive
    });

    logger.info('Deal check summary:', dealStats);

    // 2. Run stale DB / timer cleanup for productdeals and banners
    logger.info('Running database timer/stale cleanup...');
    let cleanupStats = { expiredDealsWiped: 0, hotDealsDeleted: 0, bannersDeactivated: 0 };
    try {
      cleanupStats = await cleanupExpiredDealsAndBanners();
    } catch (cleanErr) {
      logger.error('Error during database timer cleanup:', { error: cleanErr.message });
    }

    const finalReport = {
      source: sourceType,
      checkedDeals: dealStats.totalChecked,
      expiredDealsDetected: dealStats.expiredCount,
      telegramMessagesEdited: dealStats.telegramEditedCount,
      dbRecordsUpdated: dealStats.dbUpdatedCount,
      cleanupStats,
      completedAt: new Date().toISOString()
    };

    logger.info('🎉 Deal verification and update process completed successfully!', finalReport);

    try {
      await executionTracker.endDbUpdateExecution('completed', finalReport);
    } catch (trackEndErr) {
      logger.debug('Could not end execution tracker:', { error: trackEndErr.message });
    }

    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during verifyAndUpdateDeals:', {
      error: error.message,
      stack: error.stack
    });

    try {
      await executionTracker.endDbUpdateExecution('failed', { error: error.message });
    } catch (_) {}

    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled fatal error in verifyAndUpdateDeals:', err);
    process.exit(1);
  });
}

module.exports = { main };
