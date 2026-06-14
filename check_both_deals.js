const { Builder, By, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const path = require("path");

async function checkUrl(driver, url, label, screenshotName) {
  console.log(`\n========================================`);
  console.log(`Checking ${label}: ${url}`);
  console.log(`========================================`);
  try {
    await driver.get(url);
    
    // Wait for the page content to load
    console.log("Waiting 8 seconds for page to load...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    console.log("--- BROWSER CONSOLE LOGS ---");
    const logs = await driver.manage().logs().get(logging.Type.BROWSER);
    for (const log of logs) {
      console.log(`[${log.level.name}] ${log.message}`);
    }
    console.log("----------------------------");

    // Check if there is any visible text
    const bodyText = await driver.executeScript("return document.body.innerText;");
    console.log("--- BODY TEXT PREVIEW (first 500 chars) ---");
    console.log(bodyText.substring(0, 500));
    console.log("-------------------------");

    // Take screenshot
    console.log("Taking screenshot of the page...");
    const screenshot = await driver.takeScreenshot();
    const outputPath = path.join("C:\\Users\\anila\\.gemini\\antigravity\\brain\\39205361-1de0-4114-9e90-066bb11dbb9a", screenshotName);
    fs.writeFileSync(outputPath, screenshot, "base64");
    console.log(`Screenshot saved to ${outputPath}`);
  } catch (err) {
    console.error(`Error checking ${label}:`, err);
  }
}

async function run() {
  console.log("Initializing WebDriver...");
  
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,1024');
  options.setLoggingPrefs(prefs);

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    // 1. Check Deals Dashboard (port 5173)
    await checkUrl(driver, "http://localhost:5173/deals", "Deals Dashboard (5173)", "dashboard_deals.png");
    
    // 2. Check Affiliate Frontend (port 3000)
    await checkUrl(driver, "http://localhost:3000/deals", "Affiliate Frontend (3000)", "affiliate_deals.png");
    
  } finally {
    await driver.quit();
    console.log("Driver closed.");
  }
}

run();
