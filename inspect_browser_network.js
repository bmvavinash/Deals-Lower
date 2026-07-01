const { Builder, By } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

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

    console.log("Waiting 6 seconds for network activity...");
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Get performance resource entries
    console.log("\n--- Browser Resource Loading Performance ---");
    const entries = await driver.executeScript(() => {
      return window.performance.getEntriesByType('resource').map(e => ({
        name: e.name,
        initiatorType: e.initiatorType,
        duration: e.duration,
        responseEnd: e.responseEnd
      }));
    });

    for (const entry of entries) {
      if (entry.name.includes('/api/')) {
        console.log(`[API REQUEST] ${entry.name}`);
        console.log(`   Initiator: ${entry.initiatorType}`);
        console.log(`   Duration: ${entry.duration.toFixed(2)}ms`);
      } else {
        console.log(`[Resource] ${entry.name.substring(0, 100)} (${entry.initiatorType})`);
      }
    }

    // Get any JavaScript errors or window state
    const reactQueryState = await driver.executeScript(() => {
      return {
        href: window.location.href,
        title: document.title,
        htmlSnippet: document.body.innerHTML.substring(0, 500)
      };
    });
    console.log("\n--- React Window State ---");
    console.log(reactQueryState);

  } catch (err) {
    console.error("Error running inspect script:", err.message);
  } finally {
    await driver.quit();
  }
}

run();
