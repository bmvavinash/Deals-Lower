const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');
const { runBulkUpdateAll } = require('../../../scripts/bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../../../logger/logger');
const cacheService = require('../../../services/cacheService');
const { getformattedDate, getISTTimestamp, getCode } = require('../../../utils/commonUtils');
const { resolvePlatformFromUrl } = require('../../../utils/platformUtils');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
// require('chromedriver');
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
const { authenticateRequest } = require('./auth');

const logger = getModuleLogger('deals-api');
const TELEGRAM_LOCK_FILE = path.join(__dirname, '../../../.telegram-bot.lock');

// Lightweight In-Memory Search Index Cache
let searchIndexCache = {};
let isCacheLoaded = false;

// Regex for blocked titles (access denied, bot verification, error pages)
const BLOCKED_TITLE_REGEX = /^(access denied|oops!|something went wrong|robot check|page not found|blocked|challenge|403 forbidden|404 not found|amazon\.in)/i;

/**
 * Validates that a deal has a valid, non-placeholder image
 */
function hasValidDealImage(deal) {
  if (!deal) return false;
  let photo = deal.photo || deal.image || deal.img || '';
  if (Array.isArray(photo) && photo.length > 0) photo = photo[0] || '';
  if (!photo && Array.isArray(deal.images) && deal.images.length > 0) photo = deal.images[0] || '';
  if (typeof photo !== 'string') return false;
  photo = photo.trim();
  return /^(https?:)?\/\//i.test(photo) && 
         !photo.includes('no-image') && 
         !photo.includes('placeholder') && 
         !photo.startsWith('data:image');
}

/**
 * Validates that a deal is eligible to be displayed across the platform
 * Requires:
 * 1. Valid title (not empty, not blocked/bot error)
 * 2. Valid image URL (strictly required in all places)
 * 3. Price present or marked out of stock
 */
function isValidDealForDisplay(deal) {
  if (!deal) return false;
  const title = (deal.title || deal.shortText || deal.productText || '').trim();
  if (!title || title.length < 3) return false;
  if (BLOCKED_TITLE_REGEX.test(title)) return false;
  if (!hasValidDealImage(deal)) return false;
  if (!deal.price && !deal.outOfStock && !deal.isOutOfStock) return false;
  return true;
}

function initSearchIndexCache() {
  logger.info('🧠 [CACHE] Initializing in-memory search index cache...');
  const ref = productDealsDB.searchIndexRef;
  
  ref.once('value').then(snapshot => {
    searchIndexCache = snapshot.val() || {};
    isCacheLoaded = true;
    logger.info(`🧠 [CACHE] Loaded ${Object.keys(searchIndexCache).length} items into memory.`);
    
    // Establish real-time socket child sync listeners
    ref.on('child_added', (snap) => {
      searchIndexCache[snap.key] = snap.val();
    });
    ref.on('child_changed', (snap) => {
      searchIndexCache[snap.key] = snap.val();
    });
    ref.on('child_removed', (snap) => {
      delete searchIndexCache[snap.key];
    });
  }).catch(err => {
    logger.error('❌ [CACHE] Failed to preload search index cache:', err);
  });
}

// Pre-warm the cache, but skip on Render to prevent OOM
if (!process.env.RENDER) {
  setTimeout(initSearchIndexCache, 2000);
}

function isProcessRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let globalDriver = null;
const { createChromeDriver } = require('../../../utils/seleniumDriver');

async function getOrCreateDriver() {
  if (process.env.RENDER) {
    throw new Error('Chrome WebDriver is disabled on Render cloud to prevent container OOM crash');
  }
  if (globalDriver) {
    try {
      // Test if the session is still valid
      await globalDriver.getTitle();
    } catch (e) {
      logger.warn('Driver connection lost or invalid session id, recreating session...');
      globalDriver = null;
    }
  }

  if (!globalDriver) {
    try {
      const result = await createChromeDriver();
      globalDriver = result.driver;
      logger.info('Chrome WebDriver initialized for product processing', { mode: result.mode });
    } catch (error) {
      logger.error('Failed to initialize driver', { error: error.message });
      throw error;
    }
  }
  return globalDriver;
}

/**
 * Helper to process a single URL in cloud environment using lightweight in-memory extraction
 * and Cuelinks affiliate link conversion, with fallback to Firebase commandsQueue.
 */
async function processProductUrlOnCloud(targetUrl, { postProduct = false, saleName = null } = {}) {
  const { extractProductOnServer, extractProductCode } = require('../../../services/headlessProductExtractor');
  const { resolvePlatformFromUrl } = require('../../../utils/platformUtils');

  // 1. Attempt crash-free server-side headless automation
  try {
    const serverResult = await extractProductOnServer(targetUrl, { postProduct, saleName });
    if (serverResult && serverResult.success) {
      const pCode = serverResult.productCode;
      const lowerdealUrl = serverResult.lowerdealUrl || `https://lowerdeal.com/p/${pCode}`;
      const affiliateUrl = serverResult.affiliateUrl || serverResult.data?.links?.avinashbmv || serverResult.data?.links?.avinashbmvINR || targetUrl;
      return {
        originalUrl: targetUrl,
        success: true,
        status: 'success',
        processedOn: 'server',
        productCode: pCode,
        lowerdealUrl,
        affiliateUrl,
        platform: serverResult.data?.storeType || 'unknown',
        title: serverResult.data?.title || '',
        price: serverResult.data?.price || null,
        mrp: serverResult.data?.mrp || null,
        discount: serverResult.data?.discount || '',
        photo: serverResult.data?.photo || '',
        outOfStock: Boolean(serverResult.outOfStock),
        inStock: serverResult.inStock !== undefined ? serverResult.inStock : !serverResult.outOfStock,
        availability: serverResult.availability || (serverResult.outOfStock ? 'OutOfStock' : 'InStock'),
        data: serverResult.data,
        isCuelinks: serverResult.isCuelinks,
        message: serverResult.message || `Product [${pCode}] processed successfully on server!`
      };
    } else if (serverResult && (!serverResult.success || serverResult.status === 'error')) {
      return {
        originalUrl: targetUrl,
        success: false,
        status: 'error',
        productCode: serverResult.productCode || null,
        platform: serverResult.platform || 'unknown',
        outOfStock: Boolean(serverResult.outOfStock),
        error: serverResult.error || serverResult.message || 'Unable to get product details from merchant.',
        message: serverResult.message || serverResult.error || 'Unable to get product details from merchant.'
      };
    }
  } catch (extractErr) {
    logger.warn('Server headless extraction failed', { url: targetUrl, error: extractErr.message });
    return {
      originalUrl: targetUrl,
      success: false,
      status: 'error',
      productCode: null,
      error: `Server extraction failed: ${extractErr.message}`,
      message: `Unable to extract product details: ${extractErr.message}`
    };
  }

  // 2. Fallback to Firebase Queue if server extraction yielded insufficient data
  let isDaemonAlive = false;
  let detectedPlatform = null;
  let productCode = null;
  try {
    detectedPlatform = resolvePlatformFromUrl(targetUrl);
    productCode = extractProductCode(targetUrl, detectedPlatform);
  } catch (e) {
    // ignore
  }

  try {
    if (admin.apps.length) {
      const db = admin.database();
      const heartbeatRef = db.ref('daemonHeartbeat');
      const snapshot = await heartbeatRef.once('value');
      const heartbeat = snapshot.val();
      if (heartbeat && heartbeat.timestamp) {
        const lastTime = new Date(heartbeat.timestamp).getTime();
        isDaemonAlive = (Date.now() - lastTime) < 120000;
      }
    }
  } catch (hbErr) {
    logger.warn('Failed to check daemon heartbeat', { error: hbErr.message });
  }

  if (admin.apps.length) {
    const db = admin.database();
    const queueRef = db.ref('commandsQueue');
    const newCommandRef = queueRef.push();
    
    const safeUrl = targetUrl.replace(/"/g, '\\"');
    const safeSaleName = saleName ? `"${safeSaleName.replace(/"/g, '\\"')}"` : 'null';
    const cliCommand = `node scripts/processSingleProduct.js "${safeUrl}" ${postProduct ? 'true' : 'false'} ${safeSaleName}`;

    await newCommandRef.set({
      id: `process-product-${Date.now()}`,
      command: cliCommand,
      name: `Process Product (${targetUrl.substring(0, 50)}...)`,
      role: 'all',
      status: 'pending',
      createdAt: new Date().toISOString(),
      triggeredBy: 'api'
    });

    const lowerdealUrl = productCode ? `https://lowerdeal.com/p/${productCode}` : null;

    return {
      originalUrl: targetUrl,
      success: false,
      status: 'queued',
      queued: true,
      queuedId: newCommandRef.key,
      isDaemonAlive,
      productCode,
      lowerdealUrl,
      processedOn: 'queue',
      reason: isDaemonAlive 
        ? 'Product processing queued in Firebase. Waiting for execution by Local Daemon.'
        : 'Product processing queued in Firebase. Please ensure Local Daemon is running locally to process it.',
      message: isDaemonAlive 
        ? 'Product processing queued in Firebase. Waiting for execution by Local Daemon.'
        : 'Product processing queued in Firebase. Please ensure Local Daemon is running locally to process it.'
    };
  }

  return {
    originalUrl: targetUrl,
    success: false,
    status: 'error',
    message: 'Cloud server cannot process products directly and Firebase is not connected to queue tasks.'
  };
}

/**
 * POST /api/deals/process-product
 * Process one or multiple product URLs and save to database
 * Body: { url?: string, urls?: string | string[], postProduct?: boolean, saleName?: string }
 */
router.post('/process-product', async (req, res) => {
  let driver = null;
  try {
    // Strictly require administrator authentication on the API level
    const authResult = authenticateRequest(req);
    if (!authResult.authenticated) {
      logger.warn('Unauthorized API request rejected on /deals/process-product', {
        ip: req.ip,
        error: authResult.error
      });
      return res.status(401).json({
        success: false,
        status: 'error',
        error: authResult.error || 'Access Denied: Administrator authentication required via Bearer token or x-admin-email & x-admin-password headers.'
      });
    }

    req.adminUser = authResult.user;
    logger.info('Authenticated admin executing process-product', { email: authResult.user.email, authType: authResult.authType });

    const { url: reqUrl, urls: reqUrls, postProduct = false, saleName = null } = req.body || {};
    
    // Extract all URLs from url or urls (string, array, or newline/comma separated)
    let rawUrls = [];
    if (Array.isArray(reqUrls)) {
      rawUrls = reqUrls;
    } else if (typeof reqUrls === 'string' && reqUrls.trim()) {
      rawUrls = reqUrls.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    } else if (Array.isArray(reqUrl)) {
      rawUrls = reqUrl;
    } else if (typeof reqUrl === 'string' && reqUrl.trim()) {
      rawUrls = reqUrl.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    }

    const validUrls = rawUrls.map(u => {
      let clean = String(u).trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = `https://${clean}`;
      }
      return clean;
    }).filter(u => {
      try {
        const p = new URL(u);
        return p.protocol === 'http:' || p.protocol === 'https:';
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'At least one valid product URL is required',
        error: 'Product URL is required'
      });
    }

    logger.info('Processing product URLs', { count: validUrls.length, postProduct, saleName });

    // Cloud environment detection (Render free tier has 512MB RAM and no Chrome)
    const isCloudEnv = Boolean(process.env.RENDER || process.env.HYBRID_EXECUTION === 'true' || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (isCloudEnv) {
      logger.info('Cloud environment detected (Render/Hybrid). Running server-side headless extraction with Cuelinks API.', { count: validUrls.length, postProduct, saleName });

      // Process up to 3 URLs concurrently
      const CHUNK_SIZE = 3;
      const results = [];
      for (let i = 0; i < validUrls.length; i += CHUNK_SIZE) {
        const chunk = validUrls.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(u => processProductUrlOnCloud(u, { postProduct, saleName }))
        );
        results.push(...chunkResults);
      }

      const lowerdealUrls = results.map(r => r.lowerdealUrl).filter(Boolean);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      const firstResult = results[0] || {};
      const queuedCount = results.filter(r => r.queued || r.status === 'queued').length;

      let overallStatus = 'success';
      if (successful.length === 0) {
        overallStatus = queuedCount > 0 ? 'queued' : 'error';
      } else if (failed.length > 0) {
        overallStatus = 'partial';
      }

      let summaryMessage = `Processed ${successful.length}/${results.length} product(s) successfully.`;
      if (failed.length > 0) {
        const errorDetails = failed.map(f => {
          const code = f.productCode ? `[${f.productCode}]` : '';
          return `${code} ${f.error || f.message || f.reason || 'Failed'}`.trim();
        }).join('; ');
        summaryMessage = `Processed ${successful.length}/${results.length} product(s). ${failed.length} product(s) failed or queued: ${errorDetails}`;
      }

      const responsePayload = {
        success: successful.length > 0,
        status: overallStatus,
        total: results.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        queuedCount,
        lowerdealUrl: lowerdealUrls[0] || null,
        lowerdealUrls,
        results,
        message: summaryMessage
      };

      if (authResult.authenticated) {
        responsePayload.authenticated = true;
        responsePayload.authenticatedAs = authResult.user.email;
        responsePayload.authType = authResult.authType;
      }

      // Top-level backward compatibility if single URL was passed
      if (results.length === 1) {
        responsePayload.success = Boolean(firstResult.success && !firstResult.queued);
        responsePayload.status = firstResult.status || overallStatus;
        responsePayload.productCode = firstResult.productCode;
        responsePayload.data = firstResult.data;
        responsePayload.processedOn = firstResult.processedOn;
        responsePayload.isCuelinks = firstResult.isCuelinks;
        responsePayload.queued = Boolean(firstResult.queued);
        responsePayload.queuedId = firstResult.queuedId;
        responsePayload.isDaemonAlive = firstResult.isDaemonAlive;
        responsePayload.outOfStock = Boolean(firstResult.outOfStock);
        responsePayload.inStock = firstResult.inStock !== undefined ? firstResult.inStock : !firstResult.outOfStock;
        responsePayload.availability = firstResult.availability || (firstResult.outOfStock ? 'OutOfStock' : 'InStock');
        if (!firstResult.success || firstResult.queued) {
          responsePayload.reason = firstResult.reason || firstResult.error || firstResult.message;
          responsePayload.error = firstResult.error || firstResult.message;
        }
        responsePayload.message = firstResult.message || responsePayload.message;
      }

      return res.json(responsePayload);
    }

    // If multiple URLs in local mode, process via cloud helper
    if (validUrls.length > 1) {
      const results = [];
      for (const singleUrl of validUrls) {
        const r = await processProductUrlOnCloud(singleUrl, { postProduct, saleName });
        results.push(r);
      }
      const lowerdealUrls = results.map(r => r.lowerdealUrl).filter(Boolean);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let overallStatus = 'success';
      if (successful.length === 0) {
        overallStatus = 'error';
      } else if (failed.length > 0) {
        overallStatus = 'partial';
      }

      let summaryMessage = `Processed ${successful.length}/${results.length} product(s) successfully.`;
      if (failed.length > 0) {
        const errorDetails = failed.map(f => {
          const code = f.productCode ? `[${f.productCode}]` : '';
          return `${code} ${f.error || f.message || 'Failed'}`.trim();
        }).join('; ');
        summaryMessage = `Processed ${successful.length}/${results.length} product(s). ${failed.length} product(s) failed: ${errorDetails}`;
      }

      const responsePayload = {
        success: successful.length > 0,
        status: overallStatus,
        total: results.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        lowerdealUrl: lowerdealUrls[0] || null,
        lowerdealUrls,
        results,
        message: summaryMessage
      };
      if (authResult.authenticated) {
        responsePayload.authenticated = true;
        responsePayload.authenticatedAs = authResult.user.email;
        responsePayload.authType = authResult.authType;
      }
      return res.json(responsePayload);
    }

    // Single URL in local environment
    const url = validUrls[0];

    // Local environment: attempt local driver, fallback to queue if driver fails
    try {
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
    } catch (driverErr) {
      logger.warn('Local driver initialization failed, attempting Firebase queue fallback', { error: driverErr.message });
      if (admin.apps.length) {
        const db = admin.database();
        const queueRef = db.ref('commandsQueue');
        const newCommandRef = queueRef.push();
        const safeUrl = url.replace(/"/g, '\\"');
        const safeSaleName = saleName ? `"${saleName.replace(/"/g, '\\"')}"` : 'null';
        const cliCommand = `node scripts/processSingleProduct.js "${safeUrl}" ${postProduct ? 'true' : 'false'} ${safeSaleName}`;

        await newCommandRef.set({
          id: `process-product-${Date.now()}`,
          command: cliCommand,
          name: `Process Product (${url.substring(0, 50)}...)`,
          role: 'all',
          status: 'pending',
          createdAt: new Date().toISOString(),
          triggeredBy: 'dashboard'
        });

        return res.json({
          success: true,
          status: 'success',
          queued: true,
          queuedId: newCommandRef.key,
          message: 'Local browser unavailable. Task queued in Firebase for Local Daemon.'
        });
      }
      throw driverErr;
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

    // Check if we can resolve productCode. If not, process as listing/search page.
    const { storeMap } = require('../../../config/const');
    const storeKey = resolvePlatformFromUrl(resolvedUrl);
    let productCode = null;
    if (storeKey && storeMap && storeMap[storeKey]) {
      productCode = storeMap[storeKey].getCode(resolvedUrl);
    }

    let result;
    let errorContext = {};
    if (productCode) {
      logger.info('Calling getProductDetails for single product', { url: resolvedUrl, productCode });
      result = await getProductDetails(
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
        '', // shortUrl
        null, // categoryOverride
        errorContext, // errorContext
        saleName // saleName
      );
      logger.info('getProductDetails returned', { result, errorContext });
    } else {
      if (global.isCrawlingListingPage) {
        logger.info('Bulk extraction already in progress, returning 429');
        return res.status(429).json({
          success: false,
          status: 'busy',
          message: 'A search or listing page bulk extraction is already in progress. Please try again in a few minutes.'
        });
      }

      logger.info('No productCode resolved, starting search/listing page bulk extraction in background', { url: resolvedUrl });
      global.isCrawlingListingPage = true;

      // Run in background
      (async () => {
        try {
          const { extractAndStoreFromUrl } = require('../../../dataSources/batchProductExtractor');
          const batchResult = await extractAndStoreFromUrl(
            driver,
            resolvedUrl,
            'telegram', // sourceType to trigger grouping/categorization
            '', // categoryKey
            null, // ctx
            'productdeals' // targetDb
          );
          logger.info('Search/listing page bulk extraction completed in background', { batchResult });
        } catch (bgErr) {
          logger.error('Search/listing page bulk extraction in background failed', { error: bgErr.message, stack: bgErr.stack });
        } finally {
          global.isCrawlingListingPage = false;
        }
      })();

      return res.status(202).json({
        success: true,
        status: 'processing',
        message: 'Search/listing page bulk extraction started in the background.'
      });
    }

    // Determine status based on result
    let status = 'success';
    let message = 'Product processed and saved to database successfully';
    let error = null;

    if (result === productStatus.PRODUCT_ERROR) {
      status = 'error';
      message = errorContext.reason ? `Failed: ${errorContext.reason}` : 'Failed to process product';
      error = errorContext.reason || 'Product processing encountered an error';
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

    const lowerdealUrl = productCode ? `https://lowerdeal.com/p/${productCode}` : null;

    res.json({
      success: status === 'success' || status === 'excluded',
      status,
      message,
      error,
      result: result,
      productCode,
      lowerdealUrl,
      lowerdealUrls: lowerdealUrl ? [lowerdealUrl] : [],
      results: [
        {
          originalUrl: url,
          success: status === 'success' || status === 'excluded',
          status,
          productCode,
          lowerdealUrl,
          message
        }
      ],
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
 * POST /api/deals/link
 * Manually link two products by assigning them the same matchId
 * Body: { sourceProductCode: string, targetProductCode: string }
 */
router.post('/link', async (req, res) => {
  try {
    const { sourceProductCode, targetProductCode } = req.body;
    
    if (!sourceProductCode || !targetProductCode) {
      return res.status(400).json({ success: false, error: 'Both source and target product codes are required' });
    }

    // Generate a unified manual match ID
    const manualMatchId = `MANUAL_LINK_${Date.now()}`;
    
    // Update in both DBs (deals and productdeals) to be thorough
    const dbs = [productDealsDB.dealsRef, productDealsDB.productdealsRef];
    
    let updated = 0;
    for (const ref of dbs) {
      for (const pCode of [sourceProductCode, targetProductCode]) {
        const safeKey = String(pCode).replace(/[.#$/\[\]]/g, '_');
        
        // Try safeKey directly
        let snapshot = await ref.child(safeKey).once('value');
        if (snapshot.exists()) {
          await ref.child(safeKey).update({ matchId: manualMatchId });
          updated++;
          continue;
        }
        
        // Try query by productCode
        snapshot = await ref.orderByChild('productCode').equalTo(pCode).once('value');
        if (snapshot.exists()) {
          const products = snapshot.val();
          const key = Object.keys(products)[0];
          await ref.child(key).update({ matchId: manualMatchId });
          updated++;
        }
      }
    }

    if (updated === 0) {
      return res.status(404).json({ success: false, error: 'Could not find one or both products in the database' });
    }

    cacheService.delete('deals_matches_registry');
    res.json({ success: true, message: `Successfully linked ${updated} product records`, matchId: manualMatchId });

  } catch (error) {
    logger.error('Error linking products', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to link products' });
  }
});

/**
 * GET /api/deals/matches
 * Get all matched product groups from deals and productdeals databases
 */
router.get('/matches', async (req, res) => {
  try {
    const registryCacheKey = 'deals_matches_registry';
    const cachedGroups = cacheService.get(registryCacheKey);
    if (cachedGroups) {
      logger.info('Returning cached matched product groups');
      return res.json({ success: true, count: cachedGroups.length, groups: cachedGroups });
    }

    logger.info('Registry cache cold. Performing full database scan for matched products...');
    
    // 1. Fetch all deals (since only ~92 have competitorMatches, we must scan the database)
    const recentDealsSnapshot = await productDealsDB.dealsRef.once('value');
    const recentDeals = recentDealsSnapshot.val() || {};
    
    // 2. Fetch latest date productdeals from raw deals cache if available, otherwise fetch recent ones
    let pDeals = {};
    const latestDateCacheKey = `latest_date_productdeals`;
    const cachedDate = cacheService.get(latestDateCacheKey);
    if (cachedDate) {
      const rawDealsCacheKey = `raw_deals_productdeals_${cachedDate}`;
      pDeals = cacheService.get(rawDealsCacheKey) || {};
    }
    
    if (Object.keys(pDeals).length === 0) {
      logger.info('Cache cold for productdeals matches, scanning recent 1000 productdeals...');
      const pDealsSnapshot = await productDealsDB.productdealsRef.orderByChild('datetime').limitToLast(1000).once('value');
      pDeals = pDealsSnapshot.val() || {};
    }
    
    // Merge all products to find matches
    const allProductsMap = {};
    
    // Add productdeals
    Object.entries(pDeals).forEach(([key, val]) => {
      if (val) {
        allProductsMap[key] = {
          productCode: key,
          db: 'productdeals',
          ...val
        };
      }
    });
    
    // Add deals
    Object.entries(recentDeals).forEach(([key, val]) => {
      if (val) {
        allProductsMap[key] = {
          productCode: key,
          db: 'deals',
          ...val
        };
      }
    });
    
    const allProducts = Object.values(allProductsMap);
    
    const groups = [];
    const processedCodes = new Set();
    
    for (const prod of allProducts) {
      const code = prod.productCode;
      if (processedCodes.has(code)) continue;
      
      const compMatches = prod.competitorMatches || {};
      const matchKeys = Object.entries(compMatches).map(([store, match]) => ({
        storeType: store,
        productCode: match.key,
        productUrl: match.link,
        price: match.price
      })).filter(m => m.productCode && m.productCode !== code);
      
      // Also look for matchId groupings if not generic
      const matchId = prod.matchId;
      const isGenericMatchId = !matchId || matchId.startsWith('GEN_') || matchId.startsWith('MATCH_') || matchId.startsWith('MANUAL_LINK_');
      
      if (matchKeys.length === 0 && isGenericMatchId) {
        continue;
      }
      
      const groupProducts = [{
        productCode: prod.productCode,
        db: prod.db || 'deals',
        title: prod.title || prod.shortText || prod.productText || 'No Title',
        price: prod.price || prod.offerPrice || 'N/A',
        storeType: prod.storeType || 'Unknown',
        photo: prod.photo || prod.images || '',
        productUrl: prod.productUrl || '',
        competitorMatches: prod.competitorMatches || {}
      }];
      
      processedCodes.add(code);
      
      // Resolve matches via competitorMatches
      matchKeys.forEach(m => {
        if (!processedCodes.has(m.productCode)) {
          const other = allProducts.find(p => p.productCode === m.productCode);
          groupProducts.push({
            productCode: m.productCode,
            db: other ? (other.db || 'deals') : (prod.db || 'deals'),
            title: other ? (other.title || other.shortText || other.productText || 'No Title') : (prod.title || 'Matched Product'),
            price: m.price || (other ? (other.price || other.offerPrice) : 'N/A'),
            storeType: m.storeType,
            photo: other ? (other.photo || other.images) : '',
            productUrl: m.productUrl || (other ? other.productUrl : ''),
            competitorMatches: other ? (other.competitorMatches || {}) : {}
          });
          processedCodes.add(m.productCode);
        }
      });
      
      // Resolve matches via shared matchId
      if (!isGenericMatchId) {
        for (const other of allProducts) {
          const otherCode = other.productCode;
          if (!processedCodes.has(otherCode) && other.matchId === matchId) {
            groupProducts.push({
              productCode: otherCode,
              db: other.db || 'deals',
              title: other.title || other.shortText || other.productText || 'No Title',
              price: other.price || other.offerPrice || 'N/A',
              storeType: other.storeType || 'Unknown',
              photo: other.photo || other.images || '',
              productUrl: other.productUrl || '',
              competitorMatches: other.competitorMatches || {}
            });
            processedCodes.add(otherCode);
          }
        }
      }
      
      if (groupProducts.length > 1) {
        groups.push({
          matchId: matchId || `GROUP_${code}`,
          products: groupProducts
        });
      }
    }
    
    // Cache the groups for 1 hour
    cacheService.set(registryCacheKey, groups, 60 * 60 * 1000);
    res.json({ success: true, count: groups.length, groups });
  } catch (error) {
    logger.error('Error fetching matched product groups', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch matches' });
  }
});

/**
 * POST /api/deals/unlink
 * Manually de-link two products by removing competitorMatches links and separating their matchId
 * Body: { productCode1: string, productCode2: string, database?: 'deals' | 'productdeals' }
 */
router.post('/unlink', async (req, res) => {
  try {
    const { productCode1, productCode2, database } = req.body;
    
    if (!productCode1 || !productCode2) {
      return res.status(400).json({ success: false, error: 'Both product codes are required for de-linking' });
    }
    
    // Determine which database refs to modify
    const targetDbs = database ? [database] : ['deals', 'productdeals'];
    let totalUpdated = 0;
    
    for (const dbName of targetDbs) {
      const ref = dbName === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
      
      // Load both products
      const safeKey1 = String(productCode1).replace(/[.#$/\[\]]/g, '_');
      const safeKey2 = String(productCode2).replace(/[.#$/\[\]]/g, '_');
      
      const [snap1, snap2] = await Promise.all([
        ref.child(safeKey1).once('value'),
        ref.child(safeKey2).once('value')
      ]);
      
      let p1 = snap1.val();
      let p2 = snap2.val();
      
      // If direct lookup fails, try query by productCode
      let key1 = safeKey1;
      let key2 = safeKey2;
      
      if (!p1) {
        const qSnap1 = await ref.orderByChild('productCode').equalTo(productCode1).once('value');
        if (qSnap1.exists()) {
          const val = qSnap1.val();
          key1 = Object.keys(val)[0];
          p1 = val[key1];
        }
      }
      
      if (!p2) {
        const qSnap2 = await ref.orderByChild('productCode').equalTo(productCode2).once('value');
        if (qSnap2.exists()) {
          const val = qSnap2.val();
          key2 = Object.keys(val)[0];
          p2 = val[key2];
        }
      }
      
      // Update if they exist
      if (p1 || p2) {
        const updates = {};
        
        if (p1) {
          const compMatches1 = { ...(p1.competitorMatches || {}) };
          const storeTypesToRemove = Object.keys(compMatches1).filter(storeType => {
            const match = compMatches1[storeType];
            return match && match.key === productCode2;
          });
          
          storeTypesToRemove.forEach(storeType => {
            delete compMatches1[storeType];
          });
          
          updates[`${key1}/competitorMatches`] = compMatches1;
          updates[`${key1}/matchId`] = `MATCH_${productCode1}`;
        }
        
        if (p2) {
          const compMatches2 = { ...(p2.competitorMatches || {}) };
          const storeTypesToRemove = Object.keys(compMatches2).filter(storeType => {
            const match = compMatches2[storeType];
            return match && match.key === productCode1;
          });
          
          storeTypesToRemove.forEach(storeType => {
            delete compMatches2[storeType];
          });
          
          updates[`${key2}/competitorMatches`] = compMatches2;
          updates[`${key2}/matchId`] = `MATCH_${productCode2}`;
        }
        
        if (Object.keys(updates).length > 0) {
          await ref.update(updates);
          totalUpdated++;
          
          // Clear active memory cache for raw deals so it updates instantly
          if (p1 && p1.date) {
            cacheService.delete(`raw_deals_${dbName}_${p1.date}`);
          }
          if (p2 && p2.date && p2.date !== p1?.date) {
            cacheService.delete(`raw_deals_${dbName}_${p2.date}`);
          }
          cacheService.delete('deals_matches_registry');
        }
      }
    }
    
    if (totalUpdated === 0) {
      return res.status(404).json({ success: false, error: 'Could not find matching products in database to de-link' });
    }
    
    res.json({ success: true, message: `Successfully de-linked products in ${totalUpdated} database(s)` });
  } catch (error) {
    logger.error('Error de-linking products', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to de-link products' });
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
    const clientMetadata = {
      ip: req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress,
      origin: req.headers.origin || req.headers.referer || 'Website Direct',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };
    
    logger.info('Manual bulk update triggered', { sourceType, targetDb, clientMetadata });

    // Run bulk update in background (don't await - return immediately)
    runBulkUpdateAll(sourceType, targetDb, clientMetadata)
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
 * POST /api/deals/scrape-live
 * Trigger live deals scraping from Amazon and Flipkart home banners in backend context
 */
router.post('/scrape-live', async (req, res) => {
  try {
    logger.info('Live deals scraping API endpoint triggered via API call');

    const { scrapeLiveDealsInternal } = require('../../../scripts/scrapeLiveDealsInternal');

    scrapeLiveDealsInternal()
      .then((summary) => {
        logger.info('Live deals scraping completed successfully via API', summary);
      })
      .catch((error) => {
        logger.error('Live deals scraping failed via API', { error: error.message, stack: error.stack });
      });

    res.json({
      success: true,
      message: 'Live deals scraping triggered successfully. It will run in the background.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error triggering live deals scraping', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to trigger live deals scraping',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/deals/test-connection
 * Retrieve last 10 Amazon deal products to verify sourceUrls and dealName attributes
 */
router.get('/test-connection', async (req, res) => {
  try {
    const snap = await productDealsDB.dealsRef.orderByChild('sourceUrl').equalTo('https://www.amazon.in/gp/bestsellers/?ref_=nav_cs_bestsellers').limitToLast(30).once('value');
    const val = snap.val() || {};
    const results = [];
    Object.entries(val).forEach(([key, prod]) => {
      results.push({
        key,
        title: prod.title,
        date: prod.date,
        sourceUrl: prod.sourceUrl,
        isDeal: prod.isDeal,
        dealName: prod.dealName,
        storeType: prod.storeType
      });
    });
    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/deals/comparison/:matchId
 * Retrieve products matching the same matchId for price comparison
 */
router.get('/comparison/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    if (!matchId || matchId === 'undefined' || matchId.startsWith('GEN_')) {
      // Don't return matches for generic title hashes (too inaccurate)
      return res.json({ success: true, matches: [] });
    }
    
    // Query deals database
    const snapshot = await productDealsDB.dealsRef.orderByChild('matchId').equalTo(matchId).once('value');
    const val = snapshot.val() || {};
    
    const matches = Object.entries(val).map(([key, prod]) => ({
      key,
      title: prod.title,
      price: prod.price,
      mrp: prod.mrp,
      discount: prod.discount,
      storeType: prod.storeType,
      productUrl: prod.productUrl,
      photo: prod.photo,
      links: prod.links
    }));
    
    res.json({
      success: true,
      matches
    });
  } catch (error) {
    logger.error('Error fetching price comparisons', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
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
      windowsHide: true,
      env: {
        ...process.env,
        TRIGGER_SOURCE: 'api',
        TRIGGER_CLIENT_IP: req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress,
        TRIGGER_CLIENT_ORIGIN: req.headers.origin || req.headers.referer || 'Website Direct',
        TRIGGER_CLIENT_UA: req.headers['user-agent'] || 'Unknown'
      }
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
    const { dealType, platform, date, categoryGroup, staticSubcategory, limit = 100, offset = 0, sortBy, order, nocache } = req.query;
    const isNoCache = nocache === 'true';
    
    // Create cache key
    const cacheKey = `deals_${dealType || 'all'}_${platform || 'all'}_${date || 'all'}_${categoryGroup || 'all'}_${staticSubcategory || 'all'}_${limit}_${offset}_${sortBy || 'default'}_${order || 'desc'}`;
    
    // Check cache first (increased TTL to 10 minutes for deals)
    if (!isNoCache) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        logger.debug('Returning cached deals', { cacheKey });
        return res.json(cached);
      }
    }
    
    // Determine which database to query
    const targetDb = dealType === 'hotDeal' ? 'deals' : 'productdeals';
    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    
    let deals = {};
    let queryDate = date;
    
    if (!queryDate) {
      // Check cache for latest date first
      const latestDateCacheKey = `latest_date_${targetDb}`;
      queryDate = !isNoCache ? cacheService.get(latestDateCacheKey) : null;
      
      if (!queryDate) {
        logger.info('No date specified, finding most recent date with deals...');
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Admin SDK timeout')), 6000));
          const latestSnapshot = await Promise.race([ref.orderByChild('datetime').limitToLast(1).once('value'), timeoutPromise]);
          const latestVal = latestSnapshot.val() || {};
          const latestKey = Object.keys(latestVal)[0];
          
          if (latestKey && latestVal[latestKey]) {
            queryDate = latestVal[latestKey].date;
            logger.info(`Found latest date: ${queryDate}.`);
            cacheService.set(latestDateCacheKey, queryDate, 2 * 60 * 1000); // cache for 2 minutes
          }
        } catch (findErr) {
          logger.warn('Finding latest date timed out, continuing without date', { error: findErr.message });
        }
      } else {
        logger.info(`Using cached latest date: ${queryDate}`);
      }
    }
    
    if (queryDate) {
      // Check cache for raw deals on this date
      const rawDealsCacheKey = `raw_deals_${targetDb}_${queryDate}`;
      deals = !isNoCache ? cacheService.get(rawDealsCacheKey) : null;
      
      if (!deals) {
        logger.info(`Fetching raw deals from Firebase for date ${queryDate}...`);
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Admin SDK timeout')), 8000));
          const snapshotPromise = ref.orderByChild('date').equalTo(queryDate).once('value');
          const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);
          deals = snapshot.val() || {};
          cacheService.set(rawDealsCacheKey, deals, 10 * 60 * 1000); // Cache raw data for 10 minutes
        } catch (fetchErr) {
          logger.warn('Firebase query failed or timed out, trying REST API fallback', { error: fetchErr.message });
          const config = require('../../../config/config');
          const constants = require('../../../config/constants');
          const dbname = constants.postingTypesConfig[constants.type].DB;
          let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
          const baseUrl = DB_Name === 'lowerdealhub' 
            ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/${targetDb}.json`
            : `https://${DB_Name}-default-rtdb.firebaseio.com/${targetDb}.json`;
          const apiUrl = `${baseUrl}?orderBy="date"&equalTo="${queryDate}"`;
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(fetchTimeout);
            if (!response.ok) throw new Error(`REST API failed: ${response.statusText}`);
            deals = await response.json() || {};
            cacheService.set(rawDealsCacheKey, deals, 10 * 60 * 1000);
          } catch (restErr) {
            clearTimeout(fetchTimeout);
            logger.error('REST API fallback failed', { error: restErr.message });
            deals = {};
          }
        }
      } else {
        logger.info(`Using cached raw deals for date ${queryDate}`);
      }
    } else {
      // Fallback if no deals at all in the DB (query last 300 items)
      logger.info('No deals found to determine latest date, querying default pool.');
      const poolSize = Math.max((parseInt(offset || 0) + parseInt(limit || 100)) * 1.5, 300);
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Admin SDK timeout')), 8000));
        const snapshot = await Promise.race([ref.orderByChild('datetime').limitToLast(poolSize).once('value'), timeoutPromise]);
        deals = snapshot.val() || {};
      } catch (poolErr) {
        deals = {};
      }
    }
    
    // Convert to array and filter for display eligibility (valid title, valid image, valid price/stock)
    let dealsArray = Object.entries(deals).map(([key, value]) => ({
      productCode: key,
      ...value
    })).filter(isValidDealForDisplay);

    // Filter by platform if specified
    if (platform) {
      dealsArray = dealsArray.filter(deal => 
        deal.storeType?.toLowerCase() === platform.toLowerCase()
      );
    }

    // Filter by categoryGroup if specified (only return the requested category)
    if (categoryGroup) {
      dealsArray = dealsArray.filter(deal => 
        deal.categoryGroup === categoryGroup
      );
    }

    // Filter by staticSubcategory if specified
    if (staticSubcategory) {
      dealsArray = dealsArray.filter(deal => 
        deal.staticSubcategory?.toLowerCase() === staticSubcategory.toLowerCase()
      );
    }

    // Relevance scoring helper
    const getRelevanceScore = (product) => {
      let score = 0;
      const price = parseFloat(String(product.price || '0').replace(/[^\d.-]/g, ''));
      if (!isNaN(price) && price > 0) {
        if (price >= 1500 && price <= 7000) score += 60; // Sweet spot for conversion
        else if (price >= 7000 && price <= 15000) score += 40; // Mid-high range
        else if (price >= 500 && price < 1500) score += 35; // Budget range
        else if (price > 15000 && price <= 30000) score += 15;
        else if (price > 50000) score -= 30; // Demote extremely expensive premium products
      }
      const discountStr = String(product.discount || '0');
      const discountMatch = discountStr.match(/(\d+)/);
      if (discountMatch) {
        const pct = parseInt(discountMatch[1]);
        if (!isNaN(pct)) score += pct * 1.2; // Higher discount adds relevance points
      }
      const rating = parseFloat(String(product.rating || '0'));
      if (!isNaN(rating) && rating > 0) {
        if (rating >= 4.5) score += 30;
        else if (rating >= 4.0) score += 20;
        else if (rating >= 3.5) score += 10;
      }
      const count = parseInt(String(product.ratingsCount || '0').replace(/[^\d]/g, ''));
      if (!isNaN(count) && count > 100) {
        score += Math.min(20, Math.floor(count / 50));
      }
      if (product.isDeal === true || product.isDeal === 'true') {
        score += 40;
      }
      return score;
    };

    const isDesc = order ? order.toLowerCase() !== 'asc' : true;

    if (sortBy && sortBy !== 'default' && sortBy !== 'relevance') {
      dealsArray.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'price') {
          valA = parseFloat(String(a.price || '0').replace(/[^\d.-]/g, '')) || 0;
          valB = parseFloat(String(b.price || '0').replace(/[^\d.-]/g, '')) || 0;
        } else if (sortBy === 'discount') {
          valA = parseFloat(String(a.discount || '0').replace(/[^0-9.]/g, '')) || 0;
          valB = parseFloat(String(b.discount || '0').replace(/[^0-9.]/g, '')) || 0;
        } else if (sortBy === 'title') {
          valA = (a.title || '').toLowerCase();
          valB = (b.title || '').toLowerCase();
        } else if (sortBy === 'updateTimestamp' || sortBy === 'date') {
          valA = Number(a.updatedatetime || a.updateTimestamp || a.datetime || 0);
          valB = Number(b.updatedatetime || b.updateTimestamp || b.datetime || 0);
        } else {
          valA = Number(a.datetime || 0);
          valB = Number(b.datetime || 0);
        }

        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    } else {
      // Default: Relevance sort + recency fallback
      dealsArray.sort((a, b) => {
        const aScore = getRelevanceScore(a);
        const bScore = getRelevanceScore(b);
        if (aScore !== bScore) {
          return bScore - aScore; // Highest relevance score first
        }
        const aTime = Number(a.updatedatetime || a.datetime || 0);
        const bTime = Number(b.updatedatetime || b.datetime || 0);
        return bTime - aTime;
      });
    }

    // Apply pagination
    const total = dealsArray.length;
    const paginated = dealsArray.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Get notification statuses only for the paginated deals in parallel (highly optimized, avoids full table download)
    const dealsWithNotifications = await Promise.all(paginated.map(async (deal) => {
      const notificationStatus = await notificationTrackingDB.getNotificationStatus(deal.productCode);
      return {
        ...deal,
        notificationStatus: notificationStatus
      };
    }));

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

    const clientMetadata = {
      ip: req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress,
      origin: req.headers.origin || req.headers.referer || 'Website Direct',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };
    logger.info('Manual bulk update triggered', { sourceType, targetDb, clientMetadata });

    runBulkUpdateAll(sourceType, targetDb, clientMetadata)
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
 * GET /api/deals/search
 * Global search across the lightweight search index
 * Query params: q (search query), limit, offset
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const query = q.toLowerCase().trim();
    
    // Fetch the lightweight index from in-memory cache (falls back to direct Firebase once read if not loaded yet)
    const indexData = isCacheLoaded ? searchIndexCache : ((await productDealsDB.searchIndexRef.once('value')).val() || {});
    
    // Filter the index in-memory
    const matchedKeys = [];
    Object.entries(indexData).forEach(([key, data]) => {
      if ((data.t && data.t.includes(query)) || 
          (data.b && data.b.includes(query)) || 
          (data.c && data.c.includes(query))) {
        matchedKeys.push(key);
      }
    });
    
    // Paginate matched keys
    const total = matchedKeys.length;
    const paginatedKeys = matchedKeys.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // Fetch full deal details for paginated keys
    // We will search both deals and productdeals to be safe, starting with productdeals
    const fetchDeal = async (key) => {
      let doc = await productDealsDB.productdealsRef.child(key).once('value');
      if (!doc.exists()) {
        doc = await productDealsDB.dealsRef.child(key).once('value');
      }
      return doc.exists() ? { productCode: key, ...doc.val() } : null;
    };
    
    const fullDeals = await Promise.all(paginatedKeys.map(fetchDeal));
    const validDeals = fullDeals.filter(isValidDealForDisplay);

    res.json({
      success: true,
      data: validDeals,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    logger.error('Error in global search', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/deals/sale/:saleName
 * Get products matching a specific sale name
 */
router.get('/sale/:saleName', async (req, res, next) => {
  try {
    const { saleName } = req.params;
    const { limit = 100 } = req.query;
    
    // Check both standard deals and static productdeals
    const [dealsSnap, staticSnap] = await Promise.all([
      productDealsDB.dealsRef
        .orderByChild('saleName')
        .equalTo(saleName)
        .limitToLast(Number(limit))
        .once('value'),
      productDealsDB.staticRef
        .orderByChild('saleName')
        .equalTo(saleName)
        .limitToLast(Number(limit))
        .once('value')
    ]);

    let products = [];
    if (dealsSnap.exists()) {
      Object.values(dealsSnap.val()).forEach(p => {
        if (isValidDealForDisplay(p)) products.push(p);
      });
    }
    if (staticSnap.exists()) {
      Object.values(staticSnap.val()).forEach(p => {
        if (isValidDealForDisplay(p)) products.push(p);
      });
    }

    // Sort descending by datetime if available
    products.sort((a, b) => {
      const timeA = a.datetime ? new Date(a.datetime).getTime() : 0;
      const timeB = b.datetime ? new Date(b.datetime).getTime() : 0;
      return timeB - timeA;
    });
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    logger.error('Error fetching sale products', { saleName: req.params.saleName, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sale products' });
  }
});

/**
 * GET /api/deals/:productCode
 * Get a single product by product code
 * Query params: db (deals|productdeals)
 */
router.get('/:productCode', async (req, res, next) => {
  try {
    let { productCode } = req.params;
    const { db = 'deals' } = req.query;
    const targetDb = db === 'productdeals' ? 'productdeals' : 'deals';
    
    // If it looks like a URL, extract the product code
    if (productCode && (productCode.startsWith('http://') || productCode.startsWith('https://'))) {
      const storeKey = resolvePlatformFromUrl(productCode);
      if (storeKey) {
        const extracted = getCode(productCode, storeKey);
        if (extracted && extracted.isValid && extracted.value) {
          productCode = extracted.value;
        }
      }
    }
    
    if (!productCode) {
      return res.status(400).json({
        success: false,
        error: 'Product code is required'
      });
    }

    logger.info('Fetching product by code', { productCode, targetDb });

    let ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    // Helper function to search in a specific ref
    const searchInRef = async (dbRef) => {
      let snapshot = await dbRef.orderByChild('productCode').equalTo(productCode).once('value');
      if (snapshot.exists()) {
        const products = snapshot.val();
        return { key: Object.keys(products)[0], data: products[Object.keys(products)[0]] };
      }
      // Fallback: try direct key lookup
      snapshot = await dbRef.child(safeKey).once('value');
      if (snapshot.exists()) {
        return { key: safeKey, data: snapshot.val() };
      }
      return null;
    };

    let result = await searchInRef(ref);
    let product = result?.data;
    let productKey = result?.key;

    if (!product) {
      // Try the other database
      const otherTargetDb = targetDb === 'deals' ? 'productdeals' : 'deals';
      logger.info('Product not found in primary DB, checking fallback DB', { productCode, fallbackDb: otherTargetDb });
      ref = otherTargetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
      result = await searchInRef(ref);
      product = result?.data;
      productKey = result?.key;
    }

    if (!product || !isValidDealForDisplay(product)) {
      return res.status(404).json({
        success: false,
        error: !product ? 'Product not found' : 'Product unavailable or missing valid image',
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


function cleanProductUrl(url) {
  if (!url) return '';
  // Check if it's an inrdeals or affiliate wrapper containing another URL
  const httpIndex = url.indexOf('http', 4); // look for http after the first one
  if (httpIndex !== -1) {
    return url.substring(httpIndex);
  }
  return url;
}

function getUrlFromProduct(product) {
  if (!product) return '';
  if (product.productUrl) return product.productUrl;
  if (product.url) return product.url;
  if (product.link) return product.link;
  if (product.links) {
    if (product.links.avinashbmvINR) return product.links.avinashbmvINR;
    if (product.links.avinashbmv) return product.links.avinashbmv;
  }
  if (product.competitorMatches) {
    for (const match of Object.values(product.competitorMatches)) {
      if (match && match.link) return match.link;
    }
  }
  return '';
}

/**
 * POST /api/deals/:productCode/retrigger
 * Retrigger a single product
 */
router.post('/:productCode/retrigger', async (req, res) => {
  try {
    let { productCode } = req.params;
    let db = req.query.db || 'productdeals';

    // If it looks like a URL, extract the product code
    if (productCode && (productCode.startsWith('http://') || productCode.startsWith('https://'))) {
      const cleanUrl = cleanProductUrl(productCode);
      const storeKey = resolvePlatformFromUrl(cleanUrl);
      if (storeKey) {
        const extracted = getCode(cleanUrl, storeKey);
        if (extracted && extracted.isValid && extracted.value) {
          productCode = extracted.value;
        }
      }
    }
    let product = await productDealsDB.getProduct(productCode, db);
    let targetUrl = getUrlFromProduct(product);
    
    if (!product || !targetUrl) {
      // Try the other database if not found
      db = db === 'productdeals' ? 'deals' : 'productdeals';
      product = await productDealsDB.getProduct(productCode, db);
      targetUrl = getUrlFromProduct(product);
      if (!product || !targetUrl) {
        return res.status(404).json({ success: false, error: 'Product or URL not found in any database' });
      }
    }

    targetUrl = cleanProductUrl(targetUrl);

    // If in cloud environment (Render), queue to Firebase commandsQueue instead of launching Chrome
    const isCloudRetrigger = Boolean(process.env.RENDER || process.env.HYBRID_EXECUTION === 'true' || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (isCloudRetrigger && admin.apps.length) {
      logger.info('Cloud environment detected on retrigger. Queueing to commandsQueue', { productCode, targetUrl });
      const db = admin.database();
      const queueRef = db.ref('commandsQueue');
      const newCommandRef = queueRef.push();
      const safeUrl = targetUrl.replace(/"/g, '\\"');
      const cliCommand = `node scripts/processSingleProduct.js "${safeUrl}" false null`;

      await newCommandRef.set({
        id: `retrigger-${productCode}-${Date.now()}`,
        command: cliCommand,
        name: `Retrigger Product: ${productCode}`,
        role: 'all',
        status: 'pending',
        createdAt: new Date().toISOString(),
        triggeredBy: 'dashboard-retrigger'
      });

      return res.json({
        success: true,
        queued: true,
        queuedId: newCommandRef.key,
        message: 'Product retrigger task queued in Firebase for Local Daemon execution.'
      });
    }
    
    const driver = global.driver || await getOrCreateDriver();
    const { scrapeProduct } = require('../../../scrappers/amazon');
    const { resolvePlatformFromUrl } = require('../../../utils/platformUtils');
    const { getformattedDate } = require('../../../utils/commonUtils');
    
    const platform = resolvePlatformFromUrl(targetUrl) || 'amazon';
    
    // IMPORTANT: We must navigate to the product URL before scraping!
    await driver.get(targetUrl);
    
    const extractedData = await scrapeProduct(
      targetUrl, 
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
        productUrl: targetUrl,
        date: getformattedDate(),
        updateTimestamp: getISTTimestamp(),
        updatedAt: getISTTimestamp(),
        updatedatetime: Date.now()
      };
      
      // Keep existing photo if the new extraction failed to find one
      if (!updatedProduct.photo && product.photo) {
        updatedProduct.photo = product.photo;
      }

      // Sync price in this product's own competitorMatches
      if (updatedProduct.competitorMatches) {
        for (const [key, match] of Object.entries(updatedProduct.competitorMatches)) {
          if (key.toLowerCase() === platform.toLowerCase() && match) {
            match.price = extractedData.price;
          }
        }
      }
      
      await productDealsDB.updateIndividualProduct(productCode, updatedProduct, db);

      // Bidirectional sync: update competitor's match reference to this product
      if (product.competitorMatches) {
        for (const [compPlatform, match] of Object.entries(product.competitorMatches)) {
          if (match && match.key && compPlatform.toLowerCase() !== platform.toLowerCase()) {
            try {
              const compProduct = await productDealsDB.getProduct(match.key, db);
              if (compProduct && compProduct.competitorMatches) {
                let compUpdated = false;
                for (const [mPlatform, mData] of Object.entries(compProduct.competitorMatches)) {
                  if (mPlatform.toLowerCase() === platform.toLowerCase() && mData && mData.key === productCode) {
                    mData.price = extractedData.price;
                    compUpdated = true;
                  }
                }
                if (compUpdated) {
                  await productDealsDB.updateIndividualProduct(match.key, compProduct, db);
                  logger.info(`Bidirectionally updated price for competitor ${match.key} in ${db}`);
                }
              }
            } catch (err) {
              logger.error(`Failed to bidirectionally update competitor ${match.key}`, { error: err.message });
            }
          }
        }
      }

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

// Pre-warm cache on startup
setTimeout(async () => {
  if (process.env.DISABLE_CACHE_PREWARM === 'true' || process.env.RENDER === 'true') {
    logger.info('Startup cache pre-warming skipped (running on Render or pre-warm disabled).');
    return;
  }
  try {
    logger.info('Pre-warming deals cache on startup...');
    const targetDbs = ['deals', 'productdeals'];
    for (const targetDb of targetDbs) {
      const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
      const latestSnapshot = await ref.orderByChild('datetime').limitToLast(1).once('value');
      const latestVal = latestSnapshot.val() || {};
      const latestKey = Object.keys(latestVal)[0];
      if (latestKey && latestVal[latestKey]) {
        const queryDate = latestVal[latestKey].date;
        const latestDateCacheKey = `latest_date_${targetDb}`;
        cacheService.set(latestDateCacheKey, queryDate, 2 * 60 * 1000);
        
        logger.info(`Pre-fetching raw deals for ${targetDb} on date ${queryDate}...`);
        const snapshot = await ref.orderByChild('date').equalTo(queryDate).once('value');
        const deals = snapshot.val() || {};
        const rawDealsCacheKey = `raw_deals_${targetDb}_${queryDate}`;
        cacheService.set(rawDealsCacheKey, deals, 10 * 60 * 1000);
        logger.info(`Deals cache pre-warmed for ${targetDb} (Count: ${Object.keys(deals).length}).`);
      }
    }
  } catch (err) {
    logger.warn('Failed to pre-warm deals cache:', { error: err.message });
  }
}, 5000);

module.exports = router;

