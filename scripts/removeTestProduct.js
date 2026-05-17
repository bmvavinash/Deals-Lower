/**
 * Script to remove a test product from the database
 * Product Code: TEST_WRITE_1758694795339
 */

const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('removeTestProduct');

const TEST_PRODUCT_CODE = 'TEST_WRITE_1758694795339';

async function removeTestProduct() {
  try {
    logger.info(`🔍 Searching for test product: ${TEST_PRODUCT_CODE}`);
    
    // Search in productdeals database
    let found = false;
    let productKey = null;
    
    try {
      const snapshot = await productDealsDB.productdealsRef
        .orderByChild('productCode')
        .equalTo(TEST_PRODUCT_CODE)
        .once('value');
      
      const products = snapshot.val();
      
      if (products) {
        productKey = Object.keys(products)[0];
        found = true;
        logger.info(`✅ Found product in productdeals database`, {
          productKey,
          productCode: products[productKey]?.productCode,
          title: products[productKey]?.title?.substring(0, 50) || 'N/A'
        });
      }
    } catch (error) {
      logger.warn('Error searching productdeals:', { error: error.message });
    }
    
    // Also check deals database
    if (!found) {
      try {
        const snapshot = await productDealsDB.dealsRef
          .orderByChild('productCode')
          .equalTo(TEST_PRODUCT_CODE)
          .once('value');
        
        const products = snapshot.val();
        
        if (products) {
          productKey = Object.keys(products)[0];
          found = true;
          logger.info(`✅ Found product in deals database`, {
            productKey,
            productCode: products[productKey]?.productCode,
            title: products[productKey]?.title?.substring(0, 50) || 'N/A'
          });
        }
      } catch (error) {
        logger.warn('Error searching deals:', { error: error.message });
      }
    }
    
    if (!found) {
      logger.warn(`⚠️ Product ${TEST_PRODUCT_CODE} not found in database`);
      console.log(`\n⚠️ Product ${TEST_PRODUCT_CODE} not found in database`);
      return;
    }
    
    // Delete from productdeals
    try {
      await productDealsDB.productdealsRef.child(productKey).remove();
      logger.info(`✅ Removed product from productdeals database`, { productKey });
      console.log(`\n✅ Removed product from productdeals database: ${productKey}`);
    } catch (error) {
      logger.error('Error removing from productdeals:', { error: error.message });
    }
    
    // Also try to delete from deals (in case it exists there too)
    try {
      await productDealsDB.dealsRef.child(productKey).remove();
      logger.info(`✅ Removed product from deals database (if existed)`, { productKey });
    } catch (error) {
      // Ignore if it doesn't exist in deals
      logger.debug('Product not in deals database (expected)');
    }
    
    logger.info(`✅ Successfully removed test product: ${TEST_PRODUCT_CODE}`);
    console.log(`\n✅ Successfully removed test product: ${TEST_PRODUCT_CODE}`);
    console.log(`   Product Key: ${productKey}`);
    
  } catch (error) {
    logger.error('❌ Error removing test product:', { 
      error: error.message, 
      stack: error.stack 
    });
    console.error(`\n❌ Error removing test product: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  removeTestProduct()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeTestProduct };
