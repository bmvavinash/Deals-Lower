const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const missingDataRecoveryService = require('./services/missingDataRecoveryService');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('testMissingDataRecovery');

async function testMissingDataRecovery() {
  let driver = null;
  
  try {
    logger.info('🧪 Testing Missing Data Recovery Service...');
    
    // Initialize driver
    logger.info('🌐 Initializing Chrome WebDriver...');
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await chrome.Driver.createSession(options);
    logger.info('✅ WebDriver initialized');
    
    // Test 1: Check if product is missing critical data
    const testProduct1 = {
      productCode: 'TEST001',
      title: 'Test Product',
      brand: 'Test Brand',
      price: '100',
      photo: 'test.jpg',
      storeType: 'Amazon'
    };
    
    const testProduct2 = {
      productCode: 'TEST002',
      title: '', // Missing title
      brand: 'Test Brand',
      price: '', // Missing price
      photo: 'test.jpg',
      storeType: 'Amazon'
    };
    
    logger.info('Test 1: Checking missing data detection');
    const isMissing1 = missingDataRecoveryService.isMissingCriticalData(testProduct1);
    const isMissing2 = missingDataRecoveryService.isMissingCriticalData(testProduct2);
    
    logger.info('Missing data check results', {
      product1: { productCode: testProduct1.productCode, isMissing: isMissing1 },
      product2: { productCode: testProduct2.productCode, isMissing: isMissing2 }
    });
    
    // Test 2: Test pagination URL generation
    logger.info('Test 2: Testing pagination URL generation');
    const testUrl = 'https://www.amazon.in/s?k=fitness+equipment';
    const paginatedUrl = missingDataRecoveryService.buildSourceUrlWithPagination(testUrl, 'amazon');
    logger.info('Pagination URL generated', { original: testUrl, paginated: paginatedUrl });
    
    // Test 3: Test enhanced selectors
    logger.info('Test 3: Testing enhanced selectors');
    const amazonSelectors = missingDataRecoveryService.getEnhancedSelectors('amazon', 'searchPage');
    const flipkartSelectors = missingDataRecoveryService.getEnhancedSelectors('flipkart', 'searchPage');
    
    logger.info('Enhanced selectors retrieved', {
      amazon: Object.keys(amazonSelectors).length,
      flipkart: Object.keys(flipkartSelectors).length
    });
    
    // Test 4: Test recovery attempts tracking
    logger.info('Test 4: Testing recovery attempts tracking');
    
    // Clear any existing attempts
    missingDataRecoveryService.clearAllRecoveryAttempts();
    
    // Simulate recovery attempts
    const testProduct3 = {
      productCode: 'TEST003',
      title: '', // Missing title
      brand: '', // Missing brand
      price: '100',
      photo: 'test.jpg',
      storeType: 'Amazon',
      productUrl: 'https://www.amazon.in/s?k=fitness+equipment'
    };
    
    // Try recovery (this will fail but should track attempts)
    logger.info('Attempting recovery for test product...');
    const recoveredProduct = await missingDataRecoveryService.recoverMissingData(testProduct3, driver);
    
    // Check recovery stats
    const stats = missingDataRecoveryService.getRecoveryStats();
    logger.info('Recovery statistics', stats);
    
    // Test 5: Test reset functionality
    logger.info('Test 5: Testing reset functionality');
    const resetCount = missingDataRecoveryService.resetRecoveryAttemptsForCompleteProducts([testProduct1]);
    logger.info('Reset count', { resetCount });
    
    logger.info('✅ All tests completed successfully');
    
  } catch (error) {
    logger.error('❌ Test failed:', { error: error.message, stack: error.stack });
  } finally {
    if (driver) {
      try {
        await driver.quit();
        logger.info('🔒 WebDriver closed');
      } catch (error) {
        logger.error('❌ Error closing WebDriver:', { error: error.message });
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testMissingDataRecovery().catch(error => {
    logger.error('💥 Fatal error in test:', { error: error.message });
    process.exit(1);
  });
}

module.exports = { testMissingDataRecovery };
