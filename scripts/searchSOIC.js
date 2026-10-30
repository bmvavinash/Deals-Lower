const puppeteer = require('puppeteer');

async function searchSOIC() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('No WhatsApp page found');
    await browser.disconnect();
    return;
  }

  // 1. Focus search input
  console.log('Focusing search input...');
  const searchInput = await waPage.$('input[placeholder="Search or start a new chat"]');
  if (!searchInput) {
    console.error('Search input not found');
    await browser.disconnect();
    return;
  }

  await searchInput.click();
  await new Promise(r => setTimeout(r, 500));

  // Type SOIC Research
  await waPage.keyboard.type('SOIC Research', { delay: 50 });
  console.log('Typed "SOIC Research"');
  await new Promise(r => setTimeout(r, 2000));

  // Take screenshot of search results
  const shotPath = 'C:\\Users\\anila\\.gemini\\antigravity\\brain\\f1cdb1b3-9369-4628-80c0-9f69c5c6e934\\scratch\\wa_search_results.png';
  await waPage.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  // Inspect visible chat items in #side
  const items = await waPage.evaluate(() => {
    const side = document.querySelector('#side');
    if (!side) return [];
    const elements = Array.from(side.querySelectorAll('span[title], div[role="listitem"] span[dir="auto"]'));
    return elements.map(el => ({
      title: el.getAttribute('title') || el.innerText.trim(),
      text: el.innerText.trim()
    })).filter(x => x.title && x.title.length > 1);
  });

  console.log('Visible items:', JSON.stringify(items.slice(0, 25), null, 2));

  await browser.disconnect();
}

searchSOIC().catch(console.error);
