const { Builder, By, logging } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function run() {
  console.log("Initializing WebDriver...");
  
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1280,1024');

  // Enable Performance Log to capture network requests
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.ALL);
  options.setLoggingPrefs(prefs);

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    const url = "http://localhost:5173/deals";
    console.log(`Navigating to ${url}...`);
    await driver.get(url);
    
    // Wait for 10 seconds
    console.log("Waiting 10 seconds...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Read performance logs
    const logs = await driver.manage().logs().get(logging.Type.PERFORMANCE);
    console.log(`Captured ${logs.length} performance log entries.`);
    
    // Filter and print Network request/response events
    for (const log of logs) {
      const message = JSON.parse(log.message).message;
      if (message.method === "Network.requestWillBeSent") {
        const reqUrl = message.params.request.url;
        if (reqUrl.includes("/api/")) {
          console.log(`[REQ] ID: ${message.params.requestId} | ${message.params.request.method} ${reqUrl}`);
        }
      } else if (message.method === "Network.responseReceived") {
        const respUrl = message.params.response.url;
        if (respUrl.includes("/api/")) {
          console.log(`[RESP] ID: ${message.params.requestId} | Status: ${message.params.response.status} ${message.params.response.statusText} for ${respUrl}`);
        }
      } else if (message.method === "Network.loadingFailed") {
        console.log(`[FAIL] ID: ${message.params.requestId} | Error: ${message.params.errorText}`);
      }
    }
    
    // Check final page state
    const bodyText = await driver.executeScript("return document.body.innerText;");
    console.log("--- BODY TEXT PREVIEW ---");
    console.log(bodyText.substring(0, 500));
    console.log("-------------------------");
    
  } catch (err) {
    console.error("Error running network check:", err);
  } finally {
    await driver.quit();
    console.log("Driver closed.");
  }
}

run();
