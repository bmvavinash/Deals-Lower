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

  const requests = [];
  const consoleErrors = [];

  try {
    // Enable performance logging to capture network requests if needed,
    // but we can also use driver callbacks or log inspection.
    // For simplicity, let's just inspect the browser's console logs:
    console.log("Navigating to http://localhost:5174/deals...");
    await driver.get("http://localhost:5174/deals");

    console.log("Waiting 10 seconds to observe loading behavior...");
    
    // Periodically check page content/state
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const bodyText = await driver.findElement(By.tagName("body")).getText();
      console.log(`[Interval ${i * 2}s] Body text snippet: "${bodyText.substring(0, 200).replace(/\n/g, ' | ')}..."`);
    }

    // Capture screenshot
    const screenshot = await driver.takeScreenshot();
    const screenshotPath = "C:\\Users\\anila\\.gemini\antigravity\\brain\\39205361-1de0-4114-9e90-066bb11dbb9a\\deals_page_debug.png";
    fs.writeFileSync(screenshotPath, screenshot, 'base64');
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Retrieve browser logs
    console.log("\n--- Browser Console Logs ---");
    const logs = await driver.manage().logs().get("browser");
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
