const puppeteer = require('puppeteer');

async function debugWhatsAppDOM() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.log('No WhatsApp page');
    await browser.disconnect();
    return;
  }

  // Take screenshot
  const screenshotPath = 'C:\\Users\\anila\\.gemini\\antigravity\\brain\\f1cdb1b3-9369-4628-80c0-9f69c5c6e934\\scratch\\wa_current.png';
  await waPage.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  // Check what is in the search box or current page
  const info = await waPage.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Search"], input[aria-label*="Search"]');
    return {
      inputValue: input ? input.value : null,
      activeElementTag: document.activeElement ? document.activeElement.tagName : null,
      activeElementAria: document.activeElement ? document.activeElement.getAttribute('aria-label') : null,
      title: document.title
    };
  });
  console.log('DOM info:', JSON.stringify(info, null, 2));

  await browser.disconnect();
}

debugWhatsAppDOM().catch(console.error);
