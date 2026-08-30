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

    console.log("Waiting 6 seconds...");
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Check if the loading overlay exists
    const overlayCount = await driver.executeScript(() => {
      const overlay = document.querySelector(".global-loading-overlay");
      return overlay ? {
        present: true,
        style: overlay.getAttribute("style"),
        innerText: overlay.innerText,
        html: overlay.outerHTML
      } : { present: false };
    });

    console.log("Overlay info:", overlayCount);

    // Get counts of deals rendered on the page
    const dealCardsCount = await driver.executeScript(() => {
      const cards = document.querySelectorAll(".deal-card, .expandable-deal-card, tr, .content-card");
      return {
        cardsLength: cards.length,
        cardClasses: Array.from(cards).slice(0, 5).map(c => c.className),
        cardText: Array.from(cards).slice(0, 2).map(c => c.innerText)
      };
    });

    console.log("Rendered elements counts:", dealCardsCount);

  } catch (err) {
    console.error("Error running DOM debug:", err.message);
  } finally {
    await driver.quit();
  }
}

run();
