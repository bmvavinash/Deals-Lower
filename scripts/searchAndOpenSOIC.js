const puppeteer = require('puppeteer');

async function searchAndOpenSOIC() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('WhatsApp Web tab not found!');
    await browser.disconnect();
    return;
  }

  console.log('Attached to WhatsApp Web page:', await waPage.title());

  // 1. Find the search input
  const searchInputSelector = 'input[placeholder*="Search"], input[aria-label*="Search"], input[role="textbox"]';
  await waPage.waitForSelector(searchInputSelector, { timeout: 10000 });
  const searchInput = await waPage.$(searchInputSelector);

  if (!searchInput) {
    console.error('Could not find search input');
    await browser.disconnect();
    return;
  }

  console.log('Found search input. Clicking and typing "soic research"...');
  await searchInput.click();
  
  // Clear any existing text
  await waPage.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.value = '';
      el.focus();
    }
  }, searchInputSelector);

  // Type search query
  await waPage.keyboard.type('soic research', { delay: 100 });
  console.log('Typed "soic research". Waiting 3 seconds for results...');
  await new Promise(r => setTimeout(r, 3000));

  // 2. Inspect search results in the sidebar
  const searchResults = await waPage.evaluate(() => {
    const side = document.querySelector('#side') || document.body;
    // Find all clickable chat items
    const rows = Array.from(side.querySelectorAll('div[role="listitem"], div[role="row"], div[data-testid="cell-frame-container"]'));
    const items = [];

    rows.forEach((r, idx) => {
      const titleSpan = r.querySelector('span[title], span[dir="auto"]');
      const text = r.innerText.trim();
      const title = titleSpan ? (titleSpan.getAttribute('title') || titleSpan.innerText.trim()) : '';
      if (title || text) {
        items.push({
          idx,
          title,
          snippet: text.substring(0, 100).replace(/\n/g, ' ')
        });
      }
    });

    return items;
  });

  console.log(`Found ${searchResults.length} search result items:`);
  searchResults.forEach(r => console.log(`[${r.idx}] Title: "${r.title}" | Snippet: ${r.snippet}`));

  // 3. Find item matching "soic" or "soic research"
  const soicItem = searchResults.find(r => r.title.toLowerCase().includes('soic') || r.snippet.toLowerCase().includes('soic'));

  if (soicItem) {
    console.log(`\nFound SOIC matching item at index ${soicItem.idx}: "${soicItem.title}"! Clicking it...`);
    await waPage.evaluate((idx) => {
      const side = document.querySelector('#side') || document.body;
      const rows = Array.from(side.querySelectorAll('div[role="listitem"], div[role="row"], div[data-testid="cell-frame-container"]'));
      if (rows[idx]) {
        rows[idx].click();
      }
    }, soicItem.idx);

    console.log('Clicked chat. Waiting 3 seconds for #main to load...');
    await new Promise(r => setTimeout(r, 3000));

    // Check #main header
    const activeChat = await waPage.evaluate(() => {
      const main = document.querySelector('#main');
      if (!main) return { isOpen: false };
      const headerTitle = main.querySelector('header span[dir="auto"]')?.innerText.trim() || 'Unknown';
      const msgRows = main.querySelectorAll('div[role="row"]');
      return {
        isOpen: true,
        chatTitle: headerTitle,
        messageCount: msgRows.length
      };
    });

    console.log('Active chat status in #main:', JSON.stringify(activeChat, null, 2));
  } else {
    console.log('\nNo item strictly named "SOIC" in the search results yet. Let us check if there is an exact or approximate match.');
  }

  await browser.disconnect();
}

searchAndOpenSOIC().catch(console.error);
