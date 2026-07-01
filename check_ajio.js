const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function checkAjio() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating to Ajio Homepage first...");
    await driver.get("https://www.ajio.com/");
    await driver.sleep(6000); 

    const homeTitle = await driver.getTitle();
    console.log("Homepage Title:", homeTitle);

    console.log("Navigating to Ajio Category page...");
    await driver.get("https://www.ajio.com/men-jeans/c/830207002");
    await driver.sleep(6000); 

    const data = await driver.executeScript(`
      return {
        bodyLength: document.body.innerHTML.length,
        title: document.title,
        h1Count: document.querySelectorAll('h1').length,
        h2Count: document.querySelectorAll('h2').length,
        baseElementsCount: document.querySelectorAll('div.item.rilrtl-products-list__item').length
      };
    `);
    console.log("Ajio Category Page Data:", data);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAjio();
