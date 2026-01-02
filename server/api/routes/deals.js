const express = require('express');
const router = express.Router();
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');
const { runBulkUpdateAll } = require('../../../scripts/bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../../../logger/logger');
const cacheService = require('../../../services/cacheService');

const logger = getModuleLogger('deals-api');

/**
 * GET /api/deals
 * List all deals with optional filters
 * Query params: dealType (hotDeal|productDeal), platform, limit, offset
 */
router.get('/', async (req, res, next) => {
  try {
    const { dealType, platform, limit = 100, offset = 0 } = req.query;
    
    // Create cache key
    const cacheKey = `deals_${dealType || 'all'}_${platform || 'all'}_${limit}_${offset}`;
    
    // Check cache first (increased TTL to 10 minutes for deals)
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deals', { cacheKey });
      return res.json(cached);
    }
    
    // Determine which database to query
    const targetDb = dealType === 'hotDeal' ? 'deals' : 'productdeals';
    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    
    const snapshot = await ref.once('value');
    let deals = snapshot.val() || {};
    
    // Convert to array and filter
    let dealsArray = Object.entries(deals).map(([key, value]) => ({
      productCode: key,
      ...value
    }));

    // Filter by platform if specified
    if (platform) {
      dealsArray = dealsArray.filter(deal => 
        deal.storeType?.toLowerCase() === platform.toLowerCase()
      );
    }

    // Sort by timestamp in descending order (newest first)
    // Priority: updatedatetime > datetime > updateTimestamp > 0
    dealsArray.sort((a, b) => {
      const aTime = Number(a.updatedatetime || a.datetime || a.updateTimestamp || 0);
      const bTime = Number(b.updatedatetime || b.datetime || b.updateTimestamp || 0);
      return bTime - aTime; // Descending order (newest first)
    });

    // Apply pagination
    const total = dealsArray.length;
    const paginated = dealsArray.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Get notification statuses for paginated deals
    const dealsWithNotifications = await Promise.all(
      paginated.map(async (deal) => {
        const notificationStatus = await notificationTrackingDB.getNotificationStatus(deal.productCode);
        return {
          ...deal,
          notificationStatus: notificationStatus || null
        };
      })
    );

    const response = {
      success: true,
      data: dealsWithNotifications,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      dealType: dealType || 'all',
      database: targetDb
    };
    
    // Cache the response for 10 minutes (increased from 2 minutes to reduce DB load)
    cacheService.set(cacheKey, response, 10 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching deals', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/deals/:productCode
 * Get specific deal by product code
 */
router.get('/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'deals' } = req.query; // Allow specifying db: deals or productdeals
    
    // Check cache first (increased TTL to 10 minutes)
    const cacheKey = `deal_${productCode}_${db}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deal', { productCode });
      return res.json(cached);
    }
    
    const targetRef = db === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    const snapshot = await targetRef.child(safeKey).once('value');
    const deal = snapshot.val();
    
    if (!deal) {
      return res.status(404).json({ 
        success: false, 
        error: 'Deal not found' 
      });
    }

    // Get notification status
    const notificationStatus = await notificationTrackingDB.getNotificationStatus(productCode);

    const response = {
      success: true,
      data: {
        productCode,
        ...deal,
        notificationStatus
      }
    };
    
    // Cache for 10 minutes (increased from 5 minutes)
    cacheService.set(cacheKey, response, 10 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching deal', { productCode: req.params.productCode, error: error.message });
    next(error);
  }
});

/**
 * GET /api/deals/notifications/:productCode
 * Get notification status for a specific deal
 */
router.get('/notifications/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const status = await notificationTrackingDB.getNotificationStatus(productCode);
    
    if (!status) {
      return res.status(404).json({ 
        success: false, 
        error: 'No notification status found for this product' 
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching notification status', { productCode: req.params.productCode, error: error.message });
    next(error);
  }
});

/**
 * POST /api/deals/manual-trigger
 * Manually trigger bulk update
 */
router.post('/manual-trigger', async (req, res, next) => {
  try {
    const { sourceType = 'website', targetDb = 'productdeals' } = req.body;
    
    console.log(`\n[DEBUG] ========== Manual bulk update triggered ==========`);
    console.log(`[DEBUG] sourceType=${sourceType}, targetDb=${targetDb}`);
    logger.info('Manual bulk update triggered', { sourceType, targetDb });
    
    // Trigger bulk update (this is async, so we'll return immediately)
    runBulkUpdateAll(sourceType, targetDb)
      .then(result => {
        console.log(`[DEBUG] Manual bulk update completed:`, result);
        logger.info('Manual bulk update completed', result);
      })
      .catch(error => {
        console.error(`\n🚨 [DEBUG] Manual bulk update failed:`, error);
        console.error(`🚨 [DEBUG] Error stack:`, error.stack);
        logger.error('Manual bulk update failed', { 
          error: error.message,
          stack: error.stack,
          name: error.name
        });
      });

    res.json({
      success: true,
      message: 'Bulk update triggered successfully',
      note: 'Update is running in background. Check logs for progress.'
    });
  } catch (error) {
    logger.error('Error triggering bulk update', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/deals/trigger-telegram-bot
 * Manually trigger Telegram bot processing
 * Note: Telegram bot and bulk updates CAN run in parallel:
 * - Telegram bot connects to existing Chrome instance (port 9222)
 * - Bulk updates create their own Chrome instances (headless)
 * - They use separate processes and won't interfere
 */
router.post('/trigger-telegram-bot', async (req, res, next) => {
  try {
    logger.info('Manual Telegram bot trigger requested');

    // Trigger Telegram bot in background (non-blocking)
    // Use spawn to run in separate process
    const { spawn } = require('child_process');
    const path = require('path');
    const telegramBotPath = path.join(__dirname, '../../../run_telegram_bot.js');
    
    // Spawn Telegram bot in background
    const telegramProcess = spawn('node', [telegramBotPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for logging
      cwd: path.join(__dirname, '../../../'),
      shell: false
    });
    
    // Log output from Telegram bot process
    telegramProcess.stdout.on('data', (data) => {
      logger.info('Telegram Bot Output', { output: data.toString().trim() });
    });
    
    telegramProcess.stderr.on('data', (data) => {
      logger.warn('Telegram Bot Error', { error: data.toString().trim() });
    });
    
    telegramProcess.on('error', (error) => {
      logger.error('Telegram Bot Process Error', { error: error.message });
    });
    
    telegramProcess.unref(); // Allow parent process to exit independently

    logger.info('Telegram bot process spawned', { pid: telegramProcess.pid });

    res.json({
      success: true,
      message: 'Telegram bot triggered successfully.',
      note: 'Bot is running in background and will process messages continuously. It can run in parallel with bulk updates. Check logs for progress.',
      processId: telegramProcess.pid,
      canRunParallel: true,
      explanation: 'Telegram bot uses existing Chrome instance (port 9222), while bulk updates create separate Chrome instances. They can run simultaneously without conflicts.'
    });
  } catch (error) {
    logger.error('Error triggering Telegram bot', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/deals/:productCode/retrigger
 * Re-trigger extraction for a single product
 */
router.post('/:productCode/retrigger', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'productdeals' } = req.query;
    
    logger.info('Re-triggering product extraction', { productCode, db });
    
    // Get existing product to get the URL
    const targetRef = db === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    const snapshot = await targetRef.child(safeKey).once('value');
    const existingProduct = snapshot.val();
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    if (!existingProduct.productUrl) {
      return res.status(400).json({
        success: false,
        error: 'Product URL not found'
      });
    }

    // Import required modules
    const { Builder } = require('selenium-webdriver');
    const chrome = require('selenium-webdriver/chrome');
    const { getProductDetails } = require('../../../scheduler');
    const { firebaseget } = require('../../../database/firebaseget');
    
    // Trigger extraction in background
    (async () => {
      let driver = null;
      try {
        // Setup Chrome driver
        const options = new chrome.Options();
        options.addArguments('--headless');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');
        
        driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .build();

        // Get existing data
        const { data, len } = await firebaseget();
        const { data: todayData } = await firebaseget(true);

        // Extract product details
        const result = await getProductDetails(
          driver,
          existingProduct.productUrl,
          existingProduct.title || existingProduct.productText || '',
          len,
          '',
          data,
          todayData,
          true,
          'manual_retrigger',
          false,
          ''
        );

        logger.info('Product re-extraction completed', { 
          productCode, 
          result,
          url: existingProduct.productUrl
        });

      } catch (error) {
        logger.error('Error re-extracting product', { 
          productCode, 
          error: error.message,
          stack: error.stack
        });
      } finally {
        if (driver) {
          try {
            await driver.quit();
          } catch (e) {
            logger.warn('Error closing driver', { error: e.message });
          }
        }
      }
    })();

    // Invalidate cache for this product
    cacheService.delete(`deal_${productCode}_productdeals`);
    cacheService.delete(`deal_${productCode}_deals`);
    
    res.json({
      success: true,
      message: 'Product re-extraction triggered successfully',
      productCode,
      note: 'Extraction is running in background. Product will be updated when complete.'
    });
  } catch (error) {
    logger.error('Error triggering product re-extraction', { 
      productCode: req.params.productCode, 
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

module.exports = router;


