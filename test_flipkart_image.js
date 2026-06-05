const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function testExtraction() {
  let driver;
  try {
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating...");
    await driver.get("https://www.flipkart.com/homlex-4-ft-x-6-acrylic-carpet/p/itm3671973887974?pid=CPGHNA7SHW3ZJMHY");
    await driver.sleep(5000);

    const img = await driver.findElement(By.xpath('(//img[contains(@src, "rukminim2.flixcart.com/image")])[1]'));
    console.log("Found image:", await img.getAttribute("src"));

  } catch (error) {
    console.error(error);
  } finally {
    if (driver) await driver.quit();
  }
}

testExtraction();
