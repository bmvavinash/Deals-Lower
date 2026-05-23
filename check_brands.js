const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function checkBrands() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Checking Myntra...");
    await driver.get("https://www.myntra.com/jeans/roadster/roadster-men-black-carrot-fit-mid-rise-clean-look-stretchable-jeans/11631306/buy");
    await driver.sleep(5000);

    const myntraBrand = await driver.executeScript(`
      const titleEl = document.querySelector('.pdp-title');
      const nameEl = document.querySelector('.pdp-name');
      const h1El = document.querySelector('h1.pdp-title');
      const altH1 = document.querySelector('h1');
      return {
        pdpTitle: titleEl ? titleEl.innerText : null,
        pdpName: nameEl ? nameEl.innerText : null,
        h1Title: h1El ? h1El.innerText : null,
        altH1: altH1 ? { class: altH1.className, text: altH1.innerText } : null
      };
    `);
    console.log("Myntra Brand Data:", myntraBrand);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Don't quit to keep it alive
  }
}

checkBrands();
