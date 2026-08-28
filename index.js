process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct } = require("./scrappers/amazon")
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { postDeals } = require("./postdeals");
const { firebase } = require("googleapis/build/src/apis/firebase");
const { firebaseget } = require("./database/firebaseget");
const { firebasepost } = require("./database/firebasepost");

const config = require('./config/config');
const { getTelegramDealLink, continuouslyProcessBotMessages } = require("./dataSources/telegram");
const constants = require('./config/constants');
const { getSpeedDeals } = require("./dataSources/speedDeals");
const Zerodha = require("./Stock/Portal/Zerodha");
const zerodhaHoldings = require("./Stock/Portal/zerodhaHoldings");
const whatsappLastMessage = require("./socialMedia/whatsappLastMsg");
const whatsappLastMessageByHtml = require("./socialMedia/whatsappLastMsgByHtml");
const tableExtract = require("./XAlpha/tableExtract");
const { processAllInstruments } = require("./dataSources/stock");
const { readUrlsFromTxt } = require("./dataSources/textFile");
const { initializeBot, continuousProcess } = require("./dataSources/autoTelegramAll");
const extractFacebookToken = require("./socialMedia/extractFacebookToken");
const { bannerScheduler } = require("./scheduler/bannerScheduler");
const ProcessLock = require("./utils/processLock");
const { systemHealthMonitor } = require("./services/systemHealthMonitor");
const { idleProcessingService } = require("./services/idleProcessingService");
const { hierarchicalEnrichmentService } = require("./services/hierarchicalEnrichmentService");
const { productUrlFixer } = require("./services/productUrlFixer");
const { getModuleLogger } = require("./logger/logger");
const { runBulkUpdateAll } = require("./scripts/bulkUpdateAllPlatforms");

require("events").EventEmitter.defaultMaxListeners = 20;

// Global variables for cleanup
let driver = null;
let isShuttingDown = false;
let processLock = null;
const logger = getModuleLogger('main');

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT. Shutting down gracefully...');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM. Shutting down gracefully...');
  await gracefulShutdown();
});

process.on('uncaughtException', async (error) => {
  logger.error('💥 Uncaught Exception:', { 
    error: error.message, 
    stack: error.stack,
    fixSteps: systemHealthMonitor.getFixSteps('unknown_error').steps
  });
  
  // Record the critical failure
  systemHealthMonitor.recordFailure('main', error, {
    phase: 'uncaught_exception',
    timestamp: new Date().toISOString()
  });
  
  await gracefulShutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('💥 Unhandled Rejection:', { 
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    fixSteps: systemHealthMonitor.getFixSteps('unknown_error').steps
  });
  
  // Record the critical failure
  systemHealthMonitor.recordFailure('main', new Error(reason), {
    phase: 'unhandled_rejection',
    timestamp: new Date().toISOString()
  });
  
  await gracefulShutdown();
});

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  const shutdownStartTime = Date.now();
  logger.info("🔄 Performing graceful shutdown...");
  
  try {
    // Close browser driver
    if (driver) {
      logger.info("🔒 Closing browser driver...");
      await driver.quit();
      logger.info("✅ Browser driver closed successfully");
    }
  } catch (error) {
    logger.error("❌ Error closing driver:", { 
      error: error.message,
      fixSteps: systemHealthMonitor.getFixSteps('selenium_driver_failed').steps
    });
  }
  
  // Release process lock
  if (processLock) {
    try {
      processLock.release();
      logger.info("🔓 Process lock released");
    } catch (error) {
      logger.error("❌ Error releasing process lock:", { error: error.message });
    }
  }
  
  // Perform final system health check
  try {
    logger.info("🏥 Performing final system health check...");
    const finalHealthReport = await systemHealthMonitor.performHealthCheck();
    logger.info("📊 Final system status:", { 
      overallStatus: finalHealthReport.overallStatus,
      criticalIssues: finalHealthReport.criticalIssues.length
    });
  } catch (error) {
    logger.error("❌ Error during final health check:", { error: error.message });
  }
  
  const shutdownDuration = Date.now() - shutdownStartTime;
  logger.info("✅ Shutdown complete", { duration: `${shutdownDuration}ms` });
  process.exit(0);
}



let type = constants.type // deploy in all places
let source = constants.source // deploy in all places
let postflag = false;

// async function openAmazonWebsite(link) {
async function openAmazonWebsite() {
  const appStartTime = Date.now();
  const sessionId = `session_${Date.now()}`;
  
  logger.info('🚀 Starting DealsOptimised Application', {
    sessionId,
    type: constants.type,
    source: constants.source,
    env: constants.env,
    timestamp: new Date().toISOString()
  });

  try {
    // Perform initial system health check
    logger.info('🏥 Performing initial system health check...');
    const initialHealthReport = await systemHealthMonitor.performHealthCheck();
    
    if (initialHealthReport.overallStatus === 'critical') {
      logger.error('🚨 Critical system issues detected. Aborting startup.', {
        sessionId,
        criticalIssues: initialHealthReport.criticalIssues.length,
        fixSteps: initialHealthReport.criticalIssues.map(issue => issue.fixSteps?.steps || [])
      });
      process.exit(1);
    }

    // Check for process lock to prevent multiple instances
    logger.info('🔒 Acquiring process lock...');
    processLock = new ProcessLock();
    const lockAcquired = await processLock.acquire();
    if (!lockAcquired) {
      logger.warn('⚠️ Another instance is already running. Exiting...', { sessionId });
      process.exit(1);
    }
    processLock.setupCleanup();
    logger.info('✅ Process lock acquired successfully');

    // Initialize Chrome driver
    logger.info('🌐 Initializing Chrome WebDriver...');
    // require("chromedriver");
    var chrome = require("selenium-webdriver/chrome");
    let options = await new chrome.Options();
    let product = {}

    // Add headless mode
    // options.addArguments("--headless"); // Enable headless mode
    // options.addArguments("--disable-gpu"); // Recommended for Windows
    // // options.addArguments("--no-sandbox"); // Recommended for Linux
    // options.addArguments("--disable-dev-shm-usage"); // Prevent resource issues in some systems

    options.debuggerAddress("localhost:9222"); // Connect to existing Chrome instance with login session

    //CHROME
    driver = await chrome.Driver.createSession(options);
    global.driver = driver; // Make driver globally available
    let env = constants.env;
    
    logger.info('✅ Chrome WebDriver initialized successfully', {
      sessionId,
      debuggerAddress: 'localhost:9222',
      env
    });


  if (source == "deals") {
    logger.info('📊 Processing deals source', { sessionId, type });

    switch (type) {
      case "general":
        logger.info('🔄 Processing general type', { sessionId, generalType: constants.generaltype });
        
        switch (constants.generaltype) {
          case "bulkUpdate":
            logger.info('📦 Starting Bulk Update processing', { sessionId });
            
            try {
              logger.info('🚀 Starting bulk updates (all platforms)...', { sessionId });
              const result = await runBulkUpdateAll('website', 'productdeals');
              logger.info('✅ Bulk updates completed successfully', { 
                sessionId,
                totalPlatforms: result.totalPlatforms,
                successfulPlatforms: result.successfulPlatforms,
                totalProducts: result.totalProducts,
                successRate: result.successRate
              });
            } catch (error) {
              logger.error('❌ Error in bulk updates:', { 
                sessionId,
                error: error.message,
                stack: error.stack,
                fixSteps: systemHealthMonitor.getFixSteps('bulk_update_failed').steps
              });
              
              systemHealthMonitor.recordFailure('main', error, {
                sessionId,
                phase: 'bulk_update_processing'
              });
            }
            break;
          case "telegramFile":
            logger.info('📱 Starting Telegram file processing', { sessionId });
            
            // Get initial data once
            let len = 0;
            let jsonData = {};
            let todayJsonData = {};
            
            try {
              logger.info('📥 Fetching initial data from Firebase...', { sessionId });
              const result = await firebaseget();
              jsonData = result.data || {};
              len = result.len || 0;
              logger.info('✅ Initial data fetched successfully', { 
                sessionId, 
                dataLength: len,
                recordsCount: Object.keys(jsonData).length 
              });
            } catch (error) {
              logger.error('❌ Error getting initial data:', { 
                sessionId,
                error: error.message,
                stack: error.stack,
                fixSteps: systemHealthMonitor.getFixSteps('database_connection_failed').steps
              });
              
              systemHealthMonitor.recordFailure('main', error, {
                sessionId,
                phase: 'fetch_initial_data'
              });
            }
            
            try {
              logger.info('📥 Fetching today\'s data from Firebase...', { sessionId });
              const todayResult = await firebaseget(true);
              todayJsonData = todayResult.data || {};
              logger.info('✅ Today\'s data fetched successfully', { 
                sessionId,
                recordsCount: Object.keys(todayJsonData).length 
              });
            } catch (error) {
              logger.error('❌ Error getting today\'s data:', { 
                sessionId,
                error: error.message,
                stack: error.stack,
                fixSteps: systemHealthMonitor.getFixSteps('database_connection_failed').steps
              });
              
              systemHealthMonitor.recordFailure('main', error, {
                sessionId,
                phase: 'fetch_todays_data'
              });
            }
            
            try {
              logger.info('🚀 Starting Telegram deal link processing...', { sessionId });
              await getTelegramDealLink(driver, len, jsonData, todayJsonData);
              logger.info('✅ Telegram deal link processing completed', { sessionId });
            } catch (error) {
              logger.error('❌ Error in Telegram deal link processing:', { 
                sessionId,
                error: error.message,
                stack: error.stack,
                fixSteps: systemHealthMonitor.getFixSteps('product_extraction_failed').steps
              });
              
              systemHealthMonitor.recordFailure('main', error, {
                sessionId,
                phase: 'telegram_deal_processing'
              });
            }
            break;
          case "urlsFile":
            // Get initial data once
            let urlsLen = 0;
            let urlsJsonData = {};
            let urlsTodayJsonData = {};
            try {
              const result = await firebaseget();
              urlsJsonData = result.data || {};
              urlsLen = result.len || 0;
            } catch (error) {
              console.log("Error getting initial data:", error);
            }
            try {
              const todayResult = await firebaseget(true);
              urlsTodayJsonData = todayResult.data || {};
            } catch (error) {
              console.log("Error getting today's data:", error);
            }
            await readUrlsFromTxt(driver, urlsLen, urlsJsonData, urlsTodayJsonData);
            break;
          case "telegramBot":
            // Initialize required parameters for Telegram bot processing
            let botLen = 0;
            let accessToken = "";
            let botJsonData = {};
            let botTodayJsonData = {};
            
            // Get initial data
            try {
              const result = await firebaseget();
              botJsonData = result.data || {};
              botLen = result.len || 0;
            } catch (error) {
              console.log("Error getting initial data:", error);
            }
            
            try {
              const todayResult = await firebaseget(true);
              botTodayJsonData = todayResult.data || {};
            } catch (error) {
              console.log("Error getting today's data:", error);
            }
            
            console.log("Starting Telegram bot processing with driver and data...");
            await continuouslyProcessBotMessages(driver, botLen, accessToken, botJsonData, botTodayJsonData);
            logger.info("Telegram bot processing completed, continuing to other scenarios...", { sessionId });
            // await continuousProcess(driver);
            // await initializeBot(driver);
            break;
        }
        
        // If bulk updates are enabled, run them now (sequentially to avoid driver contention)
        if (constants.enableBulkProcessing) {
          try {
            logger.info("Starting bulk updates (all platforms) as part of general flow...", { sessionId });
            await runBulkUpdateAll('website', 'productdeals');
            logger.info("Bulk updates completed", { sessionId });
          } catch (error) {
            logger.error("Bulk updates failed", {
              sessionId,
              error: error.message,
              stack: error.stack
            });
          }
        }

        // Continue to other processing scenarios after general processing
        logger.info("General processing completed, continuing to other scenarios...", { sessionId });
        
        // Run product URL verification and fixing if enabled
        if (constants.enableProductUrlFix) {
          try {
            logger.info("Starting product URL verification and fixing...", { sessionId });
            const urlFixResult = await productUrlFixer.fixAllProductUrls();
            if (urlFixResult.success) {
              logger.info("Product URL fixing completed successfully", { 
                sessionId,
                summary: urlFixResult.summary
              });
            } else {
              logger.error("Product URL fixing failed", { 
                sessionId,
                error: urlFixResult.error || urlFixResult.reason
              });
            }
          } catch (error) {
            logger.error("Error in product URL fixing:", { 
              sessionId,
              error: error.message,
              stack: error.stack
            });
          }
        } else {
          logger.info("Product URL fixing is disabled via flag", { sessionId });
        }
        
        // Run idle processing service
        try {
          logger.info("Starting idle processing service...", { sessionId });
          await idleProcessingService.runOnce(driver);
          logger.info("Idle processing service completed", { sessionId });
        } catch (error) {
          logger.error("Error in idle processing service:", { 
            sessionId,
            error: error.message,
            stack: error.stack
          });
        }
        
        // Run hierarchical enrichment service
        try {
          logger.info("Starting hierarchical enrichment service...", { sessionId });
          await hierarchicalEnrichmentService.runOnce();
          logger.info("Hierarchical enrichment service completed", { sessionId });
        } catch (error) {
          logger.error("Error in hierarchical enrichment service:", { 
            sessionId,
            error: error.message,
            stack: error.stack
          });
        }
        
        // Run favorites notification service if enabled
        if (constants.notifications?.enableFavoritesService) {
          try {
            logger.info("Starting favorites notification service...", { sessionId });
            const favoritesResult = await require("./services/favoritesNotificationService").favoritesNotificationService.runOnce();
            logger.info("Favorites notification service completed", { 
              sessionId,
              result: favoritesResult
            });
          } catch (error) {
            logger.error("Error in favorites notification service:", { 
              sessionId,
              error: error.message,
              stack: error.stack
            });
          }
        }
        
        logger.info("All processing scenarios completed successfully", { sessionId });
        break;
      case "productlinks":
        await runExcelFunction();
        break;
      case "textfilelinks":
        await readUrlsFromTxt();
        break;
      case "telegrambot":
        await initializeBot(driver);
        break;
      case "speedDeals":
        await getSpeedDeals();
        break;
      case "banners":
        // Start banner extraction scheduler
        await bannerScheduler.start();
        console.log("Banner scheduler started");
        break;
      default:
        console.log("Invalid type specified");
    }
  }
  else if (source == "stocks") {

    await processAllInstruments(driver);
    // await Zerodha(driver);
    // await zerodhaHoldings(driver);

    // await tableExtract(driver);

    // await whatsappLastMessage(driver);
    // await whatsappLastMessageByHtml(driver);
    // let { message, timestamp } = await whatsappLastMessageByHtml(driver);
    // if (message && timestamp) {
    //   console.log("in index")
    //   console.log('Last message:', message);
    //   console.log('Timestamp:', timestamp);
    // } else {
    //     console.log('No message or timestamp found.');
    // } 

    // let details = await whatsappLastMessageByHtml(driver);
    // console.log("Details in index are :",details);

  }




  // if(product.discount > 75){
  //   if(env=="prod"){
  //     telegram(photo, "@dealshubglobal2", t1);

  //   } else if(env=="stage") {
  //     telegram(photo, "", t1);

  //   }
  //   whatsapp("DSyvXzBJuax5uJ6MFylXJk",text);
  //   fbdata = facebook(photo, link, itemText);
  // }
  // else{
  //   if(env=="prod"){
  //     telegram(photo, "@dealshubglobal", t1);

  //   } else if(env=="stage") {
  //     telegram(photo, "@all1apptest", t1);

  //   }
  //   whatsapp("Kzl4DB4yCXzJaaCP0Lrf1G",text);
  //   }

  // Log successful completion
  const appDuration = Date.now() - appStartTime;
  logger.info('✅ Application completed successfully', {
    sessionId,
    duration: `${appDuration}ms`,
    type,
    source
  });

  } catch (error) {
    const appDuration = Date.now() - appStartTime;
    logger.error('💥 Critical error in main application', {
      sessionId,
      duration: `${appDuration}ms`,
      error: error.message,
      stack: error.stack,
      type,
      source,
      fixSteps: systemHealthMonitor.getFixSteps('unknown_error').steps
    });
    
    // Record the critical failure
    systemHealthMonitor.recordFailure('main', error, {
      sessionId,
      phase: 'main_application_loop',
      duration: appDuration
    });
    
    // Perform emergency health check
    try {
      const emergencyHealthReport = await systemHealthMonitor.performHealthCheck();
      logger.error('🚨 Emergency health check results:', {
        sessionId,
        overallStatus: emergencyHealthReport.overallStatus,
        criticalIssues: emergencyHealthReport.criticalIssues.length
      });
    } catch (healthError) {
      logger.error('❌ Emergency health check failed:', { 
        sessionId,
        error: healthError.message 
      });
    }
    
  } finally {
    // Graceful shutdown
    logger.info("🔄 Shutting down gracefully...", { sessionId });
    try {
      if (driver) {
        await driver.quit();
        logger.info("✅ Browser driver closed successfully", { sessionId });
      }
    } catch (error) {
      logger.error("❌ Error closing driver:", { 
        sessionId,
        error: error.message,
        fixSteps: systemHealthMonitor.getFixSteps('selenium_driver_failed').steps
      });
    }
    
    // Release process lock
    if (processLock) {
      try {
        processLock.release();
        logger.info("🔓 Process lock released", { sessionId });
      } catch (error) {
        logger.error("❌ Error releasing process lock:", { 
          sessionId,
          error: error.message 
        });
      }
    }
    
    logger.info("✅ Shutdown complete", { sessionId });
    process.exit(0);
  }
}

// link = "https://amzn.eu/d/8309kez"
// link = "https://fkrt.co/OGiA5g"



openAmazonWebsite();
// await getTelegramDealLink();
// getTelegramDealLink();




