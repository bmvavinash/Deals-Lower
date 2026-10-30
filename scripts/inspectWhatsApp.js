const puppeteer = require('puppeteer');

async function inspectWhatsApp() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!waPage) {
    console.error('No WhatsApp page found');
    await browser.disconnect();
    return;
  }

  console.log('Found WhatsApp page:', await waPage.title());

  // Check state of the page: QR code or chats list?
  const pageState = await waPage.evaluate(() => {
    const qrCanvas = document.querySelector('canvas[aria-label="Scan this QR code to link a device"]');
    const qrEl = document.querySelector('[data-ref]');
    const searchInput = document.querySelector('div[contenteditable="true"][data-tab="3"]') ||
                        document.querySelector('div[role="textbox"]') ||
                        document.querySelector('div[contenteditable="true"]');
    const sideEl = document.querySelector('#side');
    const mainEl = document.querySelector('#main');

    // List any visible chat titles in #side
    const chatTitles = [];
    if (sideEl) {
      const titleSpans = sideEl.querySelectorAll('span[title], span[dir="auto"]');
      titleSpans.forEach(s => {
        const title = s.getAttribute('title') || s.innerText.trim();
        if (title && title.length > 2 && !chatTitles.includes(title)) {
          chatTitles.push(title);
        }
      });
    }

    return {
      hasQR: Boolean(qrCanvas || qrEl),
      hasSide: Boolean(sideEl),
      hasMain: Boolean(mainEl),
      hasSearchInput: Boolean(searchInput),
      searchPlaceholder: searchInput ? searchInput.getAttribute('aria-label') || searchInput.getAttribute('data-tab') : null,
      visibleChats: chatTitles.slice(0, 30)
    };
  });

  console.log('WhatsApp page state:', JSON.stringify(pageState, null, 2));
  await browser.disconnect();
}

inspectWhatsApp().catch(console.error);
