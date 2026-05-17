const { getProductDetails } = require("../scheduler");
const { productStatus, storeMap, searchStatus } = require("../config/const");
const { loadConfig, scrapePage } = require("../pageScheduler");
const constants = require("../config/constants");
const { getModuleLogger } = require("../logger/logger");
const { getExtrapeUrl } = require("../affiliate/extrape");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
const { extractAndStoreFromUrl } = require("./batchProductExtractor");
const { executionTracker } = require("../services/executionTracker");
const { isDriverSessionValid } = require("../utils/seleniumDriver");
const { resolvePlatformFromUrl } = require("../utils/platformUtils");

const logger = getModuleLogger('handleProductProcessing');

async function processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct = true, username, generateLink, shortUrl = "") {
  const isProductPosted = await getProductDetails(
    driver,
    link,
    text,
    len,
    accessToken,
    jsonData,
    todayJsonData,
    postProduct,
    username,
    constants.generateLink,
    shortUrl
  );

  if (isProductPosted === productStatus.PRODUCT_ERROR) {
    logger.warn('Missed link during processProduct', { link });
  } else if (isProductPosted === productStatus.PRODUCT_EXCLUDED) {
    logger.warn('Excluded product (Aff policy)', { link });
  }
}

async function handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData, username = "", generateLink = false) {
  try {
    if (!(await isDriverSessionValid(driver))) {
      logger.warn('WebDriver not ready, skipping product processing', { link });
      return searchStatus.SEARCH_NOT_APPLICABLE;
    }

    let shortUrl = link;
    let resolvedUrl = link;
    
    // Always resolve URL in browser first to get final destination
    try { 
      await driver.get(link); 
      resolvedUrl = await driver.getCurrentUrl() || link;
      logger.info('URL resolved in browser', { original: link, resolved: resolvedUrl });
    } catch (e) {
      logger.warn('Failed to resolve URL in browser', { url: link, error: e?.message });
    }

    // For user "avi" messages, prepend inrdeals.com URL
    if (generateLink && username && username.toLowerCase().includes('avi')) {
      const inrdealsUrl = `https://inrdeals.com/avi646476329/${resolvedUrl}`;
      logger.info('Prepending inrdeals.com URL for user avi', { original: resolvedUrl, inrdeals: inrdealsUrl });
      resolvedUrl = inrdealsUrl;
    }

    const storeKey = resolvePlatformFromUrl(resolvedUrl);
    if (!storeKey || !storeMap[storeKey]) {
      logger.warn('Unsupported store', { url: resolvedUrl, storeKey: storeKey || 'unknown' });
      return searchStatus.SEARCH_NOT_APPLICABLE;
    }

    const { getCode } = storeMap[storeKey];
    const productCode = getCode(resolvedUrl);
    
    // Track Telegram bot execution if this is from Telegram
    const isTelegramSource = username && username !== '';
    if (isTelegramSource) {
      // Ensure Telegram execution is started
      if (!executionTracker.currentExecution || executionTracker.currentExecution.type !== 'telegram_bot') {
        await executionTracker.startTelegramExecution(username);
      }
    }

    if (productCode) {
      // Generate appropriate shortlink based on store type and generateLink flag
      let finalShortUrl = shortUrl;
      if (generateLink) {
        try {
          if (storeKey === 'amazon' || resolvedUrl.includes('amazon')) {
            // Amazon products - use amazonLinkGenerator
            finalShortUrl = await amazonLinkGenerator(driver);
            logger.info('Generated Amazon shortlink', { shortlink: finalShortUrl });
          } else {
            // Non-Amazon products - use extrape
            finalShortUrl = await getExtrapeUrl(driver, resolvedUrl);
            logger.info('Generated non-Amazon shortlink', { shortlink: finalShortUrl });
          }
        } catch (e) {
          logger.error('Failed to generate shortlink', { error: e?.message, store: storeKey });
        }
      }
      
      await processProduct(driver, resolvedUrl, text, len, accessToken, jsonData, todayJsonData, true, username, generateLink, finalShortUrl);
      return searchStatus.SEARCH_CREATED;
    }

    if (!String(username || '').includes('dealsglobalhub')) {
      return searchStatus.SEARCH_NOT_APPLICABLE;
    }

    // Fallback: scrape listing/search page and bulk save all products
    try {
      const platform = resolvePlatformFromUrl(resolvedUrl) || resolvePlatformFromUrl(link);
      if (!platform || !storeMap[platform]) {
        logger.warn('Unsupported platform for scraping', { url: link, platform: platform || 'unknown' });
        return searchStatus.SEARCH_NOT_APPLICABLE;
      }

      logger.info('Processing search page - using bulk extraction and storage', { url: link, platform, username });
      
      // Use batch extractor which handles normalization, validation, and bulk storage
      const result = await extractAndStoreFromUrl(
        driver,
        resolvedUrl,
        'telegram', // sourceType
        '', // categoryKey
        null, // ctx (no context tracking needed here)
        'deals' // targetDb
      );

      logger.info('Search page products processed via bulk extraction', {
        url: link,
        extracted: result.extracted,
        stored: result.stored,
        created: result.created,
        updated: result.updated,
        platform,
        username
      });

      // Track bulk operation in execution tracker (summary tracking)
      if (result.stored > 0) {
        try {
          // Update progress with batch summary
          await executionTracker.updateTelegramProductProgress(
            platform, 
            result.created > 0 ? 'created' : 'updated', 
            `batch_search_${Date.now()}`
          );
          logger.debug('Execution tracker updated for batch search products', {
            platform,
            stored: result.stored,
            created: result.created,
            updated: result.updated
          });
        } catch (e) {
          logger.warn('Failed to track batch product progress', { error: e?.message });
        }
      }

      return searchStatus.SEARCH_CREATED;
    } catch (e) {
      logger.error('Fallback scrape failed', { error: e?.message, stack: e?.stack });
      return searchStatus.SEARCH_ERROR;
    }
  } catch (e) {
    logger.error('handleProductProcessing fatal', { error: e?.message });
    return searchStatus.SEARCH_ERROR;
  }
}

module.exports = { handleProductProcessing };





