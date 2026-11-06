const puppeteer = require('puppeteer');

async function clickOlderMessages() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('web.whatsapp.com'));
  if (!page) {
    console.error('WhatsApp Web page not found!');
    await browser.disconnect();
    return;
  }

  console.log('Checking for older messages button in #main...');
  const buttonInfo = await page.evaluate(() => {
    const main = document.querySelector('#main');
    if (!main) return { found: false, error: 'No #main found' };

    // Find all clickable elements
    const elements = Array.from(main.querySelectorAll('button, span, div'));
    const target = elements.find(el => el.innerText && el.innerText.toLowerCase().includes('older messages'));
    if (!target) return { found: false, text: main.innerText.substring(0, 300) };

    const rect = target.getBoundingClientRect();
    return {
      found: true,
      text: target.innerText,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };
  });

  console.log('Button info:', buttonInfo);

  if (buttonInfo.found) {
    console.log(`Clicking button at (${buttonInfo.x}, ${buttonInfo.y})...`);
    await page.mouse.click(buttonInfo.x, buttonInfo.y);
    console.log('Clicked! Waiting 8 seconds for WhatsApp to fetch messages from phone...');
    await new Promise(r => setTimeout(r, 8000));
  }

  // Check messages count now
  const afterStatus = await page.evaluate(() => {
    const main = document.querySelector('#main');
    if (!main) return { hasMain: false };
    const rows = Array.from(main.querySelectorAll('div[role="row"]'));
    return {
      hasMain: true,
      header: main.querySelector('header')?.innerText?.split('\n')[0],
      rowCount: rows.length,
      sampleText: main.innerText.substring(0, 400)
    };
  });

  console.log('Status after action:', afterStatus);
  await browser.disconnect();
}

clickOlderMessages().catch(console.error);
