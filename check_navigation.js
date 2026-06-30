const { Builder, By, until, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const path = require("path");

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
    const url = "http://localhost:5173/";
    console.log(`Navigating to ${url}...`);
    await driver.get(url);
    
    // Wait for the dashboard to load
    console.log("Waiting for dashboard to load...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Find the Deals link in the sidebar
    console.log("Finding Deals link in sidebar...");
    const dealsLink = await driver.findElement(By.css("a[href='/deals']"));
    console.log("Clicking Deals link...");
    await dealsLink.click();
    
    // Wait for the Deals page to load
    console.log("Waiting 8 seconds for Deals page to load...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    console.log("--- BROWSER CONSOLE LOGS ---");
    const logs = await driver.manage().logs().get(logging.Type.BROWSER);
    for (const log of logs) {
      console.log(`[${log.level.name}] ${log.message}`);
    }
    console.log("----------------------------");

    // Check if there is any visible text
    const bodyText = await driver.executeScript("return document.body.innerText;");
    console.log("--- BODY TEXT PREVIEW ---");
    console.log(bodyText.substring(0, 1000));
    console.log("-------------------------");

    // Check if global-loading-overlay is present
    const overlays = await driver.findElements(By.className("global-loading-overlay"));
    console.log(`Found ${overlays.length} loading overlays on the page.`);
    
    // Take screenshot
    console.log("Taking screenshot of the page...");
    const screenshot = await driver.takeScreenshot();
    const outputPath = path.join("C:\\Users\\anila\\.gemini\\antigravity\\brain\\39205361-1de0-4114-9e90-066bb11dbb9a", "deals_navigation_debug.png");
    fs.writeFileSync(outputPath, screenshot, "base64");
    console.log(`Screenshot saved to ${outputPath}`);
    
  } catch (err) {
    console.error("Error running navigation check:", err);
  } finally {
    await driver.quit();
    console.log("Driver closed.");
  }
}

run();
