/**
 * Simple Browser Console Testing
 * Uses Puppeteer to test frontend and API calls from browser console
 */

const puppeteer = require('puppeteer');

const API_BASE = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:5173';

async function waitForServer(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url, { timeout: 2000 });
      if (response.ok) return true;
    } catch (e) {
      // Server not ready
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

async function runTests() {
  console.log('\n🚀 Starting Browser Console Tests...\n');
  
  // Wait for servers
  console.log('⏳ Waiting for servers to be ready...');
  const backendReady = await waitForServer(`${API_BASE}/deals?limit=1`);
  const frontendReady = await waitForServer(FRONTEND_URL);
  
  if (!backendReady) {
    console.log('❌ Backend server not responding. Please start it with: npm run api');
    return;
  }
  if (!frontendReady) {
    console.log('❌ Frontend server not responding. Please start it with: npm run frontend');
    return;
  }
  
  console.log('✅ Both servers are ready!\n');
  
  let browser;
  try {
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        console.log(`   [CONSOLE ERROR] ${text}`);
      }
    });
    
    // Capture network errors
    page.on('requestfailed', request => {
      console.log(`   [NETWORK ERROR] ${request.url()}: ${request.failure()?.errorText}`);
    });
    
    console.log('\n📋 TEST 1: Loading Deals Page');
    console.log('   Navigating to:', `${FRONTEND_URL}/deals`);
    await page.goto(`${FRONTEND_URL}/deals`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await page.waitForTimeout(3000);
    console.log('   ✅ Page loaded');
    
    console.log('\n📋 TEST 2: Testing API Calls from Browser Console');
    const apiTestResults = await page.evaluate(async (apiBase) => {
      const results = {};
      
      // Test Deals API
      try {
        const res = await fetch(`${apiBase}/deals?limit=5`);
        const data = await res.json();
        results.deals = {
          status: res.status,
          ok: res.ok,
          count: data?.data?.data?.length || 0
        };
      } catch (e) {
        results.deals = { error: e.message };
      }
      
      // Test News API
      try {
        const res = await fetch(`${apiBase}/news?limit=5`);
        const data = await res.json();
        results.news = {
          status: res.status,
          ok: res.ok,
          count: data?.data?.data?.length || 0
        };
      } catch (e) {
        results.news = { error: e.message };
      }
      
      // Test Reviews API
      try {
        const res = await fetch(`${apiBase}/news/reviews?limit=5`);
        const data = await res.json();
        results.reviews = {
          status: res.status,
          ok: res.ok,
          count: data?.data?.data?.length || 0
        };
      } catch (e) {
        results.reviews = { error: e.message };
      }
      
      return results;
    }, API_BASE);
    
    console.log('   Results:');
    Object.entries(apiTestResults).forEach(([key, value]) => {
      if (value.ok) {
        console.log(`   ✅ ${key}: Status ${value.status}, Count: ${value.count}`);
      } else {
        console.log(`   ❌ ${key}: ${value.error || 'Failed'}`);
      }
    });
    
    console.log('\n📋 TEST 3: Testing View Mode Tabs');
    const tabsInfo = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.view-tab, button'));
      return tabs
        .map(btn => ({
          text: btn.textContent?.trim(),
          isActive: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true'
        }))
        .filter(t => t.text && (t.text.includes('Deals') || t.text.includes('News') || t.text.includes('Reviews')));
    });
    
    console.log(`   Found ${tabsInfo.length} tabs:`);
    tabsInfo.forEach(tab => {
      console.log(`   - ${tab.text} ${tab.isActive ? '(active)' : ''}`);
    });
    
    console.log('\n📋 TEST 4: Testing News Tab');
    const newsTab = await page.$('button:has-text("News"), .view-tab:has-text("News")');
    if (newsTab) {
      await newsTab.click();
      await page.waitForTimeout(2000);
      
      const newsContent = await page.evaluate(() => {
        const list = document.querySelector('.content-list');
        const cards = document.querySelectorAll('.content-card');
        const emptyState = document.querySelector('.empty-state');
        return {
          hasList: !!list,
          cardCount: cards.length,
          isEmpty: !!emptyState
        };
      });
      
      console.log(`   ✅ News tab clicked`);
      console.log(`   Content: ${newsContent.cardCount} cards, Empty: ${newsContent.isEmpty}`);
    } else {
      console.log('   ⚠️ News tab not found');
    }
    
    console.log('\n📋 TEST 5: Testing Reviews Tab');
    const reviewsTab = await page.$('button:has-text("Reviews"), .view-tab:has-text("Reviews")');
    if (reviewsTab) {
      await reviewsTab.click();
      await page.waitForTimeout(2000);
      
      const reviewsContent = await page.evaluate(() => {
        const list = document.querySelector('.content-list');
        const cards = document.querySelectorAll('.content-card');
        const emptyState = document.querySelector('.empty-state');
        return {
          hasList: !!list,
          cardCount: cards.length,
          isEmpty: !!emptyState
        };
      });
      
      console.log(`   ✅ Reviews tab clicked`);
      console.log(`   Content: ${reviewsContent.cardCount} cards, Empty: ${reviewsContent.isEmpty}`);
    } else {
      console.log('   ⚠️ Reviews tab not found');
    }
    
    console.log('\n📋 TEST 6: Testing Trigger Buttons');
    const triggerButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.trigger-button, button'));
      return buttons
        .map(btn => ({
          text: btn.textContent?.trim(),
          disabled: btn.disabled
        }))
        .filter(b => b.text && (
          b.text.includes('Trigger') || 
          b.text.includes('Bulk') || 
          b.text.includes('Telegram') || 
          b.text.includes('News')
        ));
    });
    
    console.log(`   Found ${triggerButtons.length} trigger buttons:`);
    triggerButtons.forEach(btn => {
      console.log(`   - ${btn.text} ${btn.disabled ? '(disabled)' : ''}`);
    });
    
    console.log('\n📋 TEST 7: Checking for Console Errors');
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length === 0) {
      console.log('   ✅ No console errors found');
    } else {
      console.log(`   ⚠️ Found ${errors.length} console errors:`);
      errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err.text.substring(0, 100)}`);
      });
    }
    
    console.log('\n✅ All tests completed!');
    console.log('\nBrowser will stay open for 15 seconds for manual inspection...');
    console.log('You can now interact with the browser to test manually.');
    
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 Browser closed');
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});














