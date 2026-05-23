const { scrapeProduct } = require('./scrappers/amazon');
const { resolvePlatformFromUrl } = require('./utils/platformUtils');
const { productDealsDB } = require('./database/firebaseDB/productDealsDB');
const admin = require('firebase-admin');

async function getOrCreateDriver() {
  const { Builder } = require('selenium-webdriver');
  const chrome = require('selenium-webdriver/chrome');
  let options = new chrome.Options();
  options.debuggerAddress("localhost:9222");
  return await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function runBulkRetrigger() {
  try {
    const driver = await getOrCreateDriver();
    const db = admin.database();
    const snapshot = await db.ref('deals').once('value');
    const products = snapshot.val() || {};
    
    let count = 0;
    
    for (const productCode in products) {
      const product = products[productCode];
      
      const isMissingPhoto = !product.photo || product.photo.trim() === '';
      const isMissingImages = !product.images || product.images.length === 0;
      
      if (isMissingPhoto && isMissingImages) {
        console.log(`Processing ${productCode}: ${product.title}`);
        if (!product.productUrl) continue;
        
        const platform = resolvePlatformFromUrl(product.productUrl) || 'amazon';
        console.log(`Scraping URL: ${product.productUrl} on platform: ${platform}`);
        
        await driver.get(product.productUrl);
        
        const extractedData = await scrapeProduct(
          product.productUrl, 
          platform, 
          driver, 
          product.productText || product.title || "", 
          false, 
          "dealsglobalhub"
        );
        
        if (extractedData && Object.keys(extractedData).length > 0) {
          const updatedProduct = {
            ...product,
            ...extractedData,
            updateTimestamp: new Date().toISOString(),
            updatedatetime: Date.now()
          };
          
          await productDealsDB.updateIndividualProduct(productCode, updatedProduct, 'deals');
          console.log(`Updated ${productCode}`);
          count++;
        }
      }
    }
    
    console.log(`Finished bulk retrigger. Updated ${count} products.`);
    // Do not quit driver since we are reusing the existing browser
    process.exit(0);
  } catch (error) {
    console.error('Error during bulk retrigger:', error);
    process.exit(1);
  }
}

runBulkRetrigger();
