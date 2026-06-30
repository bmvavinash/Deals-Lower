const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function run() {
  console.log("Initializing WebDriver...");
  
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,1024');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    const url = "http://localhost:5173/deals";
    console.log(`Navigating to ${url}...`);
    const startTime = Date.now();
    await driver.get(url);
    
    // Poll the page state every 500ms for up to 30 seconds
    console.log("Polling page state...");
    let loaded = false;
    for (let i = 0; i < 60; i++) {
      const bodyText = await driver.executeScript("return document.body.innerText;");
      const hasLoading = bodyText.includes("Loading...");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Let's see what the page contains
      const hasDeals = bodyText.includes("iQOO") || bodyText.includes("Price") || bodyText.includes("Code");
      
      console.log(`[${elapsed}s] hasLoading: ${hasLoading}, hasDeals: ${hasDeals}`);
      
      if (!hasLoading && hasDeals) {
        console.log(`🎉 Page finished loading in ${elapsed}s!`);
        loaded = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!loaded) {
      console.log("❌ Page did not finish loading after 30 seconds.");
    }
    
  } catch (err) {
    console.error("Error in measurement script:", err);
  } finally {
    await driver.quit();
    console.log("Driver closed.");
  }
}

run();
