const { Builder, By } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");

async function run() {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--window-size=1280,1024');

  console.log("Launching headless Chrome...");
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log("Navigating to http://localhost:5174/deals...");
    await driver.get("http://localhost:5174/deals");

    console.log("Waiting 6 seconds to observe loading behavior...");
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Capture screenshot
    const screenshot = await driver.takeScreenshot();
    const screenshotPath = "C:\\Users\\anila\\.gemini\\antigravity\\brain\\39205361-1de0-4114-9e90-066bb11dbb9a\\deals_page_debug.png";
    fs.writeFileSync(screenshotPath, screenshot, 'base64');
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Retrieve browser logs
    console.log("\n--- Browser Console Logs ---");
    const logs = await driver.manage().logs().get("browser");
    if (logs.length === 0) {
      console.log("(No console logs)");
    }
    for (const log of logs) {
      console.log(`[${log.level.name}] ${log.message}`);
    }

  } catch (err) {
    console.error("Error running debug script:", err.message);
  } finally {
    await driver.quit();
  }
}

run();
