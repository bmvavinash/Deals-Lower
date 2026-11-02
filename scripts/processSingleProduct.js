/**
 * scripts/processSingleProduct.js
 * CLI runner for extracting and processing a single product or listing page URL.
 * Designed to be executed by localDaemon from Firebase commandsQueue.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
const { getModuleLogger } = require('../logger/logger');
const { createChromeDriver } = require('../utils/seleniumDriver');
const { getProductDetails } = require('../scheduler');
const { productStatus, storeMap } = require('../config/const');
const { resolvePlatformFromUrl } = require('../utils/platformUtils');
const { getAccessToken } = require('../database/getAccessToken');
const { firebaseget } = require('../database/firebaseget');
const { extractAndStoreFromUrl } = require('../dataSources/batchProductExtractor');

const logger = getModuleLogger('processSingleProduct');

async function main() {
  const url = process.argv[2];
  const postProduct = process.argv[3] === 'true';
  const saleName = process.argv[4] && process.argv[4] !== 'null' ? process.argv[4] : null;

  if (!url || typeof url !== 'string' || !url.trim()) {
    console.error('Usage: node scripts/processSingleProduct.js <url> [postProduct] [saleName]');
    process.exit(1);
  }

  logger.info(`Starting single product processing`, { url, postProduct, saleName });

  let driver = null;
  try {
    const driverResult = await createChromeDriver();
    driver = driverResult.driver;
    logger.info(`WebDriver initialized (${driverResult.mode} mode)`);

    // Navigate to URL and resolve redirect
    logger.info(`Navigating to URL: ${url}`);
    await driver.get(url);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const resolvedUrl = (await driver.getCurrentUrl()) || url;
    logger.info(`URL resolved in browser`, { original: url, resolved: resolvedUrl });

    // Determine platform and code
    const storeKey = resolvePlatformFromUrl(resolvedUrl);
    let productCode = null;
    if (storeKey && storeMap && storeMap[storeKey]) {
      try {
        productCode = storeMap[storeKey].getCode(resolvedUrl);
      } catch (codeErr) {
        logger.warn(`Could not extract productCode via storeMap`, { error: codeErr.message });
      }
    }

    if (productCode) {
      logger.info(`Detected single product: [${storeKey || 'Unknown'}] code=${productCode}`);
      
      const accessToken = await getAccessToken();
      const jsonDataResult = await firebaseget();
      const jsonData = jsonDataResult?.data || jsonDataResult || {};
      const todayJsonDataResult = await firebaseget(true);
      const todayJsonData = todayJsonDataResult?.data || todayJsonDataResult || {};
      const len = jsonDataResult?.len || 0;

      const errorContext = {};
      const result = await getProductDetails(
        driver,
        resolvedUrl,
        '',
        len,
        accessToken,
        jsonData,
        todayJsonData,
        postProduct,
        '',
        false,
        '',
        null,
        errorContext,
        saleName
      );

      logger.info(`Product processing finished with result: ${result}`, { errorContext });
      console.log(`[SUCCESS] Product processed: ${productCode} (Result: ${result})`);
    } else {
      logger.info(`No product code found. Treating URL as listing or search page: ${resolvedUrl}`);
      await extractAndStoreFromUrl(driver, resolvedUrl, 'website', '', null, 'productdeals', storeKey);
      console.log(`[SUCCESS] Listing/search page extraction completed for: ${resolvedUrl}`);
    }

    process.exit(0);
  } catch (err) {
    logger.error(`Error in processSingleProduct`, { error: err.message, stack: err.stack });
    console.error(`[ERROR] Processing failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch (quitErr) {
        // ignore quit error
      }
    }
  }
}

main();
