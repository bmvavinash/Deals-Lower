const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to a page
  await page.goto('https://example.com');

  // Switch to the extension popup
  const extensionId = 'your_extension_id';
  const extensionUrl = `chrome-extension://${extensionId}/popup.html`;
  const extensionPage = await browser.newPage();
  await extensionPage.goto(extensionUrl);

  // Interact with the extension popup
  const element = await extensionPage.$('your_selector_here');
  const text = await element.evaluate(el => el.textContent);
  console.log(text);

  await browser.close();
})();
