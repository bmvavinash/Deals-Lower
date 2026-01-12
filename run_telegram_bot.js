const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const { initializeBot, setDriver, getNewBotMessages } = require('./dataSources/autoTelegramAll');
const { handleProductProcessing } = require('./dataSources/handleProductProcessing');
const { firebaseget } = require('./database/firebaseget');
const constants = require('./config/constants');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('telegramBotRunner');

let driver = null;

async function initializeDriver() {
  try {
    logger.info('🌐 Initializing Chrome WebDriver...');
    
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222"); // Connect to existing Chrome instance
    
    driver = await chrome.Driver.createSession(options);
    global.driver = driver; // Make driver globally available
    
    // Verify driver session is valid
    try {
      await driver.getCurrentUrl(); // Test if session is valid
      logger.info('✅ Chrome WebDriver initialized and session verified');
    } catch (sessionError) {
      logger.warn('⚠️ Driver session test failed, but continuing', { error: sessionError.message });
    }
    
    return driver;
  } catch (error) {
    logger.error('❌ Failed to initialize WebDriver:', { error: error.message, stack: error.stack });
    // Don't throw - try to continue without driver or retry
    logger.warn('⚠️ Will retry driver initialization in next loop');
    return null;
  }
}

async function ensureDriverValid() {
  if (!driver) {
    logger.info('🔄 Driver is null, re-initializing...');
    await initializeDriver();
    if (driver) {
      setDriver(driver);
    }
    return driver !== null;
  }
  
  try {
    // Test if driver session is still valid
    await driver.getCurrentUrl();
    return true;
  } catch (error) {
    logger.warn('⚠️ Driver session invalid, re-initializing...', { error: error.message });
    driver = null;
    await initializeDriver();
    if (driver) {
      setDriver(driver);
    }
    return driver !== null;
  }
}

async function runTelegramBot() {
  const { executionTracker } = require('./services/executionTracker');
  
  try {
    // Start Telegram execution tracking
    await executionTracker.startTelegramExecution('telegram_bot');
    logger.info('🚀 Starting Telegram Bot with proper driver setup...');
    
    // Initialize driver first
    await initializeDriver();
    
    // Set the driver for Telegram bot processing
    setDriver(driver);
    
    // Get initial data
    let jsonData = {};
    let todayJsonData = {};
    let len = 0;
    
    try {
      logger.info('📥 Fetching initial data from Firebase...');
      const result = await firebaseget();
      jsonData = result.data || {};
      len = result.len || 0;
      logger.info('✅ Initial data fetched successfully', { 
        dataLength: len,
        recordsCount: Object.keys(jsonData).length 
      });
    } catch (error) {
      logger.error('❌ Error getting initial data:', { error: error.message });
    }
    
    try {
      logger.info('📥 Fetching today\'s data from Firebase...');
      const todayResult = await firebaseget(true);
      todayJsonData = todayResult.data || {};
      logger.info('✅ Today\'s data fetched successfully', { 
        recordsCount: Object.keys(todayJsonData).length 
      });
    } catch (error) {
      logger.error('❌ Error getting today\'s data:', { error: error.message });
    }
    
    // Initialize Telegram bot
    logger.info('🤖 Initializing Telegram bot...');
    await initializeBot();
    
    // Start continuous processing
    logger.info('🔄 Starting continuous Telegram message processing...');
    
    let loopCount = 0;
    const maxLoops = 100; // Run for 100 loops or until stopped
    
    while (loopCount < maxLoops) {
      try {
        loopCount++;
        logger.info(`🔄 Processing loop #${loopCount} (checks every ~10 seconds: 5s poll + 5s wait)`);
        
        // Ensure driver is valid before processing
        const driverValid = await ensureDriverValid();
        if (!driverValid) {
          logger.warn('⚠️ Driver not available, skipping this loop');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s before retry
          continue;
        }
        
        // Get new messages from Telegram (this waits 5 seconds internally)
        const messages = await getNewBotMessages();
        
        if (messages.length > 0) {
          logger.info(`📨 Processing ${messages.length} new messages`);
          
          // Process each message
          for (const message of messages) {
            try {
              // Re-check driver validity before each message
              const stillValid = await ensureDriverValid();
              if (!stillValid) {
                logger.error('❌ Driver became invalid during processing, skipping remaining messages');
                break;
              }
              
              const { link, plainText, username, generateLink } = message;
              logger.info(`🔗 Processing link: ${link}`);
              
              const result = await handleProductProcessing(
                driver, 
                link, 
                plainText, 
                len, 
                '', 
                jsonData, 
                todayJsonData, 
                username || '', 
                generateLink
              );
              
              logger.info(`✅ Processing result for ${link}:`, result);
              
            } catch (error) {
              logger.error(`❌ Error processing message:`, { 
                link: message.link, 
                error: error.message,
                stack: error.stack
              });
              
              // If it's a session error, mark driver as invalid
              if (error.message && error.message.includes('session')) {
                logger.warn('⚠️ Session error detected, will re-initialize driver');
                driver = null;
              }
            }
          }
        } else {
          logger.info('📭 No new messages to process (next check in ~10 seconds)');
        }
        
        // Wait before next check (getNewBotMessages already waits 5s, so total is ~10s between checks)
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        
      } catch (error) {
        logger.error('❌ Error in processing loop:', { 
          loopCount, 
          error: error.message,
          stack: error.stack
        });
        
        // Mark driver as invalid on critical errors
        if (error.message && error.message.includes('session')) {
          driver = null;
        }
        
        // Wait longer on error
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      }
    }
    
    logger.info('✅ Telegram bot processing completed');
    
    // Complete Telegram execution tracking
    if (executionTracker && executionTracker.currentExecution && executionTracker.currentExecution.type === 'telegram_bot') {
      await executionTracker.completeTelegramExecution();
    }
    
  } catch (error) {
    logger.error('💥 Critical error in Telegram bot:', { error: error.message });
  } finally {
    // Only cleanup if we're actually stopping (not just looping)
    // Don't quit driver if we're still in the loop - it's needed for continuous operation
    logger.info('🔄 Telegram bot loop completed or stopped');
    // Note: Driver cleanup is handled by SIGINT/SIGTERM handlers
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT. Shutting down gracefully...');
  if (driver) {
    try {
      await driver.quit();
      logger.info('✅ WebDriver closed successfully');
    } catch (error) {
      logger.error('❌ Error closing WebDriver:', { error: error.message });
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM. Shutting down gracefully...');
  if (driver) {
    try {
      await driver.quit();
      logger.info('✅ WebDriver closed successfully');
    } catch (error) {
      logger.error('❌ Error closing WebDriver:', { error: error.message });
    }
  }
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  runTelegramBot().catch(error => {
    logger.error('💥 Fatal error:', { error: error.message });
    process.exit(1);
  });
}

module.exports = { runTelegramBot };

