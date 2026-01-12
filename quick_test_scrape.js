/**
 * Quick test - just scrape 1 article to verify everything works
 */

require('dotenv').config();

const { initializeDriver, extractNewsArticle } = require('./scrappers/ninetyonemobile');
const { upsertNews } = require('./database/firebaseDB/newsReviewsDB');

async function quickTest() {
  console.log('🧪 Quick Test: Scraping 1 article from 91mobile\n');
  
  let driver = null;
  try {
    // Initialize database
    console.log('1. Initializing database...');
    const { initializeNewsDB } = require('./database/firebaseDB/newsReviewsDB');
    initializeNewsDB();
    console.log('   ✅ Database initialized\n');

    // Initialize driver
    console.log('2. Initializing WebDriver...');
    driver = await initializeDriver();
    console.log('   ✅ WebDriver initialized\n');

    // Test URL - use a known 91mobile hub article
    const testUrl = 'https://www.91mobiles.com/hub';
    console.log('3. Testing article extraction from:', testUrl);
    
    // First, let's just check if we can access the page
    await driver.get(testUrl);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const pageTitle = await driver.getTitle();
    console.log('   ✅ Page loaded:', pageTitle.substring(0, 50));
    
    // Try to find article links
    const { By } = require('selenium-webdriver');
    const links = await driver.findElements(By.css('a[href*="/hub/"]'));
    console.log(`   Found ${links.length} potential article links`);
    
    if (links.length > 0) {
      const firstLink = await links[0].getAttribute('href');
      console.log('   First article link:', firstLink);
      
      // Extract the article
      console.log('\n4. Extracting article data...');
      const articleData = await extractNewsArticle(driver, firstLink);
      console.log('   ✅ Article extracted:', {
        id: articleData.id,
        title: articleData.title?.substring(0, 50),
        hasContent: !!articleData.content,
        hasImages: articleData.images?.length > 0
      });

      // Store in database
      console.log('\n5. Storing in database...');
      const result = await upsertNews(articleData);
      console.log('   ✅ Stored:', result.created ? 'Created' : 'Updated');
      console.log('   Key:', result.key);

      // Verify retrieval
      console.log('\n6. Verifying retrieval...');
      const { getNewsById } = require('./database/firebaseDB/newsReviewsDB');
      const retrieved = await getNewsById(articleData.id);
      if (retrieved) {
        console.log('   ✅ Retrieved from DB:', retrieved.title?.substring(0, 50));
      } else {
        console.log('   ⚠️  Could not retrieve from DB');
      }

      console.log('\n✅ Test completed successfully!');
    } else {
      console.log('   ⚠️  No article links found on the page');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (driver) {
      try {
        await driver.quit();
        console.log('\n✅ WebDriver closed');
      } catch (e) {
        console.log('⚠️  Error closing driver:', e.message);
      }
    }
    process.exit(0);
  }
}

quickTest();














