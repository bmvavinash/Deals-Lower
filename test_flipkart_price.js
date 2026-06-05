const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function testExtraction() {
  let driver;
  try {
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating...");
    await driver.get("https://www.flipkart.com/rousn-40-cm-x-120-cotton-runner/p/itm75ac533bf73d7?pid=CPGH4UVWFGYGUH5T");
    await driver.sleep(5000);

    const priceEls = await driver.findElements(By.xpath('//div[contains(text(), "₹") and string-length(text()) < 10]'));
    console.log(`\n--- Prices ---`);
    for (let i = 0; i < priceEls.length; i++) {
        if (i > 3) break;
        let text = await priceEls[i].getText();
        console.log(`Price Text: ${text}`);
    }

    const mrpEls = await driver.findElements(By.xpath('//div[contains(@style, "line-through")]'));
    console.log(`\n--- MRP ---`);
    for (let i = 0; i < mrpEls.length; i++) {
        if (i > 3) break;
        let text = await mrpEls[i].getText();
        console.log(`MRP Text: ${text}`);
    }

    const discountEls = await driver.findElements(By.xpath('//div[contains(text(), "off") or contains(text(), "Off") or contains(text(), "%")]'));
    console.log(`\n--- Discount ---`);
    for (let i = 0; i < discountEls.length; i++) {
        if (i > 3) break;
        let text = await discountEls[i].getText();
        console.log(`Discount Text: ${text}`);
    }

  } catch (error) {
    console.error(error);
  } finally {
    if (driver) await driver.quit();
  }
}

testExtraction();
