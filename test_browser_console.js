/**
 * Browser Console Testing Script
 * Tests all API endpoints and frontend functionality
 */

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:5173';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAPIEndpoints() {
  log('\n=== TESTING BACKEND API ENDPOINTS ===', 'cyan');
  
  const tests = [
    {
      name: 'Deals API',
      url: `${API_BASE}/deals?limit=5`,
      method: 'GET'
    },
    {
      name: 'News API',
      url: `${API_BASE}/news?limit=5`,
      method: 'GET'
    },
    {
      name: 'Reviews API',
      url: `${API_BASE}/news/reviews?limit=5`,
      method: 'GET'
    },
    {
      name: 'Logs API',
      url: `${API_BASE}/logs?limit=10`,
      method: 'GET'
    },
    {
      name: 'Analytics API',
      url: `${API_BASE}/analytics/deals`,
      method: 'GET'
    },
    {
      name: 'Execution Status API',
      url: `${API_BASE}/execution/status`,
      method: 'GET'
    }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(test.url, {
        method: test.method,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      const data = await response.json();
      
      const status = response.status === 200 ? '✅' : '⚠️';
      log(`${status} ${test.name}: ${response.status} (${duration}ms)`, 
          response.status === 200 ? 'green' : 'yellow');
      
      if (data) {
        const dataSize = JSON.stringify(data).length;
        log(`   Data size: ${(dataSize / 1024).toFixed(2)} KB`, 'blue');
        
        // Check for expected data structure
        if (test.name.includes('Deals') && data.data) {
          log(`   Deals count: ${data.data?.data?.length || 0}`, 'blue');
        }
        if (test.name.includes('News') && data.data) {
          log(`   News count: ${data.data?.data?.length || 0}`, 'blue');
        }
        if (test.name.includes('Reviews') && data.data) {
          log(`   Reviews count: ${data.data?.data?.length || 0}`, 'blue');
        }
      }
      
      results.push({ name: test.name, status: 'PASS', duration });
    } catch (error) {
      log(`❌ ${test.name}: ${error.message}`, 'red');
      results.push({ name: test.name, status: 'FAIL', error: error.message });
    }
  }
  
  return results;
}

async function testFrontendWithBrowser() {
  log('\n=== TESTING FRONTEND WITH BROWSER ===', 'cyan');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser for visual testing
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Test 1: Navigate to frontend
    log('\n1. Navigating to frontend...', 'yellow');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2000);
    log('✅ Frontend loaded', 'green');
    
    // Test 2: Check if Deals page loads
    log('\n2. Testing Deals page...', 'yellow');
    await page.goto(`${FRONTEND_URL}/deals`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check for view mode tabs
    const tabs = await page.evaluate(() => {
      const tabButtons = Array.from(document.querySelectorAll('.view-tab, button'));
      return tabButtons.map(btn => btn.textContent?.trim()).filter(Boolean);
    });
    log(`✅ Found tabs: ${tabs.join(', ')}`, 'green');
    
    // Test 3: Test News tab
    log('\n3. Testing News tab...', 'yellow');
    const newsTab = await page.$('button:has-text("News"), .view-tab:has-text("News")');
    if (newsTab) {
      await newsTab.click();
      await page.waitForTimeout(2000);
      
      // Check if news content loads
      const newsContent = await page.evaluate(() => {
        const content = document.querySelector('.content-list, .content-card');
        return content ? 'Content found' : 'No content';
      });
      log(`✅ News tab clicked, ${newsContent}`, 'green');
      
      // Check for filters
      const newsFilters = await page.evaluate(() => {
        const filters = document.querySelectorAll('.content-filters select, .filter-select');
        return filters.length;
      });
      log(`   Found ${newsFilters} filter controls`, 'blue');
    } else {
      log('⚠️ News tab not found', 'yellow');
    }
    
    // Test 4: Test Reviews tab
    log('\n4. Testing Reviews tab...', 'yellow');
    const reviewsTab = await page.$('button:has-text("Reviews"), .view-tab:has-text("Reviews")');
    if (reviewsTab) {
      await reviewsTab.click();
      await page.waitForTimeout(2000);
      
      const reviewsContent = await page.evaluate(() => {
        const content = document.querySelector('.content-list, .content-card');
        return content ? 'Content found' : 'No content';
      });
      log(`✅ Reviews tab clicked, ${reviewsContent}`, 'green');
    } else {
      log('⚠️ Reviews tab not found', 'yellow');
    }
    
    // Test 5: Test trigger buttons
    log('\n5. Testing trigger buttons...', 'yellow');
    const triggerButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.trigger-button, button'));
      return buttons
        .map(btn => btn.textContent?.trim())
        .filter(text => text && (text.includes('Trigger') || text.includes('Bulk') || text.includes('Telegram') || text.includes('News')))
        .slice(0, 3);
    });
    log(`✅ Found trigger buttons: ${triggerButtons.join(', ')}`, 'green');
    
    // Test 6: Test API calls from browser console
    log('\n6. Testing API calls from browser console...', 'yellow');
    const apiTestResults = await page.evaluate(async () => {
      const results = {};
      
      try {
        // Test Deals API
        const dealsResponse = await fetch('http://localhost:3001/api/deals?limit=1');
        results.deals = {
          status: dealsResponse.status,
          ok: dealsResponse.ok
        };
      } catch (e) {
        results.deals = { error: e.message };
      }
      
      try {
        // Test News API
        const newsResponse = await fetch('http://localhost:3001/api/news?limit=1');
        results.news = {
          status: newsResponse.status,
          ok: newsResponse.ok
        };
      } catch (e) {
        results.news = { error: e.message };
      }
      
      try {
        // Test Reviews API
        const reviewsResponse = await fetch('http://localhost:3001/api/news/reviews?limit=1');
        results.reviews = {
          status: reviewsResponse.status,
          ok: reviewsResponse.ok
        };
      } catch (e) {
        results.reviews = { error: e.message };
      }
      
      return results;
    });
    
    log('✅ Browser API test results:', 'green');
    Object.entries(apiTestResults).forEach(([key, value]) => {
      if (value.ok) {
        log(`   ${key}: ✅ Status ${value.status}`, 'green');
      } else {
        log(`   ${key}: ❌ ${value.error || 'Failed'}`, 'red');
      }
    });
    
    // Test 7: Check for errors in console
    log('\n7. Checking browser console for errors...', 'yellow');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await page.waitForTimeout(2000);
    
    if (consoleErrors.length === 0) {
      log('✅ No console errors found', 'green');
    } else {
      log(`⚠️ Found ${consoleErrors.length} console errors:`, 'yellow');
      consoleErrors.slice(0, 5).forEach(err => log(`   ${err}`, 'red'));
    }
    
    // Keep browser open for manual inspection
    log('\n✅ Browser testing complete!', 'green');
    log('Browser will stay open for 10 seconds for manual inspection...', 'yellow');
    await page.waitForTimeout(10000);
    
    return { success: true };
    
  } catch (error) {
    log(`❌ Browser test error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runAllTests() {
  log('\n🚀 STARTING COMPREHENSIVE TESTING', 'cyan');
  log('='.repeat(50), 'cyan');
  
  // Test API endpoints
  const apiResults = await testAPIEndpoints();
  
  // Test frontend with browser
  const browserResults = await testFrontendWithBrowser();
  
  // Summary
  log('\n=== TEST SUMMARY ===', 'cyan');
  const passed = apiResults.filter(r => r.status === 'PASS').length;
  const failed = apiResults.filter(r => r.status === 'FAIL').length;
  log(`API Tests: ${passed} passed, ${failed} failed`, 
      failed === 0 ? 'green' : 'yellow');
  log(`Browser Tests: ${browserResults.success ? '✅ PASSED' : '❌ FAILED'}`, 
      browserResults.success ? 'green' : 'red');
  
  log('\n✅ Testing complete!', 'green');
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test execution failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

