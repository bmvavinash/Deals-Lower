const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { getModuleLogger } = require("./logger/logger");
const handleProductProcessingModule = require("./dataSources/handleProductProcessing");
const { firebaseget } = require('./database/firebaseget');

const logger = getModuleLogger("test-process-product");

async function runTest() {
  let driver;
  try {
    const url = "https://www.flipkart.com/homlex-4-ft-x-6-acrylic-carpet/p/itm3671973887974?pid=CPGHNA7SHW3ZJMHY&lid=LSTCPGHNA7SHW3ZJMHYU4Q7YI&marketplace=FLIPKART&q=carpets&store=jra%2Fkwq%2Fz3j&srno=s_1_5&otracker=search&otracker1=search&fm=Search&iid=f9729334-f452-4f9e-8d0e-3bdc36fff451.CPGHNA7SHW3ZJMHY.SEARCH&ppt=sp&ppn=sp&qH=3a04a6c25fccc28a&ov_redirect=true&ov_redirect=true";
    
    let options = new chrome.Options();
    options.addArguments('--headless=new'); // Use headless so we don't interfere with the user's browser
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    
    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

    logger.info("Starting product processing test with fresh driver...");
    const jsonDataResult = await firebaseget();
    const jsonData = jsonDataResult?.data || jsonDataResult || {};
    const todayJsonDataResult = await firebaseget(true);
    const todayJsonData = todayJsonDataResult?.data || todayJsonDataResult || {};
    const len = jsonDataResult?.len || 0;

    const processProduct = handleProductProcessingModule.processProduct || require('./scheduler').getProductDetails;

    const result = await processProduct(
      driver,
      url,
      "", // text
      len, // len
      "", // accessToken
      jsonData,
      todayJsonData,
      true, // postProduct
      "", // username
      false, // generateLink
      "" // shortUrl
    );

    logger.info("Product processed successfully:", result);
  } catch (error) {
    logger.error("Error during product processing:", { error: error.message, stack: error.stack });
  } finally {
    if (driver) {
      await driver.quit();
      logger.info("Test completed and driver quit.");
    }
  }
}

runTest();
