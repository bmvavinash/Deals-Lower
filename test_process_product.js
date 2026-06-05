/**
 * Test script for process product functionality
 * Tests the POST /api/deals/process-product endpoint
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';
const TEST_URL = process.argv[2] || 'https://amzn.in/d/6DjlLxV';
const POST_PRODUCT = false; // Set to true to post to social media

async function testProcessProduct() {
  try {
    console.log('========================================');
    console.log('   PROCESS PRODUCT TEST');
    console.log('========================================\n');
    
    console.log('📋 Test Details:');
    console.log(`   URL: ${TEST_URL}`);
    console.log(`   Post Product: ${POST_PRODUCT}`);
    console.log(`   API Endpoint: ${API_BASE_URL}/deals/process-product\n`);

    // First, check if server is running
    console.log('🔍 Checking if backend server is running...');
    try {
      const healthCheck = await axios.get(`${API_BASE_URL.replace('/api', '')}/health`);
      console.log('✅ Backend server is running\n');
    } catch (error) {
      console.error('❌ Backend server is not running!');
      console.error('   Please start the backend server first: npm run api');
      process.exit(1);
    }

    // Call the process-product endpoint
    console.log('📤 Sending request to process product...');
    const startTime = Date.now();
    
    const response = await axios.post(`${API_BASE_URL}/deals/process-product`, {
      url: TEST_URL,
      postProduct: POST_PRODUCT
    }, {
      timeout: 300000, // 5 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n========================================');
    console.log('   RESULT');
    console.log('========================================\n');
    
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Status: ${response.data.status}`);
    console.log(`📝 Message: ${response.data.message}`);
    
    if (response.data.error) {
      console.log(`❌ Error: ${response.data.error}`);
    }
    
    if (response.data.result) {
      console.log(`🔢 Result Code: ${response.data.result}`);
    }

    console.log('\n✅ Request completed successfully!');
    
    if (response.data.status === 'success' || response.data.status === 'excluded' || response.data.status === 'processing') {
      console.log('\n🎉 Product processing request completed!');
      if (response.data.status === 'success') {
        console.log('   ✅ Product should be in the database');
      } else if (response.data.status === 'processing') {
        console.log('   ⏳ Background listing extraction started successfully');
      } else {
        console.log('   ⚠️  Product was excluded (affiliate policy)');
      }
      process.exit(0);
    } else {
      console.log('\n⚠️  Product processing completed with other status');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('   ERROR');
    console.error('========================================\n');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`❌ HTTP Error: ${error.response.status} ${error.response.statusText}`);
      console.error(`📝 Message: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
      if (error.response.data?.error) {
        console.error(`🔍 Error Details: ${error.response.data.error}`);
      }
      if (error.response.data) {
        console.error('\n📄 Response Data:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('❌ No response from server');
      console.error('   Please check if the backend server is running');
      console.error(`   Expected endpoint: ${API_BASE_URL}/deals/process-product`);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.error('\n📚 Stack Trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testProcessProduct();
