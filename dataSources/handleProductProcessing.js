const { getProductDetails } = require("../scheduler");
const { productStatus, storeMap, searchStatus } = require("../config/const");
const { loadConfig, scrapePage } = require("../pageScheduler");
const constants = require("../config/constants");
const { getModuleLogger } = require("../logger/logger");

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

async function handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData, username = "") {
  try {
    let shortUrl = link;
    try { await driver.get(link); } catch (_) {}
    try { link = (await driver.getCurrentUrl()) || link; } catch (_) {}

    const storeKey = Object.keys(storeMap).find(key => link.includes(key));
    if (!storeKey || !storeMap[storeKey]) {
      logger.warn('Unsupported store', { url: link, storeKey: storeKey || 'unknown' });
      return searchStatus.SEARCH_NOT_APPLICABLE;
    }

    const { getCode } = storeMap[storeKey];
    const productCode = getCode(link);

    if (productCode) {
      await processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData, true, username, constants.generateLink, shortUrl);
      return searchStatus.SEARCH_CREATED;
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
        await processProduct(driver, product?.productUrl, product?.name || text, len, accessToken, jsonData, todayJsonData, postProduct, username, true);
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





