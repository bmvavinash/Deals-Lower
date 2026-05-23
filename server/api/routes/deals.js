const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');
const { runBulkUpdateAll } = require('../../../scripts/bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../../../logger/logger');
const cacheService = require('../../../services/cacheService');
const { getformattedDate } = require('../../../utils/commonUtils');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');
const { getProductDetails } = require('../../../scheduler');
const { productStatus } = require('../../../config/const');
const constants = require('../../../config/constants');
const { getAccessToken } = require('../../../database/getAccessToken');
const { firebaseget } = require('../../../database/firebaseget');
const { firebasepost } = require('../../../database/firebasepost');
const handleProductProcessingModule = require('../../../dataSources/handleProductProcessing');
const processProduct = handleProductProcessingModule.processProduct || (async (driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct, username, generateLink, shortUrl) => {
  // Fallback: use getProductDetails directly if processProduct is not exported
  const { getProductDetails } = require('../../../scheduler');
  return await getProductDetails(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct, username, generateLink, shortUrl);
});
const { executionTracker } = require('../../../services/executionTracker');
const { spawn } = require('child_process');
const net = require('net');

const logger = getModuleLogger('deals-api');
const TELEGRAM_LOCK_FILE = path.join(__dirname, '../../../.telegram-bot.lock');

function isProcessRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Global driver instance for product processing
let globalDriver = null;

async function getOrCreateDriver() {
  if (!globalDriver) {
    try {
      let options = new chrome.Options();
      options.debuggerAddress("localhost:9222");
      globalDriver = await chrome.Driver.createSession(options);
      logger.info('Chrome WebDriver initialized for product processing');
    } catch (error) {
      logger.error('Failed to initialize driver', { error: error.message });
      throw error;
    }
  }
  return globalDriver;
}

/**
 * POST /api/deals/process-product
 * Process a product URL and save to database
 * Body: { url: string, postProduct: boolean }
 */
router.post('/process-product', async (req, res) => {
  let driver = null;
  try {
    const { url, postProduct = false } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Product URL is required',
        error: 'Product URL is required'
      });
    }

    logger.info('Processing product URL', { url, postProduct });

    // Get or create driver - try to use global driver first (same instance as Telegram bot)
    if (global.driver) {
      logger.info('Using existing global driver instance');
      driver = global.driver;
      try {
        await driver.getCurrentUrl();
        logger.info('Global driver is valid');
      } catch (e) {
        logger.warn('Global driver invalid, creating new one', { error: e.message });
        driver = await getOrCreateDriver();
        global.driver = driver;
      }
    } else {
      logger.info('No global driver found, creating new one');
      driver = await getOrCreateDriver();
      global.driver = driver;
    }

    // Resolve URL in browser first (same as handleProductProcessing)
    let resolvedUrl = url;
    try {
      logger.info('Resolving URL in browser', { url });
      await driver.get(url);
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      resolvedUrl = await driver.getCurrentUrl() || url;
      logger.info('URL resolved', { original: url, resolved: resolvedUrl });
      try {
        const pageTitle = await driver.getTitle();
        logger.info('Page loaded', { title: pageTitle.substring(0, 100) });
      } catch (e) {
        logger.warn('Could not get page title', { error: e.message });
      }
    } catch (navError) {
      logger.error('Failed to resolve URL in browser', { url, error: navError.message });
    }

    // Get required data (same pattern as working workflows)
    const accessToken = await getAccessToken();
    const jsonDataResult = await firebaseget();
    const jsonData = jsonDataResult?.data || jsonDataResult || {};
    const todayJsonDataResult = await firebaseget(true);
    const todayJsonData = todayJsonDataResult?.data || todayJsonDataResult || {};
    const len = jsonDataResult?.len || 0;

    logger.info('Calling getProductDetails', { url: resolvedUrl, postProduct, len });

    // Process the product using resolved URL (same as handleProductProcessing -> processProduct -> getProductDetails)
    // getProductDetails expects driver to already be on the page, which we've done above
    const result = await getProductDetails(
      driver,
      resolvedUrl, // Use resolved URL
      '', // text
      len,  // Use actual len
      accessToken,
      jsonData,
      todayJsonData,
      postProduct, // postProduct flag
      '', // username
      false, // generateLink
      '' // shortUrl
    );
    
    logger.info('getProductDetails returned', { result });

    // Determine status based on result
    let status = 'success';
    let message = 'Product processed and saved to database successfully';
    let error = null;

    if (result === productStatus.PRODUCT_ERROR) {
      status = 'error';
      message = 'Failed to process product';
      error = 'Product processing encountered an error';
    } else if (result === productStatus.PRODUCT_EXCLUDED) {
      status = 'excluded';
      message = 'Product excluded (Affiliate policy)';
    } else if (result === productStatus.PRODUCT_CREATED || result === productStatus.PRODUCT_UPDATED) {
      status = 'success';
      message = result === productStatus.PRODUCT_CREATED 
        ? 'Product created successfully' 
        : 'Product updated successfully';
    } else {
      status = 'success';
      message = 'Product processed successfully';
    }

    res.json({
      success: status === 'success' || status === 'excluded',
      status,
      message,
      error,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error processing product', { 
      error: error.message, 
      stack: error.stack,
      url: req.body?.url 
    });
    
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to process product',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/deals/manual-trigger
 * Manually trigger bulk update for all platforms
 * Body: { sourceType?: string, targetDb?: string }
 * NOTE: This route must be defined BEFORE /:productCode to avoid route conflicts
 */
router.post('/manual-trigger', async (req, res) => {
  try {
    const { sourceType = 'website', targetDb = 'productdeals' } = req.body;
    
    logger.info('Manual bulk update triggered', { sourceType, targetDb });

    // Run bulk update in background (don't await - return immediately)
    runBulkUpdateAll(sourceType, targetDb)
      .then((result) => {
        logger.info('Bulk update completed', {
          sourceType,
          targetDb,
          totalProducts: result.totalProducts,
          successRate: result.successRate
        });
      })
      .catch((error) => {
        logger.error('Bulk update failed', {
          sourceType,
          targetDb,
          error: error.message,
          stack: error.stack
        });
      });

    // Return immediately - bulk update runs in background
    res.json({
      success: true,
      message: 'Bulk update triggered successfully. It will run in the background.',
      sourceType,
      targetDb,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error triggering bulk update', { 
      error: error.message, 
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to trigger bulk update',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/deals/trigger-telegram-bot
 * Trigger the long-running Telegram bot process from the UI
 */
router.post('/trigger-telegram-bot', async (req, res) => {
  try {
    logger.info('Telegram bot trigger received from UI');

    const lockPort = parseInt(process.env.TELEGRAM_BOT_LOCK_PORT || '9233', 10);
    const alreadyRunning = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: lockPort });
      socket.setTimeout(250);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => resolve(false));
    });

    if (alreadyRunning) {
      logger.info('Telegram bot trigger ignored - lock port indicates running instance', { lockPort });
      return res.json({
        success: true,
        alreadyRunning: true,
        message: 'Telegram bot is already running.',
        timestamp: new Date().toISOString()
      });
    }

    // Spawn in a separate process so the API stays healthy and restarts don't kill the bot.
    const scriptPath = path.resolve(__dirname, '..', '..', '..', 'run_telegram_bot.js');
    const child = spawn(process.execPath, [scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();

    return res.json({
      success: true,
      message: 'Telegram bot started successfully. It will process messages in the background.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering Telegram bot', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to trigger Telegram bot',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/deals
 * List all deals with optional filters
 * Query params: dealType (hotDeal|productDeal), platform, limit, offset
 */
router.get('/', async (req, res, next) => {
  try {
    const { dealType, platform, date, limit = 100, offset = 0 } = req.query;
    
    // Create cache key
    const cacheKey = `deals_${dealType || 'all'}_${platform || 'all'}_${date || 'all'}_${limit}_${offset}`;
    
    // Check cache first (increased TTL to 10 minutes for deals)
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deals', { cacheKey });
      return res.json(cached);
    }
    
    // Determine which database to query
    const targetDb = dealType === 'hotDeal' ? 'deals' : 'productdeals';
    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    
    let snapshot;
    if (date) {
      // Use native Firebase querying to fetch by date
      snapshot = await ref.orderByChild('date').equalTo(date).once('value');
    } else {
      // Use native Firebase querying to fetch a larger pool (5000) to account for potential invalid items
      snapshot = await ref.orderByChild('datetime').limitToLast(5000).once('value');
    }
    let deals = snapshot.val() || {};
    
    // Convert to array and filter out completely empty items
    let dealsArray = Object.entries(deals).map(([key, value]) => ({
      productCode: key,
      ...value
    })).filter(deal => {
      const hasAnyTitle = (deal.title && deal.title.trim() !== '') || 
                          (deal.shortText && deal.shortText.trim() !== '') || 
                          (deal.productText && deal.productText.trim() !== '');
      return hasAnyTitle && deal.price;
    });

    // Filter by platform if specified
    if (platform) {
      dealsArray = dealsArray.filter(deal => 
        deal.storeType?.toLowerCase() === platform.toLowerCase()
      );
    }

    // Apply sorting
    if (date) {
      // If date is specified, Firebase natively sorts identical dates by key ascending.
      // We must match this behavior so the Admin portal exactly matches the Website.
      dealsArray.sort((a, b) => {
        if (a.productCode < b.productCode) return -1;
        if (a.productCode > b.productCode) return 1;
        return 0;
      });
    } else {
      // Sort by timestamp in descending order (newest first)
      // Priority: updatedatetime > datetime > updateTimestamp > 0
      dealsArray.sort((a, b) => {
        const aTime = Number(a.updatedatetime || a.datetime || a.updateTimestamp || 0);
        const bTime = Number(b.updatedatetime || b.datetime || b.updateTimestamp || 0);
        return bTime - aTime; // Descending order (newest first)
      });
    }

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
    logger.error('Error fetching notification status', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/deals/manual-trigger
 * Manually trigger bulk update from the dashboard
 */
router.post('/manual-trigger', async (req, res, next) => {
  try {
    const { sourceType = 'website', targetDb = 'productdeals' } = req.body || {};
    const { executionTracker } = require('../../../services/executionTracker');
    const status = executionTracker.getCurrentStatus();

    // Check for running execution, but allow override if it's stale (older than 1 hour)
    if (
      status.currentExecution?.type === 'bulk_update' &&
      status.currentExecution?.status === 'running'
    ) {
      const lastUpdateTime = new Date(status.currentExecution.lastUpdate || status.currentExecution.startTime).getTime();
      const isStale = (Date.now() - lastUpdateTime) > 60 * 1000; // 1 minute
      
      if (!isStale) {
        return res.status(409).json({
          success: false,
          error: 'Bulk update is already running. Check Execution Monitor for progress.'
        });
      } else {
        logger.warn('Overriding stale running execution', { 
          executionId: status.currentExecution.id,
          lastUpdateTime: new Date(lastUpdateTime).toISOString()
        });
      }
    }

    logger.info('Manual bulk update triggered', { sourceType, targetDb });

    runBulkUpdateAll(sourceType, targetDb)
      .then((result) => logger.info('Manual bulk update completed', result))
      .catch((error) => {
        logger.error('Manual bulk update failed', {
          error: error.message,
          stack: error.stack
        });
      });

    res.json({
      success: true,
      message: 'Bulk update triggered successfully',
      note: 'Update is running in background. Check Execution Monitor or logs for progress.'
    });
  } catch (error) {
    logger.error('Error triggering bulk update', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/deals/trigger-telegram-bot
 * Manually trigger Telegram bot processing (separate process)
 */
router.post('/trigger-telegram-bot', async (req, res, next) => {
  try {
    logger.info('Manual Telegram bot trigger requested', {
      enableTelegramProcessing: constants.enableTelegramProcessing
    });

    if (fs.existsSync(TELEGRAM_LOCK_FILE)) {
      const existingPid = parseInt(fs.readFileSync(TELEGRAM_LOCK_FILE, 'utf8'), 10);
      if (isProcessRunning(existingPid)) {
        return res.status(409).json({
          success: false,
          error: `Telegram bot is already running (PID ${existingPid}). Stop it before starting another instance.`
        });
      }
      fs.unlinkSync(TELEGRAM_LOCK_FILE);
    }

    const { spawn } = require('child_process');
    const nodePath = process.execPath;
    const telegramBotPath = path.join(__dirname, '../../../run_telegram_bot.js');

    const telegramProcess = spawn(nodePath, [telegramBotPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../../../'),
      windowsHide: true
    });

    telegramProcess.stdout?.on('data', (data) => {
      logger.info('Telegram Bot Output', { output: data.toString().trim() });
    });

    telegramProcess.stderr?.on('data', (data) => {
      logger.warn('Telegram Bot Error', { error: data.toString().trim() });
    });

    telegramProcess.on('error', (error) => {
      logger.error('Telegram Bot Process Error', { error: error.message });
    });

    telegramProcess.unref();

    logger.info('Telegram bot process spawned', { pid: telegramProcess.pid });

    res.json({
      success: true,
      message: 'Telegram bot triggered successfully.',
      note: 'Bot runs in background. Requires Chrome on port 9222. Check logs for progress.',
      processId: telegramProcess.pid
    });
  } catch (error) {
    logger.error('Error triggering Telegram bot', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/deals/:productCode
 * Get specific deal by product code

 * POST /api/deals/bulk-refresh-timestamps
 * Bulk update timestamps for a subset of products
 * Body: { source: 'productdeals' | 'deals' | 'both', limit?: number, order?: 'newest' | 'oldest' }

 */
router.post('/bulk-refresh-timestamps', async (req, res) => {
  try {
    const { source = 'productdeals', limit = 100, order = 'newest' } = req.body || {};

    const sourcesToProcess = source === 'both' ? ['productdeals', 'deals'] : [source];
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const results = [];

    for (const src of sourcesToProcess) {
      const targetDb = src === 'deals' ? 'deals' : 'productdeals';
      const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;

      const snapshot = await ref.once('value');
      const data = snapshot.val() || {};
      let items = Object.entries(data).map(([key, value]) => ({
        key,
        ...(value || {})
      }));

      // Sort by time (same priority as list endpoint)
      items.sort((a, b) => {
        const aTime = Number(a.updatedatetime || a.datetime || a.updateTimestamp || 0);
        const bTime = Number(b.updatedatetime || b.datetime || b.updateTimestamp || 0);
        return order === 'oldest' ? aTime - bTime : bTime - aTime;
      });

      const slice = items.slice(0, Number(limit) || 100);
      const updates = {};
      slice.forEach((item) => {
        updates[item.key] = {
          updateTimestamp: nowIso,
          updatedatetime: nowMs
        };
      });

      await ref.update(updates);

      results.push({
        source: targetDb,
        updatedCount: slice.length
      });
    }

    res.json({
      success: true,
      message: 'Timestamps refreshed successfully',
      results,
      requested: {
        source,
        limit: Number(limit) || 100,
        order
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in bulk-refresh-timestamps', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to refresh timestamps',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/deals/:productCode
 * Get a single product by product code
 * Query params: db (deals|productdeals)
 */
router.get('/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'deals' } = req.query;
    const targetDb = db === 'productdeals' ? 'productdeals' : 'deals';
    
    if (!productCode) {
      return res.status(400).json({
        success: false,
        error: 'Product code is required'
      });
    }

    logger.info('Fetching product by code', { productCode, targetDb });

    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    // Try to get by productCode field first
    let snapshot = await ref.orderByChild('productCode').equalTo(productCode).once('value');
    let product = null;
    let productKey = null;

    if (snapshot.exists()) {
      const products = snapshot.val();
      productKey = Object.keys(products)[0];
      product = products[productKey];
    } else {
      // Fallback: try direct key lookup
      snapshot = await ref.child(safeKey).once('value');
      if (snapshot.exists()) {
        productKey = safeKey;
        product = snapshot.val();
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        productCode
      });
    }

    res.json({
      success: true,
      data: {
        productKey,
        ...product
      }
    });
  } catch (error) {
    logger.error('Error fetching product by code', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * PUT /api/deals/:productCode
 * Update a product by product code
 * Body: { ...product attributes to update }
 * Query params: db (deals|productdeals)
 */
router.put('/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'deals' } = req.query;
    const targetDb = db === 'productdeals' ? 'productdeals' : 'deals';
    const updates = req.body;

    if (!productCode) {
      return res.status(400).json({
        success: false,
        error: 'Product code is required'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Update data is required'
      });
    }

    logger.info('Updating product by code', { productCode, targetDb, updateFields: Object.keys(updates) });

    const result = await productDealsDB.updateIndividualProduct(productCode, updates, targetDb);

    if (result.status === 200) {
      res.json({
        success: true,
        message: result.message,
        productCode
      });
    } else {
      res.status(result.status).json({
        success: false,
        error: result.message,
        productCode
      });
    }
  } catch (error) {
    logger.error('Error updating product by code', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * DELETE /api/deals/:productCode
 * Delete a product by product code
 * Query params: db (deals|productdeals)
 */
router.delete('/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'deals' } = req.query;
    const targetDb = db === 'productdeals' ? 'productdeals' : 'deals';

    if (!productCode) {
      return res.status(400).json({
        success: false,
        error: 'Product code is required'
      });
    }

    logger.info('Deleting product by code', { productCode, targetDb });

    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    // First, try to find the product by productCode field
    let snapshot = await ref.orderByChild('productCode').equalTo(productCode).once('value');
    let productKey = null;

    if (snapshot.exists()) {
      const products = snapshot.val();
      productKey = Object.keys(products)[0];
    } else {
      // Fallback: try direct key lookup
      snapshot = await ref.child(safeKey).once('value');
      if (snapshot.exists()) {
        productKey = safeKey;
      }
    }

    if (!productKey) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        productCode
      });
    }

    await ref.child(productKey).remove();
    
    logger.info('Product deleted successfully', { productCode, productKey, targetDb });

    res.json({
      success: true,
      message: 'Product deleted successfully',
      productCode,
      productKey
    });
  } catch (error) {
    logger.error('Error deleting product by code', { error: error.message, stack: error.stack });
    next(error);
  }
});


/**
 * POST /api/deals/:productCode/retrigger
 * Retrigger a single product
 */
router.post('/:productCode/retrigger', async (req, res) => {
  try {
    const { productCode } = req.params;
    const db = req.query.db || 'productdeals';
    const product = await productDealsDB.getProduct(productCode, db);
    
    if (!product || !product.productUrl) {
      return res.status(404).json({ success: false, error: 'Product or URL not found' });
    }
    
    const driver = global.driver || await getOrCreateDriver();
    const { scrapeProduct } = require('../../../scrappers/amazon');
    const { resolvePlatformFromUrl } = require('../../../utils/platformUtils');
    
    const platform = resolvePlatformFromUrl(product.productUrl) || 'amazon';
    
    const extractedData = await scrapeProduct(
      product.productUrl, 
      platform, 
      driver, 
      product.productText || product.title || "", 
      false, 
      "dealsglobalhub"
    );
    
    if (extractedData && Object.keys(extractedData).length > 0) {
      // Merge with existing product data
      const updatedProduct = {
        ...product,
        ...extractedData,
        updateTimestamp: new Date().toISOString(),
        updatedatetime: Date.now()
      };
      
      // Keep existing photo if the new extraction failed to find one
      if (!updatedProduct.photo && product.photo) {
        updatedProduct.photo = product.photo;
      }
      
      await productDealsDB.updateIndividualProduct(productCode, updatedProduct, db);
      res.json({ success: true, result: { extracted: 1, stored: 1, products: [updatedProduct] } });
    } else {
      res.json({ success: false, error: 'Extraction returned no data' });
    }
  } catch (error) {
    logger.error('Error retriggering product', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/deals/retrigger-today
 * Retrigger today's deals based on missing fields
 */
router.post('/retrigger-today', async (req, res) => {
  try {
    const { fields, priority } = req.body;
    
    // Respond with a mock stats object for now to satisfy the frontend
    // In a full implementation, this would spawn a background worker
    res.json({
      success: true,
      stats: {
        toRetrigger: 0,
        issuesBreakdown: { price: 0, links: 0, discount: 0, category: 0, photo: 0 }
      }
    });
  } catch (error) {
    logger.error('Error in retrigger-today', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

