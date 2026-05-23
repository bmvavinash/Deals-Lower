const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { scrapeProduct } = require('./scrappers/amazon');

async function testExtraction() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Testing Myntra...");
    await driver.get("https://www.myntra.com/jeans/roadster/roadster-men-black-carrot-fit-mid-rise-clean-look-stretchable-jeans/11631306/buy");
    const myntraProduct = await scrapeProduct("https://www.myntra.com/jeans/roadster/roadster-men-black-carrot-fit-mid-rise-clean-look-stretchable-jeans/11631306/buy", "myntra", driver);
    console.log("Myntra Result Brand:", myntraProduct.brand);
    console.log("Myntra Result Title:", myntraProduct.title);

    console.log("\nTesting Amazon...");
    await driver.get("https://www.amazon.in/Apple-MacBook-Chip-13-inch-256GB/dp/B08N5W4NNB");
    const amazonProduct = await scrapeProduct("https://www.amazon.in/Apple-MacBook-Chip-13-inch-256GB/dp/B08N5W4NNB", "amazon", driver);
    console.log("Amazon Result Brand:", amazonProduct?.brand);
    console.log("Amazon Result Title:", amazonProduct?.title);

    console.log("\nTesting Ajio...");
    await driver.get("https://www.ajio.com/w-floral-print-straight-kurta-suit-set/p/442252483_lightyellow");
    const ajioProduct = await scrapeProduct("https://www.ajio.com/w-floral-print-straight-kurta-suit-set/p/442252483_lightyellow", "ajio", driver);
    console.log("Ajio Result Brand:", ajioProduct?.brand);
    console.log("Ajio Result Title:", ajioProduct?.title);

    console.log("\nTesting Flipkart...");
    await driver.get("https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4");
    const flipkartProduct = await scrapeProduct("https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4", "flipkart", driver);
    console.log("Flipkart Result Brand:", flipkartProduct?.brand);
    console.log("Flipkart Result Title:", flipkartProduct?.title);

  } catch (error) {
    console.error('Error:', error);
  }
}

testExtraction();
