const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const { firebaseget } = require('../database/firebaseget');
const missingDataRecoveryService = require('../services/missingDataRecoveryService');
const { updateProduct } = require('../database/firebaseDB/firebaseUpdate');
const constants = require('../config/constants');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('recoverMissingData');

async function initializeDriver() {
  try {
    logger.info('🌐 Initializing Chrome WebDriver for missing data recovery...');
    
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

async function recoverMissingDataForExistingProducts() {
  let driver = null;
  
  try {
    // Initialize driver
    driver = await initializeDriver();
    
    // Get all products from database
    logger.info('📥 Fetching all products from database...');
    const result = await firebaseget();
    const allProducts = result.data || {};
    
    logger.info(`📊 Found ${Object.keys(allProducts).length} products in database`);
    
    // Filter products with missing critical data
    const productsWithMissingData = [];
    
    for (const [key, product] of Object.entries(allProducts)) {
      if (missingDataRecoveryService.isMissingCriticalData(product)) {
        productsWithMissingData.push({
          key,
          ...product
        });
      }
    }
    
    logger.info(`🔍 Found ${productsWithMissingData.length} products with missing critical data`);
    
    if (productsWithMissingData.length === 0) {
      logger.info('✅ No products with missing data found. All products have complete information.');
      return;
    }
    
    // Process products in batches
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < productsWithMissingData.length; i += batchSize) {
      batches.push(productsWithMissingData.slice(i, i + batchSize));
    }
    
    logger.info(`📦 Processing ${batches.length} batches of ${batchSize} products each`);
    
    let totalProcessed = 0;
    let totalRecovered = 0;
    let totalFailed = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      logger.info(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products)`);
      
      for (const product of batch) {
        try {
          totalProcessed++;
          
          logger.info(`🔍 Processing product ${totalProcessed}/${productsWithMissingData.length}`, {
            productCode: product.productCode || product.id,
            key: product.key
          });
          
          // Attempt data recovery
          const recoveredProduct = await missingDataRecoveryService.recoverMissingData(product, driver);
          
          if (recoveredProduct.dataRecovered) {
            totalRecovered++;
            
            // Update the product in database
            try {
              const updateResult = await updateProduct(
                product.key,
                recoveredProduct,
                '', // access token not needed for update
                constants.env,
                'deals'
              );
              
              if (updateResult.status === 200 || updateResult.status === 201) {
                logger.info('✅ Product updated in database', {
                  productCode: product.productCode || product.id,
                  key: product.key
                });
              } else {
                logger.warn('⚠️ Failed to update product in database', {
                  productCode: product.productCode || product.id,
                  key: product.key,
                  status: updateResult.status
                });
              }
            } catch (updateError) {
              logger.error('❌ Error updating product in database', {
                productCode: product.productCode || product.id,
                key: product.key,
                error: updateError.message
              });
            }
          }
          
          // Add delay between products to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          totalFailed++;
          logger.error('❌ Error processing product', {
            productCode: product.productCode || product.id,
            key: product.key,
            error: error.message
          });
        }
      }
      
      // Add delay between batches
      if (batchIndex < batches.length - 1) {
        logger.info('⏳ Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Final summary
    logger.info('📊 Missing data recovery completed', {
      totalProcessed,
      totalRecovered,
      totalFailed,
      successRate: totalProcessed > 0 ? ((totalRecovered / totalProcessed) * 100).toFixed(2) : 0
    });
    
    console.log('\n📊 MISSING DATA RECOVERY SUMMARY:');
    console.log('==============================================');
    console.log(`📦 Total products processed: ${totalProcessed}`);
    console.log(`✅ Successfully recovered: ${totalRecovered}`);
    console.log(`❌ Failed to recover: ${totalFailed}`);
    console.log(`🎯 Success rate: ${totalProcessed > 0 ? ((totalRecovered / totalProcessed) * 100).toFixed(2) : 0}%`);
    console.log('==============================================');
    
    // Show recovery statistics
    const recoveryStats = missingDataRecoveryService.getRecoveryStats();
    console.log('\n📈 RECOVERY STATISTICS:');
    console.log(`🔄 Total recovery attempts: ${recoveryStats.totalAttempts}`);
    console.log('==============================================');
    
  } catch (error) {
    logger.error('💥 Critical error in missing data recovery:', { error: error.message });
    console.error('❌ Missing data recovery failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (driver) {
      try {
        await driver.quit();
        logger.info('🔒 WebDriver closed successfully');
      } catch (error) {
        logger.error('❌ Error closing WebDriver:', { error: error.message });
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Start recovery process
if (require.main === module) {
  recoverMissingDataForExistingProducts().catch(error => {
    logger.error('💥 Fatal error:', { error: error.message });
    process.exit(1);
  });
}

module.exports = { recoverMissingDataForExistingProducts };
