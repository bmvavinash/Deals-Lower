process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getExtrapeUrl } = require('../affiliate/extrape');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('checkAndFixFlipkartUrls');

async function initializeDriver() {
  try {
    logger.info('🌐 Initializing Chrome WebDriver connecting to port 9222...');
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222"); // Connect to existing Chrome instance
    const driver = await chrome.Driver.createSession(options);
    global.driver = driver;
    logger.info('✅ Chrome WebDriver initialized successfully');
    return driver;
  } catch (error) {
    logger.error('❌ Failed to initialize WebDriver:', { error: error.message });
    throw error;
  }
}

const checkUrl = async (url) => {
  if (!url) return { ok: false, reason: 'URL is empty' };
  
  // Quick blunder check: Amazon affiliate URL on a Flipkart product
  if (url.includes('amazon.in') && url.includes('tag=')) {
    return { ok: false, reason: 'Blunder Amazon URL on Flipkart product' };
  }
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow',
      timeout: 10000
    });
    
    if (res.status === 404) {
      return { ok: false, reason: `HTTP 404 status`, finalUrl: res.url };
    }
    
    const finalUrl = res.url || '';
    if (finalUrl.includes('404') || finalUrl.includes('error-page') || finalUrl.includes('pagenotfound')) {
      return { ok: false, reason: `Redirected to error URL: ${finalUrl}`, finalUrl };
    }
    
    const html = await res.text();
    if (html.includes("Something's not right") || html.includes("Page Not Found") || html.includes("this page is not available")) {
      return { ok: false, reason: `Body contains error signature`, finalUrl };
    }
    
    return { ok: true, finalUrl };
  } catch (err) {
    return { ok: false, reason: `Fetch/Redirection error: ${err.message}` };
  }
};

async function run() {
  let driver = null;
  const unresolved = [];
  const fixed = [];
  let totalChecked = 0;
  let totalFailed = 0;

  try {
    // Collections to check
    const collections = ['deals', 'productdeals'];
    const productsToCheck = [];

    for (const collection of collections) {
      console.log(`\n📥 Fetching the last 300 products from collection: '${collection}'...`);
      const targetRef = collection === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
      const snapshot = await targetRef.limitToLast(300).once('value');
      const allProducts = snapshot.val() || {};
      const productCount = Object.keys(allProducts).length;
      console.log(`📊 Retrieved ${productCount} products from '${collection}'`);

      for (const [key, product] of Object.entries(allProducts)) {
        // Filter for Flipkart products only
        const isFlipkart = product.storeType?.toLowerCase() === 'flipkart' || 
                           (product.productUrl && product.productUrl.includes('flipkart.com'));
        if (!isFlipkart) continue;

        const pCode = product.productCode || key;
        const pUrl = product.productUrl || product.url || product.link || '';
        const avinashbmvINR = product.links?.avinashbmvINR || '';

        productsToCheck.push({
          collection,
          productCode: pCode,
          productUrl: pUrl,
          avinashbmvINR,
          title: product.title || 'N/A',
          product
        });
      }
    }

    console.log(`\n🔍 Starting parallel redirection checks for ${productsToCheck.length} Flipkart products (concurrency = 15)...`);
    
    // Concurrency check pool
    const checkResults = [];
    let checkIndex = 0;
    const concurrencyLimit = 15;

    async function checkWorker() {
      while (checkIndex < productsToCheck.length) {
        const currentIdx = checkIndex++;
        const item = productsToCheck[currentIdx];
        
        let needsFix = false;
        let failReason = '';
        let finalUrl = '';

        if (!item.avinashbmvINR) {
          needsFix = true;
          failReason = 'avinashbmvINR link is empty';
        } else {
          const checkResult = await checkUrl(item.avinashbmvINR);
          if (!checkResult.ok) {
            needsFix = true;
            failReason = checkResult.reason;
            finalUrl = checkResult.finalUrl || '';
          } else {
            finalUrl = checkResult.finalUrl || '';
          }
        }

        checkResults.push({
          ...item,
          needsFix,
          failReason,
          finalUrl
        });
      }
    }

    const workers = Array(Math.min(concurrencyLimit, productsToCheck.length)).fill(null).map(checkWorker);
    await Promise.all(workers);

    // Sort or filter the check results to preserve order
    const toFix = checkResults.filter(r => r.needsFix);
    totalFailed = toFix.length;
    console.log(`\n==============================================`);
    console.log(`📊 Parallel checking complete. Checked ${productsToCheck.length} products. Found ${toFix.length} broken/empty links.`);
    console.log(`==============================================\n`);

    if (toFix.length > 0) {
      if (process.argv.includes('--dry-run')) {
        console.log(`\n⚠️ Dry run mode enabled. Skipping Extrape URL regeneration for ${toFix.length} broken links.`);
        toFix.forEach(item => {
          unresolved.push({
            collection: item.collection,
            productCode: item.productCode,
            productUrl: item.productUrl,
            avinashbmvINR: item.avinashbmvINR,
            reason: `Dry run - would fix: ${item.failReason}`
          });
        });
      } else {
        // Initialize driver only now that we need it
        driver = await initializeDriver();

        console.log(`\n⚙️ Starting sequential Extrape URL regeneration for ${toFix.length} broken links...`);
        for (let i = 0; i < toFix.length; i++) {
          const item = toFix[i];
          console.log(`\n[Fix ${i+1}/${toFix.length}] Processing [${item.collection}] ${item.productCode}:`);
          console.log(`   Product URL: ${item.productUrl}`);
          console.log(`   Old Link: ${item.avinashbmvINR}`);
          console.log(`   Reason for failure: ${item.failReason}`);

          if (!item.productUrl) {
            console.log(`   ❌ Cannot regenerate using Extrape: productUrl is empty.`);
            unresolved.push({
              collection: item.collection,
              productCode: item.productCode,
              productUrl: item.productUrl,
              avinashbmvINR: item.avinashbmvINR,
              reason: 'Empty productUrl'
            });
            continue;
          }

          try {
            console.log(`   ⚙️ Regenerating URL using Extrape...`);
            const extrapeUrl = await getExtrapeUrl(driver, item.productUrl);
            
            if (extrapeUrl) {
              console.log(`   🎉 Successfully generated Extrape URL: ${extrapeUrl}`);
              
              // Prepare database updates
              const linksObj = item.product.links || {};
              const updates = {
                links: {
                  ...linksObj,
                  avinashbmv: extrapeUrl
                }
              };

              // Save to Firebase
              await productDealsDB.updateIndividualProduct(item.productCode, updates, item.collection);
              console.log(`   💾 Database updated for ${item.productCode} in '${item.collection}'`);
              fixed.push({
                collection: item.collection,
                productCode: item.productCode,
                productUrl: item.productUrl,
                oldUrl: item.avinashbmvINR,
                newUrl: extrapeUrl
              });
            } else {
              console.log(`   ❌ Extrape URL generation failed (returned empty string).`);
              unresolved.push({
                collection: item.collection,
                productCode: item.productCode,
                productUrl: item.productUrl,
                avinashbmvINR: item.avinashbmvINR,
                reason: 'Extrape generated empty URL'
              });
            }
          } catch (err) {
            console.error(`   💥 Error during Extrape regeneration:`, err.message);
            unresolved.push({
              collection: item.collection,
              productCode: item.productCode,
              productUrl: item.productUrl,
              avinashbmvINR: item.avinashbmvINR,
              reason: `Error: ${err.message}`
            });
          }

          // Small delay between operations to avoid rate limiting
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.log('\n==============================================');
    console.log('📊 FLIPKART URL VERIFICATION & FIX SUMMARY:');
    console.log('==============================================');
    console.log(`📦 Total Flipkart products checked: ${productsToCheck.length}`);
    console.log(`❌ Total redirection failures detected: ${totalFailed}`);
    console.log(`✅ Successfully fixed using Extrape: ${fixed.length}`);
    console.log(`⚠️ Remaining unresolved products: ${unresolved.length}`);
    console.log('==============================================\n');

    if (fixed.length > 0) {
      console.log('📋 FIXED PRODUCTS:');
      fixed.forEach((item, index) => {
        console.log(`\n[${index + 1}] Collection: ${item.collection} | Code: ${item.productCode}`);
        console.log(`    Product URL: ${item.productUrl}`);
        console.log(`    Old Link: ${item.oldUrl}`);
        console.log(`    New Extrape Link: ${item.newUrl}`);
      });
    }

    if (unresolved.length > 0) {
      console.log('\n📋 UNRESOLVED PRODUCTS (User Review Required):');
      unresolved.forEach((item, index) => {
        console.log(`\n[${index + 1}] Collection: ${item.collection} | Code: ${item.productCode}`);
        console.log(`    Product URL: ${item.productUrl}`);
        console.log(`    Old Link: ${item.avinashbmvINR}`);
        console.log(`    Unresolved Reason: ${item.reason}`);
      });
    }

  } catch (error) {
    console.error('💥 Critical error in URL verification script:', error);
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
