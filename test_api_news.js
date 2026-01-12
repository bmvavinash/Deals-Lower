/**
 * Quick test to verify API endpoints are working
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testAPI() {
  console.log('\n🧪 Testing News API Endpoints\n');

  try {
    // Test 1: Get news
    console.log('1. Testing GET /api/news...');
    try {
      const newsResponse = await axios.get(`${API_BASE}/news?limit=5`);
      console.log('   ✅ Success! Retrieved', newsResponse.data.data?.data?.length || 0, 'news articles');
      if (newsResponse.data.data?.data?.length > 0) {
        console.log('   Sample:', newsResponse.data.data.data[0].title?.substring(0, 50));
      }
    } catch (error) {
      console.log('   ⚠️  Error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Make sure backend server is running: npm run api');
      }
    }

    // Test 2: Get reviews
    console.log('\n2. Testing GET /api/news/reviews...');
    try {
      const reviewsResponse = await axios.get(`${API_BASE}/news/reviews?limit=5`);
      console.log('   ✅ Success! Retrieved', reviewsResponse.data.data?.data?.length || 0, 'review articles');
      if (reviewsResponse.data.data?.data?.length > 0) {
        console.log('   Sample:', reviewsResponse.data.data.data[0].productName?.substring(0, 50));
      }
    } catch (error) {
      console.log('   ⚠️  Error:', error.message);
    }

    // Test 3: Health check
    console.log('\n3. Testing GET /health...');
    try {
      const healthResponse = await axios.get(`${API_BASE.replace('/api', '')}/health`);
      console.log('   ✅ Server is running:', healthResponse.data.status);
    } catch (error) {
      console.log('   ⚠️  Server not responding');
    }

    console.log('\n✅ API Tests Complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();














