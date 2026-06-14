const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set up console log interception to see what the React app prints
  page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CategoryProducts') || text.includes('Error')) {
          console.log(`[Browser] ${text}`);
      }
  });
  
  console.log('Navigating to Affiliate frontend (localhost:3000)...');
  try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      console.log('Page loaded successfully!');
      
      // Get the list of categories in the top navigation or sidebar
      // Usually there are links for Home & Kitchen, Electronics, Fashion, Beauty
      // The URLs are like /deals/home-kitchen, /deals/electronics
      console.log('Checking "Home & Kitchen" category...');
      await page.goto('http://localhost:3000/deals/home-kitchen', { waitUntil: 'networkidle2' });
      
      // Wait for subcategories to render
      await new Promise(r => setTimeout(r, 2000));
      
      // Extract subcategories
      const subcategories = await page.evaluate(() => {
          // The subcategory chips usually have some class or are inside a scrollable container
          // Let's just grab all buttons/chips text that look like subcategories
          const chips = Array.from(document.querySelectorAll('.filter-chip, button, .category-chip, .MuiChip-label'));
          return chips.map(c => c.textContent.trim()).filter(t => t && t !== 'Clear All');
      });
      console.log('Subcategories found for Home & Kitchen:', Array.from(new Set(subcategories)));
      
      // Extract product titles to see if data loaded
      const products = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.product-card-title, .product-title, h3, h2'));
          return cards.map(c => c.textContent.trim()).filter(Boolean).slice(0, 5);
      });
      console.log('Sample products found:', products.length > 0 ? products : 'NONE FOUND!');
      
      console.log('Checking "Electronics" category...');
      await page.goto('http://localhost:3000/deals/electronics', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      const electronicsSub = await page.evaluate(() => {
          const chips = Array.from(document.querySelectorAll('.filter-chip, button, .category-chip, .MuiChip-label'));
          return chips.map(c => c.textContent.trim()).filter(t => t && t !== 'Clear All');
      });
      console.log('Subcategories found for Electronics:', Array.from(new Set(electronicsSub)));
      
  } catch (error) {
      console.error('Error during browser check:', error);
  } finally {
      await browser.close();
  }
})();
