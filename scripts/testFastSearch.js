const puppeteer = require('puppeteer');

async function testFastSearch() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('No WhatsApp page found');
    await browser.disconnect();
    return;
  }

  console.log('Focusing and typing via DOM events...');
  const success = await waPage.evaluate(() => {
    const input = document.querySelector('input[placeholder="Search or start a new chat"]') ||
                  document.querySelector('input[aria-label="Search or start a new chat"]') ||
                  document.querySelector('input[role="textbox"]');
    if (!input) return false;
    input.focus();
    input.value = 'SOIC';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });

  console.log('DOM input success:', success);

  // Also trigger keyboard type just in case WhatsApp reacts to keydown
  if (success) {
    await waPage.keyboard.press('Space');
    await waPage.keyboard.type('Research');
    await waPage.keyboard.press('Enter');
  }

  await new Promise(r => setTimeout(r, 2000));

  // Take screenshot
  const shotPath = 'C:\\Users\\anila\\.gemini\\antigravity\\brain\\f1cdb1b3-9369-4628-80c0-9f69c5c6e934\\scratch\\wa_search_results.png';
  await waPage.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  // Inspect sidebar
  const searchResults = await waPage.evaluate(() => {
    const side = document.querySelector('#side');
    if (!side) return [];
    const rows = Array.from(side.querySelectorAll('div[role="listitem"], div[role="row"]'));
    return rows.map((r, i) => ({
      i,
      text: r.innerText.trim().replace(/\n/g, ' -- ')
    }));
  });

  console.log('Search results count:', searchResults.length);
  searchResults.forEach(r => console.log(`[${r.i}] ${r.text}`));

  await browser.disconnect();
}

testFastSearch().catch(console.error);
