const puppeteer = require('puppeteer');

async function findSearch() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pages = await browser.pages();
  const waPage = pages.find(p => p.url().includes('web.whatsapp.com'));

  const searchInfo = await waPage.evaluate(() => {
    // Look for all inputs, textboxes, and buttons in #side
    const inputs = Array.from(document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]')).map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      contenteditable: el.getAttribute('contenteditable'),
      title: el.getAttribute('title'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      className: el.className
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      text: b.innerText.trim()
    })).filter(b => b.ariaLabel || b.title || b.text);

    return { inputs, buttons: buttons.slice(0, 20) };
  });

  console.log('Inputs found:', JSON.stringify(searchInfo.inputs, null, 2));
  console.log('Buttons found:', JSON.stringify(searchInfo.buttons, null, 2));
  await browser.disconnect();
}

findSearch().catch(console.error);
