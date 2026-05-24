const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');

async function analyzeAjio() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Analyzing Old URL...");
    await driver.get("https://www.ajio.com/nike-air-force-1-07-lx-low-top-lace-up-casual-shoes/p/469554316_olive");
    await driver.sleep(5000); 
    const finalUrlOld = await driver.getCurrentUrl();
    const titleOld = await driver.getTitle();
    let bodyTextOld = "";
    try {
        const bodyEl = await driver.findElement(By.tagName('body'));
        bodyTextOld = await bodyEl.getText();
    } catch(e) {}
    
    let oldScreenshot = await driver.takeScreenshot();
    fs.writeFileSync('ajio_old.png', oldScreenshot, 'base64');

    console.log("Old URL Analysis:");
    console.log("Final Redirected URL:", finalUrlOld);
    console.log("Page Title:", titleOld);
    console.log("Page Text Snippet:", bodyTextOld.substring(0, 500).replace(/\n/g, ' '));


    console.log("\nAnalyzing New URL...");
    await driver.get("https://www.ajio.com/w-floral-print-straight-kurta-suit-set/p/442252483_lightyellow");
    await driver.sleep(5000); 
    const finalUrlNew = await driver.getCurrentUrl();
    const titleNew = await driver.getTitle();
    let bodyTextNew = "";
    try {
        const bodyEl = await driver.findElement(By.tagName('body'));
        bodyTextNew = await bodyEl.getText();
    } catch(e) {}

    let newScreenshot = await driver.takeScreenshot();
    fs.writeFileSync('ajio_new.png', newScreenshot, 'base64');

    console.log("New URL Analysis:");
    console.log("Final Redirected URL:", finalUrlNew);
    console.log("Page Title:", titleNew);
    console.log("Page Text Snippet:", bodyTextNew.substring(0, 500).replace(/\n/g, ' '));

  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeAjio();
