const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
// require("chromedriver");
const { runBulkUpdateAll } = require('./scripts/bulkUpdateAllPlatforms');
const { runTelegramBot } = require('./run_telegram_bot');
const constants = require('./config/constants');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('bulkUpdateRunner');

async function runBulkUpdates() {
  try {
    logger.info('🚀 Starting Bulk Updates for all platforms...');
    
    const startTime = Date.now();
    
    // Run bulk updates for all platforms
    logger.info('📦 Running bulk update for all platforms...');
    const result = await runBulkUpdateAll('website', 'deals');
    
    const duration = Date.now() - startTime;
    
    logger.info('✅ Bulk update completed successfully', {
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
    console.log('==============================================');
    
    // Show detailed results for each platform
    console.log('\n📋 PLATFORM DETAILS:');
    for (const [platform, platformResult] of Object.entries(result.results)) {
      if (platformResult.error) {
        console.log(`❌ ${platform}: ${platformResult.error}`);
      } else {
        console.log(`✅ ${platform}: ${platformResult.totalProducts} products, ${platformResult.successRate}% success rate`);
      }
    }
    
    // After bulk updates complete, redirect to Telegram bot
    console.log('\n🔄 Redirecting to Telegram Bot...');
    console.log('==============================================');
    logger.info('Bulk updates completed, starting Telegram bot...');
    
    // Start Telegram bot
    await runTelegramBot();
    
  } catch (error) {
    logger.error('💥 Bulk update failed:', { error: error.message });
    console.error('❌ Bulk update failed:', error.message);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Start bulk updates
if (require.main === module) {
  runBulkUpdates().catch(error => {
    logger.error('💥 Fatal error:', { error: error.message });
    process.exit(1);
  });
}

module.exports = { runBulkUpdates };

