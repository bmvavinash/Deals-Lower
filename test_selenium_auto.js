const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const options = new chrome.Options();
options.addArguments('--headless=new');
options.addArguments('--no-sandbox');

async function test() {
  console.log("Attempting driver creation without requiring chromedriver...");
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  console.log("✅ Success! Driver created successfully!");
  await driver.quit();
}
test().catch(console.error);
