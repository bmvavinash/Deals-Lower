const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function checkAjio() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Checking Ajio Old URL...");
    await driver.get("https://www.ajio.com/nike-air-force-1-07-lx-low-top-lace-up-casual-shoes/p/469554316_olive");
    await driver.sleep(5000); 
    const dataOld = await driver.executeScript(`
      return {
        bodyLength: document.body.innerHTML.length,
        title: document.title,
        h1Count: document.querySelectorAll('h1').length,
        h2Count: document.querySelectorAll('h2').length
      };
    `);
    console.log("Ajio Old URL Data:", dataOld);

    console.log("Checking Ajio New URL...");
    await driver.get("https://www.ajio.com/w-floral-print-straight-kurta-suit-set/p/442252483_lightyellow");
    await driver.sleep(5000); 
    const dataNew = await driver.executeScript(`
      return {
        bodyLength: document.body.innerHTML.length,
        title: document.title,
        h1Count: document.querySelectorAll('h1').length,
        h2Count: document.querySelectorAll('h2').length
      };
    `);
    console.log("Ajio New URL Data:", dataNew);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAjio();
