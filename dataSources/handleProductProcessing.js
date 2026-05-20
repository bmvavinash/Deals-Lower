const { getProductDetails } = require("../scheduler");
const { productStatus, storeMap, searchStatus } = require("../config/const");
const { loadConfig, scrapePage } = require("../pageScheduler");
const constants = require("../config/constants");
const { getModuleLogger } = require("../logger/logger");
const { getExtrapeUrl } = require("../affiliate/extrape");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
const { executionTracker } = require("../services/executionTracker");

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
    return searchStatus.SEARCH_ERROR;
  }
  if (isProductPosted === productStatus.PRODUCT_EXCLUDED) {
    logger.warn('Excluded product (Aff policy)', { link });
    return searchStatus.SEARCH_NOT_APPLICABLE;
  }
  if (isProductPosted === productStatus.PRODUCT_CREATED || isProductPosted === productStatus.PRODUCT_UPDATED_SUCCESSFULLY) {
    return searchStatus.SEARCH_CREATED;
  }
  return searchStatus.SEARCH_ERROR;
}

async function handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData, username = "", generateLink = false) {
  try {
    if (!storeMap || typeof storeMap !== 'object') {
      logger.error('storeMap unavailable in handleProductProcessing');
      return searchStatus.SEARCH_ERROR;
    }
    if (!driver) {
      logger.error('WebDriver not available for handleProductProcessing');
      return searchStatus.SEARCH_ERROR;
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

    const storeKey = Object.keys(storeMap).find(key => resolvedUrl.includes(key));
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
      
      const status = await processProduct(driver, resolvedUrl, text, len, accessToken, jsonData, todayJsonData, true, username, generateLink, finalShortUrl);
      return status;
    }

    if (!String(username || '').includes('dealsglobalhub')) {
      return searchStatus.SEARCH_NOT_APPLICABLE;
    }

    // Fallback: scrape listing/search page for first few products
    try {
      const platform = Object.keys(storeMap).find(key => link.includes(key));
      if (!platform || !storeMap[platform]) {
        logger.warn('Unsupported platform for scraping', { url: link, platform: platform || 'unknown' });
        return searchStatus.SEARCH_NOT_APPLICABLE;
      }
      const pageType = 'searchPage';
      const config = await loadConfig(`./PageConfig/${platform}PageConfig.js`);
      const products = await scrapePage(link, driver, config, pageType);

      for (let i = 0; i < (products?.length || 0); i++) {
        const product = products[i];
        const postProduct = i < 1; // first product: post; next could be enrichment only
        try { await driver.get(product?.productUrl); } catch (_) {}
        await processProduct(driver, product?.productUrl, product?.name || text, len, accessToken, jsonData, todayJsonData, postProduct, username, generateLink);
        if (i >= 2) break; // limit work per message
      }
      return searchStatus.SEARCH_CREATED;
    } catch (e) {
      logger.error('Fallback scrape failed', { error: e?.message });
      return searchStatus.SEARCH_ERROR;
    }
  } catch (e) {
    logger.error('handleProductProcessing fatal', { error: e?.message });
    return searchStatus.SEARCH_ERROR;
  }
}

module.exports = { handleProductProcessing };





