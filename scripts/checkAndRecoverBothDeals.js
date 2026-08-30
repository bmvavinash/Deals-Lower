process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const missingDataRecoveryService = require('../services/missingDataRecoveryService');
const { scrapeProduct } = require('../scrappers/amazon');
const { getModuleLogger } = require('../logger/logger');
const { resolvePlatformFromUrl } = require('../utils/platformUtils');

const logger = getModuleLogger('checkAndRecoverBothDeals');

async function initializeDriver() {
  try {
    logger.info('🌐 Initializing headless Chrome WebDriver...');
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--disable-infobars');
    options.addArguments('--lang=en-US');
    options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    options.excludeSwitches(['enable-automation']);
    const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    global.driver = driver;
    logger.info('✅ Headless Chrome WebDriver initialized successfully');
    return driver;
  } catch (error) {
    logger.error('❌ Failed to initialize WebDriver:', { error: error.message });
    throw error;
  }
}

function isMissingCriticalData(product) {
  if (!product) return true;
  // Critical UI fields: title, price, photo/image
  return !product.title || !product.price || (!product.photo && !product.image);
}

function getMissingFieldsList(product) {
  const missing = [];
  if (!product.title) missing.push('title');
  if (!product.price) missing.push('price');
  if (!product.photo && !product.image) missing.push('photo/image');
  if (!product.brand) missing.push('brand');
  return missing;
}

async function run() {
  let driver = null;
  const unresolved = [];
  let totalChecked = 0;
  let totalMissing = 0;
  let totalRecovered = 0;

  try {
    // 1. Initialize driver
    driver = await initializeDriver();

    // Collections to check
    const collections = ['deals', 'productdeals'];

    for (const collection of collections) {
      console.log(`\n📥 Fetching the last 200 products from collection: '${collection}'...`);
      const targetRef = collection === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
      const snapshot = await targetRef.limitToLast(200).once('value');
      const allProducts = snapshot.val() || {};
      const productCount = Object.keys(allProducts).length;
      console.log(`📊 Retrieved ${productCount} products from '${collection}'`);

      for (const [key, product] of Object.entries(allProducts)) {
        totalChecked++;
        
        // Skip if product has no productCode (fallback to key)
        const pCode = product.productCode || key;
        const pUrl = product.productUrl || product.url || product.link;
        const sUrl = product.sourceUrl || product.parentUrl || '';

        if (isMissingCriticalData(product)) {
          totalMissing++;
          const missingFields = getMissingFieldsList(product);
          console.log(`⚠️ [${collection}] Product ${pCode} is missing: ${missingFields.join(', ')}`);
          console.log(`   Product URL: ${pUrl}`);
          console.log(`   Source URL: ${sUrl}`);

          // Try to recover missing data
          try {
            // Setup required fields on the product object so recoverMissingData works
            const productToRecover = {
              productCode: pCode,
              key: key,
              productUrl: pUrl,
              sourceUrl: sUrl,
              storeType: product.storeType || '',
              ...product
            };

            console.log(`   Attempting recovery...`);
            let platform = resolvePlatformFromUrl(pUrl) || (product.storeType || '').toLowerCase() || 'amazon';
            let recovered = null;

            if (pUrl) {
              try {
                console.log(`   [scrapeProduct] Navigating directly to product URL: ${pUrl}`);
                await driver.get(pUrl);
                await new Promise(r => setTimeout(r, 4000));
                
                const scraped = await scrapeProduct(pUrl, platform, driver, "", false, "", false, "");
                if (scraped && (scraped.title || scraped.price || scraped.photo || scraped.image)) {
                  recovered = {
                    dataRecovered: true
                  };
                  if (scraped.title) recovered.title = scraped.title;
                  if (scraped.price) recovered.price = scraped.price;
                  if (scraped.photo) recovered.photo = scraped.photo;
                  else if (scraped.image) recovered.photo = scraped.image;
                  if (scraped.brand) recovered.brand = scraped.brand;
                  if (scraped.mrp) recovered.mrp = scraped.mrp;
                  if (scraped.discount) recovered.discount = scraped.discount;
                  
                  console.log(`   [scrapeProduct] Successfully scraped product details directly.`);
                } else {
                  console.log(`   [scrapeProduct] Scraped object was empty or missing required fields. Falling back...`);
                }
              } catch (err) {
                console.log(`   [scrapeProduct] Error during direct product page scraping: ${err.message}. Falling back...`);
              }
            }

            if (!recovered) {
              console.log(`   [recoverMissingData] Falling back to category/search page scraping...`);
              recovered = await missingDataRecoveryService.recoverMissingData(productToRecover, driver);
            }

            if (recovered && recovered.dataRecovered) {
              totalRecovered++;
              console.log(`   ✅ Successfully recovered details for ${pCode}!`);
              
              // Prepare database updates (only update fields that were actually recovered)
              const updates = {};
              if (recovered.title) updates.title = recovered.title;
              if (recovered.price) updates.price = recovered.price;
              if (recovered.photo) updates.photo = recovered.photo;
              if (recovered.brand) updates.brand = recovered.brand;
              if (recovered.mrp) updates.mrp = recovered.mrp;
              if (recovered.discount) updates.discount = recovered.discount;

              // Save to DB
              await productDealsDB.updateIndividualProduct(pCode, updates, collection);
              console.log(`   💾 Database updated for ${pCode} in '${collection}'`);
            } else {
              console.log(`   ❌ Recovery failed for ${pCode}`);
              unresolved.push({
                collection,
                productCode: pCode,
                title: product.title || null,
                brand: product.brand || null,
                price: product.price || null,
                photo: product.photo || product.image || null,
                productUrl: pUrl,
                sourceUrl: sUrl,
                missingFields
              });
            }
          } catch (recoveryErr) {
            console.error(`   💥 Error during recovery attempt for ${pCode}:`, recoveryErr.message);
            unresolved.push({
              collection,
              productCode: pCode,
              productUrl: pUrl,
              sourceUrl: sUrl,
              missingFields,
              error: recoveryErr.message
            });
          }

          // Small delay between scrapes to be polite
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.log('\n==============================================');
    console.log('📊 DATABASE CHECK & RECOVERY SUMMARY:');
    console.log('==============================================');
    console.log(`📦 Total products checked: ${totalChecked}`);
    console.log(`🔍 Total products with missing critical data: ${totalMissing}`);
    console.log(`✅ Successfully recovered: ${totalRecovered}`);
    console.log(`❌ Remaining unresolved products: ${unresolved.length}`);
    console.log('==============================================\n');

    if (unresolved.length > 0) {
      console.log('📋 UNRESOLVED PRODUCTS (User Review Required):');
      unresolved.forEach((item, index) => {
        console.log(`\n[${index + 1}] Collection: ${item.collection} | Code: ${item.productCode}`);
        console.log(`    Missing fields: ${item.missingFields.join(', ')}`);
        console.log(`    Product URL: ${item.productUrl}`);
        console.log(`    Source/Parent URL: ${item.sourceUrl}`);
      });
    }

  } catch (error) {
    console.error('💥 Critical error in database check & recovery script:', error);
  } finally {
    if (driver) {
      try {
        await driver.quit();
        logger.info('🔒 WebDriver session closed');
      } catch (e) {
        logger.error('Failed to close driver:', e.message);
      }
    }
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { run };
