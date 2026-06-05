// extractLinksAndText - for bot
// extractTextAndLinks - for Telegram

const { Builder, By } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { handleProductProcessing } = require('./handleProductProcessing');
const { firebaseget } = require("../database/firebaseget");
const constants = require("../config/constants");
const { productStatus, storeMap, searchStatus } = require("../config/const");
const { initializeBot, processMessagesQueue, getNewBotMessages, setDriver } = require("./autoTelegramAll");
const { getModuleLogger } = require("../logger/logger");
const { scrapePage, loadConfig } = require("../pageScheduler");
const { getformattedDate, extractLinksAndText } = require("../utils/commonUtils");
const { runBulkUpdateAll } = require("../scripts/bulkUpdateAllPlatforms");
const { productDealsDB } = require("../database/firebaseDB/productDealsDB");
const { userFavoritesDB } = require("../database/firebaseDB/userFavoritesDB");
const { isUrgent } = require("../utils/urgencyUtils");
const { notifyTelegram, notifyWhatsapp, isWithinDND, buildMessage } = require("../services/notifyService");
const { favoritesNotificationService } = require("../services/favoritesNotificationService");
const { idleProcessingService } = require("../services/idleProcessingService");
const { 
  loadState, 
  updateLastUpdated, 
  updateLastBulkRun, 
  isTimeForUpdate, 
  getNextUpdateTime,
  getStateSummary,
  updateSchedulerDuration,
  setActiveStatus,
  // Previous state functions
  loadPreviousState,
  updateLastUpdatedScheduler,
  updateSchedulerTriggerDuration,
  backupCurrentStateToPrevious,
  getPreviousStateSummary
} = require("../database/firebaseDB/schedulerStateDB");
// duplicate import removed

// Scheduler controls for bulk updates triggered from bot processing
const FALLBACK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
// RE-ENABLED AFTER FIXING productDealsDB.js
let EFFECTIVE_INTERVAL = Number(constants.bulkUpdateIntervalMs || FALLBACK_INTERVAL);
// let EFFECTIVE_INTERVAL = null; // Disabled for testing

// Smart scheduling - trigger at specific times (e.g., every hour at :00 or :05)
const SCHEDULE_MINUTES = [0, 5]; // Trigger at :00 and :05 minutes past the hour
let lastScheduledRun = 0;

// Favorites processing configuration
const FAVORITES_PROCESSING_INTERVAL = Number(constants.notifications?.favoritesProcessingIntervalMs) || 60 * 60 * 1000; // 1 hour default
const FAVORITES_URGENT_CHECK_INTERVAL = Number(constants.notifications?.favoritesUrgentCheckIntervalMs) || 5 * 60 * 1000; // 5 minutes default
let lastFavoritesProcessingRun = 0;
let lastUrgentCheckRun = 0;

// Check if it's time for scheduled bulk update based on current time
// RE-ENABLED AFTER FIXING productDealsDB.js
function isTimeForScheduledBulk() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  
  // Check if current minute matches any of our scheduled minutes
  const isScheduledMinute = SCHEDULE_MINUTES.includes(currentMinute);
  
  // Check if we haven't run in this hour yet (avoid multiple runs in same hour)
  const currentHourKey = `${currentHour}-${currentMinute}`;
  const hasRunThisHour = lastScheduledRun === currentHourKey;
  
  if (isScheduledMinute && !hasRunThisHour) {
    lastScheduledRun = currentHourKey;
    return true;
  }
  
  return false;
}

// Check if it's time for favorites processing
function isTimeForFavoritesProcessing() {
  const now = Date.now();
  return (now - lastFavoritesProcessingRun) >= FAVORITES_PROCESSING_INTERVAL;
}

// Check if it's time for urgent favorites check
function isTimeForUrgentFavoritesCheck() {
  const now = Date.now();
  return (now - lastUrgentCheckRun) >= FAVORITES_URGENT_CHECK_INTERVAL;
}

// Process favorites notifications with proper error handling and metrics
async function processFavoritesNotifications() {
  if (!constants.notifications?.enableFavoritesService) {
    logger.debug('Favorites service disabled via config');
    return { success: false, reason: 'disabled' };
  }

  try {
    const startTime = Date.now();
    logger.info('Starting favorites notifications processing');
    
    await favoritesNotificationService.processFavoritesAndNotifications();
    
    const duration = Date.now() - startTime;
    lastFavoritesProcessingRun = Date.now();
    
    logger.info('Favorites notifications processing completed', { 
      duration: `${duration}ms`,
      nextRunIn: `${FAVORITES_PROCESSING_INTERVAL / 1000}s`
    });
    
    return { success: true, duration };
  } catch (error) {
    logger.error('Favorites notifications processing failed', { 
      error: error.message,
      stack: error.stack 
    });
    return { success: false, error: error.message };
  }
}

// Process urgent favorites notifications (price drops, low stock, expiring deals)
async function processUrgentFavoritesNotifications() {
  if (!constants.notifications?.enableFavoritesService) {
    return { success: false, reason: 'disabled' };
  }

  try {
    const startTime = Date.now();
    logger.debug('Starting urgent favorites notifications check');
    
    const snapshot = await productDealsDB.ref.once('value');
    const records = snapshot.val() || {};
    let notified = 0;
    let checked = 0;
    
    for (const [key, product] of Object.entries(records)) {
      if (!product || !product.productCode) continue;
      
      checked++;
      const urgency = isUrgent(product);
      if (!urgency.urgent) continue;
      
      // Find users who favorited or track this product
      const userIds = await userFavoritesDB.getUsersFavouritedProduct(product.productCode);
      const trackers = await userFavoritesDB.getUsersTrackingProduct(product.productCode);
      const trackerUserIds = trackers.map(t => t.uid);
      const audience = Array.from(new Set([...userIds, ...trackerUserIds]));
      
      if (audience.length === 0) continue;

      const message = buildMessage(product);
      for (const uid of audience) {
        try {
          const prefs = await userFavoritesDB.getUserPreferences(uid);
          if (isWithinDND(prefs)) continue;
          
          const channels = await userFavoritesDB.getUserChannels(uid);
          
          // Telegram notification
          if (prefs?.notifications?.channels?.telegram && channels?.telegram?.chatId) {
            await notifyTelegram(channels.telegram.chatId, message);
          }
          
          // WhatsApp notification
          if (prefs?.notifications?.channels?.whatsapp && channels?.whatsapp?.optedIn && channels?.whatsapp?.phone) {
            await notifyWhatsapp(channels.whatsapp.phone, message);
          }
          
          notified++;
        } catch (e) {
          logger.warn('Notify user failed', { uid, error: e?.message });
        }
      }
      
      if (notified >= 200) break; // cap per cycle
    }
    
    const duration = Date.now() - startTime;
    lastUrgentCheckRun = Date.now();
    
    logger.info('Urgent favorites notifications check completed', { 
      checked,
      notified,
      duration: `${duration}ms`,
      nextCheckIn: `${FAVORITES_URGENT_CHECK_INTERVAL / 1000}s`
    });
    
    return { success: true, checked, notified, duration };
  } catch (error) {
    logger.error('Urgent favorites notifications check failed', { 
      error: error.message,
      stack: error.stack 
    });
    return { success: false, error: error.message };
  }
}
if (!Number.isFinite(EFFECTIVE_INTERVAL) || EFFECTIVE_INTERVAL < 60_000) {
  EFFECTIVE_INTERVAL = FALLBACK_INTERVAL;
}

// Load persistent state from database
let state = null;
let lastBulkRunAt = 0;
let isBulkRunning = false;
let lastHealthLogAt = 0;

// Initialize state from database
async function initializeState() {
  try {
    // Load current state
    state = await loadState();
    lastBulkRunAt = state.lastBulkRun ? new Date(state.lastBulkRun).getTime() : Date.now();
    // If there was no prior bulk run, set it to now so we don't block other steps immediately
    if (!state.lastBulkRun) {
      await saveState({ ...state, lastBulkRun: new Date(lastBulkRunAt).toISOString() });
      logger.info('Initialized lastBulkRun to now to allow later steps to proceed');
    }
    
    // Load previous state for comparison
    const previousState = await loadPreviousState();
    
    // Update scheduler duration from database if available
    if (state.schedulerDuration && state.schedulerDuration !== EFFECTIVE_INTERVAL) {
      EFFECTIVE_INTERVAL = state.schedulerDuration;
      logger.info('Scheduler duration loaded from database', { 
        duration: EFFECTIVE_INTERVAL,
        durationHours: EFFECTIVE_INTERVAL / (60 * 60 * 1000)
      });
    }
    
    // Set active status
    await setActiveStatus(true);
    
    logger.info('Scheduler state initialized from database', {
      currentState: {
        lastBulkRun: state.lastBulkRun,
        totalRuns: state.totalRuns,
        isActive: state.isActive,
        schedulerDuration: state.schedulerDuration
      },
      previousState: {
        lastUpdatedScheduler: previousState.lastUpdatedScheduler,
        schedulerTriggerDuration: previousState.schedulerTriggerDuration,
        previousTotalRuns: previousState.previousTotalRuns
      }
    });
  } catch (error) {
    logger.error('Failed to initialize state from database', { error: error.message });
    // Fallback to default values
    state = {
      lastBulkRun: null,
      schedulerDuration: EFFECTIVE_INTERVAL,
      totalRuns: 0,
      isActive: true
    };
  }
}

let orchestratorStarted = false;
// const fs = require("fs").promises;

const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('telegram');

let len = null;
let jsonData = null;
let todayJsonData = null;

// File path for saving "Hold" products
const holdProductsFilePath = path.join(__dirname, 'scrappers', 'holdProducts.json');

// Global variable to hold unprocessed products
let holdProducts = [];

// Reads JSON file and parses the content
async function readJsonFile(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
  } catch (e) {
    logger.error("Error reading JSON file", { functionName: 'readJsonFile', error: e });
        return null;
    }
}

// Processes a single product and logs missed links if necessary
async function processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct = true, username, generateLink,shortUrl="", categoryOverride = null) {
  let isProductPosted = await getProductDetails(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct, username, generateLink,shortUrl, categoryOverride);
  if (isProductPosted === productStatus.PRODUCT_CREATED) {
    len += 1;
  } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
    logger.warn(`Missed link: ${link}`, { functionName: 'processProduct' });
  } else if (isProductPosted === productStatus.PRODUCT_EXCLUDED) {
    logger.warn(`Excluded product: ${link} - not eligible for Amazon Associates Program`, { functionName: 'processProduct' });
  }
}

// Handles product processing flow, including getCode check and fallback function
// Shim stays for internal references; delegate to extracted module
async function handleProductProcessingShim(driver, link, text, len, accessToken, jsonData, todayJsonData, username="") {
  return require('./handleProductProcessing').handleProductProcessing(
    driver, link, text, len, accessToken, jsonData, todayJsonData, username
  );
}

// Processes JSON messages one by one and alternates to bot message processing after each JSON message
async function processJsonAndBotMessages(driver, jsonMessages, len, accessToken, jsonData, todayJsonData) {
  try {
    // Process JSON messages if present
    if (jsonMessages.length > 0) {
      logger.info("Starting JSON message processing", { functionName: 'processJsonAndBotMessages' });

      for (let i = 0; i < jsonMessages.length; i++) {
        const message = jsonMessages[i];
        logger.info(`Processing JSON message #${i + 1}`, { functionName: 'processJsonAndBotMessages' });

        const { text, links } = extractTextAndLinks(message);
        for (const link of links) {
          await handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData);
          // messagesQueue.shift();
        }

        // Process bot messages after each JSON message
        await processBotMessages(driver, len, accessToken, jsonData, todayJsonData);
      }

      logger.info("Completed JSON message processing", { functionName: 'processJsonAndBotMessages' });
    } else {
      logger.info("No JSON messages found. Skipping JSON processing.", { functionName: 'processJsonAndBotMessages' });
    }

    // Move to continuous bot message processing
    await continuouslyProcessBotMessages(driver, len, accessToken, jsonData, todayJsonData);
  } catch (error) {
    logger.error("Error in processJsonAndBotMessages", { functionName: 'processJsonAndBotMessages', error });
  }
  // finally {
  //   //   // Save the holdProducts to file
  //     try {
  //       fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2));
  //       console.log('Hold products saved to file.');
  //     } catch (error) {
  //       console.error('Error saving holdProducts to file:', error.message);
  //     }
  //   }
}

// Extracts text and links from a message
function extractTextAndLinks(message) {
  let text = "";
  const links = [];
  if (message && message.text_entities) {
    message.text_entities.forEach(entity => {
      if (entity.type === "link") {
        links.push(entity.text);
      } else {
        text += `${entity.text} `;
      }
    });
  }
  return { text: text.trim(), links };
}

async function loadHoldProducts() {
  try {
    if (fs.existsSync(holdProductsFilePath)) {
      const data = fs.readFileSync(holdProductsFilePath, 'utf-8');
      holdProducts = JSON.parse(data);
      console.log('Loaded held products from file.');
    } else {
      console.log('No existing hold products file found.');
    }
  } catch (error) {
    console.error('Error reading hold products file:', error.message);
  }
}

// Save held products to JSON file
function saveHoldProducts() {
  try {
    fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2), 'utf-8');
    console.log('Saved hold products to file.');
  } catch (error) {
    console.error('Error saving hold products file:', error.message);
  }
}

async function processHoldProducts(driver, len, accessToken, jsonData, todayJsonData) {
  if (holdProducts.length === 0) {
    await loadHoldProducts(); // Load products from file if the array is empty
  }

  if (holdProducts.length > 0) {
    const product = holdProducts.shift(); // Remove the first product
    try {
      await driver.get(product?.productUrl);
      await processProduct(driver, product?.productUrl, product?.name || product?.urltext, len, accessToken, jsonData, todayJsonData, false, undefined, undefined, undefined, product?.categoryOverride);
      console.log(`Processed held product: ${product.name}`);
      saveHoldProducts();
    } catch (error) {
      console.error('Error processing held product:', product.name, error.message);
      holdProducts.push(product); // Re-add product if processing fails
      saveHoldProducts();
    }
  }
}

// Processes messages from the bot's queue
async function processBotMessages(driver, len, accessToken, jsonData, todayJsonData) {
  let missedSearchLinks;
  // Fetch new bot messages
  try {
    logger.info("Polling Telegram bot for messages...", { functionName: 'processBotMessages' });
    console.log('[bot] polling for messages...');

    let messagesToProcess = [];
    // messagesToProcess = await processMessagesQueue();

    messagesToProcess = await getNewBotMessages();
    logger.info(`Fetched ${messagesToProcess.length} messages from bot queue`, { functionName: 'processBotMessages' });
    console.log(`[bot] fetched ${messagesToProcess.length} messages from bot queue`);

    const now = Date.now();
    const dueForBulk = constants.enableBulkProcessing && ((now - lastBulkRunAt) >= EFFECTIVE_INTERVAL);
    const scheduledBulk = constants.enableBulkProcessing && isTimeForScheduledBulk();
    
    const maybeRunBulk = async (isIdle) => {
      if (isBulkRunning) return;
      
      // Check if it's time for scheduled bulk OR if idle and due for regular bulk
      const shouldRun = constants.enableBulkProcessing && (scheduledBulk || (isIdle && dueForBulk));
      if (!shouldRun) return;
      
      isBulkRunning = true;
      const start = Date.now();
      try {
        logger.info(`Bulk update starting (isIdle=${isIdle})`, { functionName: 'processBotMessages' });
        // RE-ENABLED AFTER FIXING productDealsDB.js
        await runBulkUpdateAll('website');
        logger.info('Bulk update ENABLED and completed', { functionName: 'processBotMessages' });

        // Enrichment pass for missing critical fields
        const snapshot = await productDealsDB.ref.once('value');
        const records = snapshot.val() || {};
        let enrichedCount = 0;
        for (const [key, record] of Object.entries(records)) {
          if (!record || !record.productUrl) continue;
          const missingCritical = !record.brand || !record.title || !record.price || !record.photo;
          if (!missingCritical) continue;
          try {
            await handleProductProcessing(driver, record.productUrl, record.productText || record.urltext || '', 0, '', {}, {}, 'dealsglobalhub');
            enrichedCount += 1;
          } catch (e) {
            logger.warn('Enrichment error for record', { key, error: e?.message });
          }
        }
        const dur = Date.now() - start;
        logger.info(`Bulk update complete in ${dur}ms, enriched=${enrichedCount}`, { functionName: 'processBotMessages' });
      } catch (e) {
        logger.error('Bulk update failed in bot loop', { functionName: 'processBotMessages', error: e?.message });
      } finally {
        // Backup current state to previous state before updating
        await backupCurrentStateToPrevious();
        
        // Update database state
        await updateLastBulkRun();
        await updateLastUpdatedScheduler();
        lastBulkRunAt = Date.now();
        isBulkRunning = false;
      }
    };

    if (messagesToProcess.length === 0) {
      logger.info("No new bot messages to process", { functionName: 'processBotMessages' });
      console.log('[bot] no new messages to process');
      // small delay matches polling window and provides explicit heartbeat
      await new Promise(r => setTimeout(r, 500));
      // If not time for bulk, enrich today's records using productUrl
      if (!dueForBulk) {
        try {
          // Use todayJsonData passed from caller instead of calling firebaseget()
          const todayMap = todayJsonData || {};
          const todaysKeys = Object.keys(todayMap);
          let processed = 0;
          for (const key of todaysKeys) {
            const record = todayMap[key];
            if (!record || !record.productUrl) continue;
            const missingCritical = !record.brand || !record.title || !record.price || !record.photo;
            if (!missingCritical) continue;
            try {
              await handleProductProcessing(driver, record.productUrl, record.productText || record.urltext || '', 0, '', {}, {}, 'dealsglobalhub');
              processed += 1;
              if (processed >= 20) break; // cap per idle cycle
            } catch (e) {
              logger.warn('Idle enrichment error for today record', { key, error: e?.message });
            }
          }
          logger.info(`Idle enrichment done. processed=${processed}`, { functionName: 'processBotMessages' });
        } catch (e) {
          logger.warn('Idle enrichment fetch failed', { error: e?.message });
        }
      } else {
        await maybeRunBulk(true);
      }

      // Check for urgent favorites notifications if it's time
      if (isTimeForUrgentFavoritesCheck()) {
        const urgentResult = await processUrgentFavoritesNotifications();
        if (urgentResult.success) {
          logger.info('Urgent favorites notifications processed', { 
            checked: urgentResult.checked,
            notified: urgentResult.notified 
          });
        }
      }
      await processHoldProducts(driver, len, accessToken, jsonData, todayJsonData)
      return;
    }

    // Process each message from the queue

    for (const message of messagesToProcess) {
      const { link, plainText, username } = message;

      if(plainText == "") {
        console.log("Just url - Skipping(from extrape extra) ");
        continue;
      }

      // Check if 'link' is an array
      if (Array.isArray(link)) {
        for (const indilink of link) {
          value = await handleProductProcessing(driver, indilink, plainText, len, accessToken, jsonData, todayJsonData, username);
          if (value == searchStatus.SEARCH_ERROR) {
            //missed search links logic
            missedSearchLinks += link + "\n";
          } else if (value == productStatus.PRODUCT_ERROR) {
            //missed product links logic
            missedLinks += link + "\n";

          }
          messagesToProcess.shift();
        }
      } else if (typeof link === 'string') {
        // Handle case where 'link' is a single string
        value = await handleProductProcessing(driver, link, plainText, len, accessToken, jsonData, todayJsonData, username);
        if (value == searchStatus.SEARCH_ERROR) {
          //missed search links logic
          missedSearchLinks += link + "\n";

        } else if (value == productStatus.PRODUCT_ERROR) {
          //missed product links logic
          missedLinks += link + "\n";
        }
        messagesToProcess.shift();
      } else {
        // Log an error if the link is not valid
        logger.error("Invalid link format in message", { functionName: 'processMessages', link });
      }


    }
    messagesToProcess = [];

    // After batch, if scheduled time or due, trigger bulk in background so we keep latency low for next poll
    // Do not await to avoid blocking bot processing
    // Safe-guard: only one bulk at a time
    if (!isBulkRunning && (scheduledBulk || (Date.now() - lastBulkRunAt) >= EFFECTIVE_INTERVAL)) {
      // Fire and forget
      maybeRunBulk(false);
    }

    // Periodic health log (once per minute)
    if (Date.now() - lastHealthLogAt > 60_000) {
      lastHealthLogAt = Date.now();
      logger.info('Bot loop healthy', { functionName: 'processBotMessages', isBulkRunning, sinceLastBulkMs: Date.now() - lastBulkRunAt });
    }
  } catch (e) {
    console.log("ProcessBotMessage error ", e);
  }
}


// Main function to get Telegram deal link, sequentially handling JSON and bot messages
async function getTelegramDealLink(driver, len = 0, jsonData = {}, todayJsonData = {}) {
  try {
    // Initialize state from database first
    await initializeState();
    
    // Data is now passed as parameters instead of calling firebaseget() multiple times
    let formattedDate = getformattedDate();
    const jsonFilePath = `C:/Users/avina/AppData/Roaming/Telegram Desktop/tdata/tdummy/tr9 deals/ChatExport_${formattedDate}/result.json`; // Specify the correct path
    const jsonMessages = await readJsonFile(jsonFilePath)?.messages || [];

    await initializeBot();
    await processJsonAndBotMessages(driver, jsonMessages, len, "", jsonData, todayJsonData);
  } catch (error) {
    logger.error("Error in getTelegramDealLink", { functionName: 'getTelegramDealLink', error });
  } finally {
    saveHoldProducts();
    logger.info("Completed Telegram deal link processing", { functionName: 'getTelegramDealLink' });
    console.log("missedLinks are ", missedLinks);
    console.log("\n");
    console.log("missedSearchLinks are ", missedSearchLinks);
  }
}

// Continuously check for new bot messages
async function continuouslyProcessBotMessages(driver, len, accessToken, jsonData, todayJsonData) {
  try {
    if (!constants.enableTelegramProcessing) {
      logger.warn("Telegram processing disabled via flag", { functionName: 'continuouslyProcessBotMessages' });
      return;
    }
    
    // Set the global driver for queue processing
    setDriver(driver);
    
    logger.info("Starting continuous bot message processing", { functionName: 'continuouslyProcessBotMessages' });
    if (constants.notifications && constants.notifications.enableFavoritesService === false) {
      logger.info('Favorites service disabled via flag. Telegram-only mode.');
    } else {
      logger.info('Favorites service enabled. Processing interval:', {
        favoritesProcessingInterval: `${FAVORITES_PROCESSING_INTERVAL / 1000}s`,
        urgentCheckInterval: `${FAVORITES_URGENT_CHECK_INTERVAL / 1000}s`
      });
    }
    let loop = 0;

    // Check if we should run in continuous mode or finite mode
    const isContinuousMode = constants.telegramMode === 'continuous' || !constants.telegramMode;
    let shouldContinue = true;
    const maxLoops = isContinuousMode ? Infinity : 5; // Run 5 loops in finite mode
    
    logger.info(`Running in ${isContinuousMode ? 'continuous' : 'finite'} mode`, { 
      functionName: 'continuouslyProcessBotMessages',
      maxLoops: isContinuousMode ? 'unlimited' : maxLoops
    });
    
    while (shouldContinue && loop < maxLoops) {
      loop += 1;
      try {
        await processBotMessages(driver, len, accessToken, jsonData, todayJsonData);
        logger.info(`Bot loop tick #${loop} complete`, { functionName: 'continuouslyProcessBotMessages' });

        // Monitor for performance issues (e.g., clear cache if needed)
        if (shouldClearCache()) {
          await clearBrowserCache(driver);
          logger.info("Browser cache cleared for performance optimization", { functionName: 'continuouslyProcessBotMessages' });
        }
        
        // Idle time processing when no new messages
        await idleProcessingService.processIdleTime(driver);
        
        // Check if it's time for favorites processing
        if (isTimeForFavoritesProcessing()) {
          const favoritesResult = await processFavoritesNotifications();
          if (favoritesResult.success) {
            logger.info('Favorites processing completed in main loop', { 
              duration: favoritesResult.duration 
            });
          }
        }
        
        // Add a small delay to prevent excessive CPU usage
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error("Error in bot message processing loop", { functionName: 'continuouslyProcessBotMessages', error });
        
        // Check for network errors and add retry logic
        if (error.message && (
          error.message.includes('ENOTFOUND') || 
          error.message.includes('ETIMEDOUT') || 
          error.message.includes('ECONNRESET') ||
          error.message.includes('FATAL')
        )) {
          logger.warn("Network error detected, waiting before retry", { error: error.message });
          const delayMs = error.message.includes('FATAL') ? 60000 : 30000; // 1 min for fatal, 30s for network
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // If it's a fatal error, stop the loop
          if (error.message.includes('FATAL')) {
            shouldContinue = false;
          }
        }
      }
    }
  } catch (error) {
    logger.error("Error in continuouslyProcessBotMessages", { functionName: 'continuouslyProcessBotMessages', error });
  }
}

// Placeholder function for clearing browser cache
async function clearBrowserCache(driver) {
  try {
    await driver.executeScript("window.localStorage.clear(); window.sessionStorage.clear();");
    logger.info("Successfully cleared browser cache", { functionName: 'clearBrowserCache' });
  } catch (error) {
    logger.warn("Failed to clear browser cache", { functionName: 'clearBrowserCache', error });
  }
}

// Check if cache clearing is needed (placeholder logic)
function shouldClearCache() {
  // Replace with real logic to detect performance issues
  return false;
}


// Placeholder for fallback function
async function fallbackFunction() {
  // TODO: Implement functionality to fetch fallback data with multiple URLs and attributes
  return []; // Returns array of objects with link, text, and optional attributes like coupon, deal names
}

module.exports = { getTelegramDealLink, handleProductProcessing: handleProductProcessingShim, continuouslyProcessBotMessages };

// Orchestrator: runs Telegram continuously and triggers bulk update on a schedule
async function startTelegramAndBulkOrchestrator(driver, intervalMs) {
  try {
    if (orchestratorStarted) return;
    orchestratorStarted = true;
    const fallbackInterval = 60 * 60 * 1000; // 1 hour
    let effectiveInterval = Number(intervalMs || constants.bulkUpdateIntervalMs || fallbackInterval);
    if (!Number.isFinite(effectiveInterval) || effectiveInterval < 60_000) {
      effectiveInterval = fallbackInterval;
    }

    // Start favorites notification service
    favoritesNotificationService.start();

    // Periodic bulk update + enrichment loop
    let shouldContinue = true;
    while (shouldContinue) {
      try {
        logger.info(`Starting scheduled tasks (interval: ${effectiveInterval} ms)`, { functionName: 'startTelegramAndBulkOrchestrator' });

        // 1. Run bulk update to productdeals database (website scraping) with timeout and flag
        if (constants.enableBulkProcessing) {
          const bulkTask = runBulkUpdateAll('website', 'productdeals');
          const bulkTimed = Promise.race([
            bulkTask,
            new Promise((_, reject) => setTimeout(() => reject(new Error('PLATFORM_TIMEOUT')), constants.maxPlatformTimeoutMs))
          ]);
          try {
            await bulkTimed;
            logger.info('Bulk update completed for website scraping', { functionName: 'startTelegramAndBulkOrchestrator' });
          } catch (e) {
            if (String(e.message).includes('PLATFORM_TIMEOUT')) {
              logger.error('Bulk update timed out at platform/category level', { timeoutMs: constants.maxPlatformTimeoutMs });
            } else {
              throw e;
            }
          }
        } else {
          logger.warn('Bulk processing disabled via flag', { functionName: 'startTelegramAndBulkOrchestrator' });
        }
        
        // 2. Run bulk update to deals database (Telegram processing) at :30 mark
        // RE-ENABLED AFTER FIXING productDealsDB.js
        const now = new Date();
        if (constants.enableBulkProcessing && now.getMinutes() >= 30) {
          const teleBulkTask = runBulkUpdateAll('telegram', 'deals');
          const teleBulkTimed = Promise.race([
            teleBulkTask,
            new Promise((_, reject) => setTimeout(() => reject(new Error('PLATFORM_TIMEOUT')), constants.maxPlatformTimeoutMs))
          ]);
          try {
            await teleBulkTimed;
          } catch (e) {
            if (String(e.message).includes('PLATFORM_TIMEOUT')) {
              logger.error('Telegram deals bulk timed out', { timeoutMs: constants.maxPlatformTimeoutMs });
            } else {
              throw e;
            }
          }
        }

        // 3. Process favorites and notifications (configurable interval)
        const favoritesResult = await processFavoritesNotifications();
        if (favoritesResult.success) {
          logger.info('Orchestrator favorites processing completed', { 
            duration: favoritesResult.duration 
          });
        } else if (favoritesResult.reason !== 'disabled') {
          logger.warn('Orchestrator favorites processing failed', { 
            error: favoritesResult.error 
          });
        }

        // 4. Idle time processing for both databases
        await idleProcessingService.processIdleTime(driver);
        
        // 5. Deal expiry tracking
        await idleProcessingService.processDealExpiryTracking();

      } catch (e) {
        logger.error('Scheduled bulk update failed', { error: e?.message });
        // Check if it's a fatal error that should stop the loop
        if (e.message && (e.message.includes('FATAL') || e.message.includes('network') || e.message.includes('timeout'))) {
          logger.error('Fatal error detected, stopping orchestrator', { error: e?.message });
          shouldContinue = false;
        } else {
          // Add delay before retrying for non-fatal errors
          logger.info('Adding delay before retry due to error', { error: e?.message });
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay
        }
      }

      // Add a check for graceful shutdown
      if (shouldContinue) {
        await new Promise(r => setTimeout(r, effectiveInterval));
      }
    }
  } catch (e) {
    logger.error('startTelegramAndBulkOrchestrator fatal', { error: e?.message });
  }
}

module.exports.startTelegramAndBulkOrchestrator = startTelegramAndBulkOrchestrator;

// Start orchestrator from inside Telegram flows
// 1) After processing JSON and bot messages the first time
const _originalProcessJsonAndBotMessages = processJsonAndBotMessages;
processJsonAndBotMessages = async function(driver, jsonMessages, len, accessToken, jsonData, todayJsonData) {
  await _originalProcessJsonAndBotMessages(driver, jsonMessages, len, accessToken, jsonData, todayJsonData);
  try {
    await startTelegramAndBulkOrchestrator(driver, constants.bulkUpdateIntervalMs);
  } catch (e) {
    logger.error('Failed starting orchestrator after JSON processing', { error: e?.message });
  }
};

// 2) Ensure orchestrator is started when processing bot messages loop kicks in
const _originalProcessBotMessages = processBotMessages;
processBotMessages = async function(driver, len, accessToken, jsonData, todayJsonData) {
  if (!orchestratorStarted) {
    try { await startTelegramAndBulkOrchestrator(driver, constants.bulkUpdateIntervalMs); } catch (_) {}
  }
  return _originalProcessBotMessages(driver, len, accessToken, jsonData, todayJsonData);
};
