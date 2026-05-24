const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function checkFlipkart() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Checking Flipkart...");
    await driver.get("https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4");
    await driver.sleep(5000);

    const data = await driver.executeScript(`
      const h1El = document.querySelector('h1');
      const spans = Array.from(h1El ? h1El.querySelectorAll('span') : []).map(s => ({ class: s.className, text: s.innerText }));
      return {
        h1Class: h1El ? h1El.className : null,
        h1Spans: spans,
        allH1s: Array.from(document.querySelectorAll('h1')).map(h => ({class: h.className, text: h.innerText}))
      };
    `);
    console.log("Flipkart Data:", JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkFlipkart();
