process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const net = require('net');
const { initializeBot, setDriver, getNewBotMessages, kickOffQueueProcessing } = require('./dataSources/autoTelegramAll');
const { handleProductProcessing } = require('./dataSources/handleProductProcessing');
const { firebaseget } = require('./database/firebaseget');
const { getModuleLogger } = require('./logger/logger');
const { createChromeDriver, isDriverSessionValid } = require('./utils/seleniumDriver');

const logger = getModuleLogger('telegramBotRunner');
const fs = require('fs');
const path = require('path');
const LOCK_FILE = path.join(__dirname, '.telegram-bot.lock');

let driver = null;
let singleInstanceServer = null;

async function acquireSingleInstanceLock() {
  const lockPort = parseInt(process.env.TELEGRAM_BOT_LOCK_PORT || '9233', 10);
  if (!Number.isFinite(lockPort)) {
    logger.warn('Invalid TELEGRAM_BOT_LOCK_PORT, skipping single-instance lock', { value: process.env.TELEGRAM_BOT_LOCK_PORT });
    return true;
  }

  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.error('Another Telegram bot instance is already running (lock port in use). Exiting to avoid Telegram 409 conflicts.', {
          lockPort
        });
        return resolve(false);
      }
      logger.warn('Could not acquire Telegram bot single-instance lock (continuing anyway)', {
        lockPort,
        error: err?.message,
        code: err?.code
      });
      return resolve(true);
    });

    server.listen(lockPort, '127.0.0.1', () => {
      singleInstanceServer = server;
      logger.info('Acquired Telegram bot single-instance lock', { lockPort });
      resolve(true);
    });
  });
}

async function initializeDriver() {
  try {
    logger.info('🌐 Initializing Chrome WebDriver (debugger port, then headless fallback)...');

    const { driver: newDriver, mode, debuggerAddress } = await createChromeDriver();
    driver = newDriver;
    global.driver = driver;
    setDriver(driver);

    logger.info('✅ Chrome WebDriver initialized and session verified', { mode, debuggerAddress: debuggerAddress || 'n/a' });
    return driver;
  } catch (error) {
    logger.error('❌ Failed to initialize WebDriver:', { error: error.message, stack: error.stack });
    driver = null;
    global.driver = null;
    setDriver(null);
    logger.warn('⚠️ Will retry driver initialization in next loop');
    return null;
  }
}

async function ensureDriverValid() {
  if (await isDriverSessionValid(driver)) {
    return true;
  }

  logger.warn('⚠️ Driver session invalid or missing, re-initializing...');
  if (driver) {
    try {
      await driver.quit();
    } catch {
      // ignore
    }
  }
  driver = null;
  global.driver = null;
  setDriver(null);

  await initializeDriver();
  return await isDriverSessionValid(driver);
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (_) {}
}

async function runTelegramBot() {
  const { executionTracker } = require('./services/executionTracker');

  if (fs.existsSync(LOCK_FILE)) {
    const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
    try {
      process.kill(existingPid, 0);
      logger.error('Another Telegram bot instance is already running', { pid: existingPid });
      process.exit(1);
    } catch {
      fs.unlinkSync(LOCK_FILE);
    }
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid));
  
  try {
    const locked = await acquireSingleInstanceLock();
    if (!locked) return;

    // Start Telegram execution tracking
    await executionTracker.startTelegramExecution('telegram_bot');
    logger.info('🚀 Starting Telegram Bot with proper driver setup...');
    
    // Initialize driver first
    await initializeDriver();
    
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
    const maxLoops = 1000; // Run for 1000 loops or until stopped
    
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

        // Process any messages queued while driver was unavailable
        await kickOffQueueProcessing();
        
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

              try {
                await executionTracker.updateTelegramMessageProgress('processed');
              } catch (trackErr) {
                logger.warn('Telegram message progress tracking failed', { error: trackErr?.message });
              }
              
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
    releaseLock();
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
  releaseLock();
  if (driver) {
    try {
      await driver.quit();
      logger.info('✅ WebDriver closed successfully');
    } catch (error) {
      logger.error('❌ Error closing WebDriver:', { error: error.message });
    }
  }
  if (singleInstanceServer) {
    try { singleInstanceServer.close(); } catch {}
    singleInstanceServer = null;
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM. Shutting down gracefully...');
  releaseLock();
  if (driver) {
    try {
      await driver.quit();
      logger.info('✅ WebDriver closed successfully');
    } catch (error) {
      logger.error('❌ Error closing WebDriver:', { error: error.message });
    }
  }
  if (singleInstanceServer) {
    try { singleInstanceServer.close(); } catch {}
    singleInstanceServer = null;
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

