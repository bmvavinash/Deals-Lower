const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function extractAttribute(driver, attributeConfig) {
  for (let config of attributeConfig) {
    try {
      let element;
      if (config.type === "xpath") {
        element = await driver.findElement(By.xpath(config.selector));
      } else if (config.type === "id") {
        element = await driver.findElement(By.id(config.selector));
      } else if (config.type === "className") {
        element = await driver.findElement(By.className(config.selector));
      } else if (config.type === "css") {
        element = await driver.findElement(By.css(config.selector));
      }
      
      const attributeToExtract = config.attribute || "innerHTML";
      let rawValue = await element.getAttribute(attributeToExtract);
      console.log(`Success on ${config.selector}: ${rawValue}`);
      return rawValue;
    } catch (e) {
      console.log(`Failed on ${config.selector}: ${e.message}`);
    }
  }
  return null;
}

async function testExtraction() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating...");
    await driver.get("https://www.myntra.com/jeans/roadster/roadster-men-black-carrot-fit-mid-rise-clean-look-stretchable-jeans/11631306/buy");
    await driver.sleep(5000);

    const config = [
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/div[1]/div/div[1]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][1]', attribute: "style" },
        { type: "css", selector: '.image-grid-image', attribute: "style" }
    ];

    const result = await extractAttribute(driver, config);
    console.log("Result:", result);

  } catch (error) {
    console.error(error);
  }
}

testExtraction();
