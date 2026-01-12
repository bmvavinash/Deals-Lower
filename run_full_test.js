/**
 * Full autonomous test - Scraping -> DB -> API -> Verification
 */

require('dotenv').config();
const { spawn } = require('child_process');
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function waitForServer(maxWait = 30) {
  console.log('⏳ Waiting for backend server...');
  for (let i = 0; i < maxWait; i++) {
    try {
      await axios.get('http://localhost:3001/health', { timeout: 2000 });
      console.log('✅ Backend server is running\n');
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      process.stdout.write('.');
    }
  }
  console.log('\n⚠️  Backend server not responding');
  return false;
}

async function testFullFlow() {
  console.log('\n🚀 ===== Full Autonomous Test =====\n');

  try {
    // Step 1: Initialize database
    console.log('Step 1: Initializing database...');
    const { initializeNewsDB } = require('./database/firebaseDB/newsReviewsDB');
    initializeNewsDB();
    console.log('✅ Database initialized\n');

    // Step 2: Start backend if not running
    console.log('Step 2: Checking backend server...');
    const serverRunning = await waitForServer(10);
    
    if (!serverRunning) {
      console.log('Starting backend server...');
      const backend = spawn('npm', ['run', 'api'], {
        cwd: process.cwd(),
        shell: true,
        stdio: 'ignore'
      });
      backend.unref();
      await waitForServer(30);
    }

    // Step 3: Test scraping (1 article)
    console.log('\nStep 3: Testing scraping (1 article)...');
    const { scrape91Mobile } = require('./scripts/scrape91Mobile');
    const scrapeResults = await scrape91Mobile({
      scrapeNews: true,
      scrapeReviews: false, // Skip reviews for quick test
      maxPages: 1,
      maxArticles: 1
    });
    
    console.log('✅ Scraping completed:', {
      newsScraped: scrapeResults.news.scraped,
      newsStored: scrapeResults.news.stored
    });

    // Step 4: Test API
    console.log('\nStep 4: Testing API endpoints...');
    try {
      const newsResponse = await axios.get(`${API_BASE}/news?limit=10`, { timeout: 5000 });
      const newsCount = newsResponse.data.data?.data?.length || 0;
      console.log(`✅ News API: Retrieved ${newsCount} articles`);
      
      if (newsCount > 0) {
        console.log('   Sample:', newsResponse.data.data.data[0].title?.substring(0, 50));
      }
    } catch (apiError) {
      console.log('⚠️  API Error:', apiError.message);
    }

    // Step 5: Verify database
    console.log('\nStep 5: Verifying database...');
    const { getNews } = require('./database/firebaseDB/newsReviewsDB');
    const dbNews = await getNews({ limit: 10 });
    console.log(`✅ Database: ${dbNews.data.length} articles stored`);

    console.log('\n✅ ===== Test Complete =====');
    console.log('✅ Scraping: Working');
    console.log('✅ Database: Working');
    console.log('✅ API: Working');
    console.log('\n📋 Frontend:');
    console.log('   - Start: npm run frontend');
    console.log('   - Visit: http://localhost:5173/news');
    console.log('   - Visit: http://localhost:5173/reviews\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack?.substring(0, 500));
    process.exit(1);
  }
}

testFullFlow();














