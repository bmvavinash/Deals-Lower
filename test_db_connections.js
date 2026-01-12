#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests all Firebase database connections and configurations
 */

const { firebaseget } = require('./database/firebaseget.js');
const { productDealsDB } = require('./database/firebaseDB/productDealsDB.js');
const config = require('./config/config.js');
const constants = require('./config/constants.js');

console.log('=== DATABASE CONNECTION TEST ===');
console.log('Environment:', constants.env);
console.log('Type:', constants.type);
console.log('DB Config:', constants.postingTypesConfig[constants.type].DB);
console.log('DB Name:', config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`]);
console.log('JSON File:', config.DATABASE_CONFIG.JSON_FILE_NAME);
console.log('================================');

async function testFirebaseGet() {
  console.log('\n--- Testing firebaseget.js ---');
  try {
    const result = await firebaseget(false, 'deals');
    console.log('✅ firebaseget.js: SUCCESS');
    console.log(`   Data length: ${result.len}`);
    console.log(`   Has data: ${result.data ? 'Yes' : 'No'}`);
    return true;
  } catch (error) {
    console.log('❌ firebaseget.js: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testProductDealsDB() {
  console.log('\n--- Testing productDealsDB.js ---');
  try {
    // Test getting products for idle processing
    const products = await productDealsDB.getProductsForIdleProcessing('deals', 5);
    console.log('✅ productDealsDB.js: SUCCESS');
    console.log(`   Products found: ${products.length}`);
    return true;
  } catch (error) {
    console.log('❌ productDealsDB.js: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n--- Testing Database Connection ---');
  try {
    const db = productDealsDB.dealsRef;
    const snapshot = await db.once('value');
    const data = snapshot.val();
    console.log('✅ Database Connection: SUCCESS');
    console.log(`   Records in database: ${data ? Object.keys(data).length : 0}`);
    return true;
  } catch (error) {
    console.log('❌ Database Connection: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting database connection tests...\n');
  
  const results = {
    firebaseget: await testFirebaseGet(),
    productDealsDB: await testProductDealsDB(),
    databaseConnection: await testDatabaseConnection()
  };
  
  console.log('\n=== TEST RESULTS ===');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\nOverall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All database connections are working correctly!');
    return true;
  } else {
    console.log('⚠️  Some database connections failed. Please check the errors above.');
    return false;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testFirebaseGet, testProductDealsDB, testDatabaseConnection };
