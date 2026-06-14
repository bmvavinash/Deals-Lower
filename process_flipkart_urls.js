const { getProductDetails } = require('./scheduler');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function processUrls() {
  const urls = [
    'https://dl.flipkart.com/dl/trust-usa-model-523-inspire-personal-digital-electronic-body-weight-machine-human-180kg-capacity-weighing-scale/p/itmb3a6f89a0d2f9?pid=WSLG8M2YNRWUFRCK&lid=LSTWSLG8M2YNRWUFRCKZVKSOX&marketplace=FLIPKART&_refId=&_appId=WA',
    'https://dl.flipkart.com/dl/shivkirpa-5-ft-x-7-velvet-carpet/p/itme55b15edda542?pid=CPGFZP2EEVZGGUU3&lid=LSTCPGFZP2EEVZGGUU3BA7WDN&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL3NpbWlsYXIifQ==&_refId=&_appId=WA',
    'https://dl.flipkart.com/dl/ncs-5-cm-x-7-cotton-carpet/p/itmeb0269a4f6c89?pid=CPGG9P46ZZ4NRCQH&lid=LSTCPGG9P46ZZ4NRCQHELUCQY&hl_lid=&marketplace=FLIPKART&fm=eyJ3dHAiOiJyZWNvIiwicHJwdCI6InBwIiwibWlkIjoicHJvZHVjdFJlY29tbWVuZGF0aW9uL2FzcGVjdFNpbWlsYXIifQ==&_refId=&_appId=WA'
  ];

  let options = new chrome.Options();
  options.addArguments('--headless', '--disable-gpu', '--window-size=1920,1080', '--no-sandbox');

  let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    for (let url of urls) {
      let errorContext = {};
      console.log(`\nProcessing: ${url}`);
      
      const result = await getProductDetails(
        driver,
        url,
        '', // text
        0, // len
        '', // access_token
        {}, // data
        {}, // todayData
        true, // postProduct
        '', // username
        false, // generateLink
        '', // shortUrl
        null, // categoryOverride
        errorContext
      );
      
      console.log(`Result code: ${result}`);
      if (errorContext.reason) {
        console.log(`Error Reason: ${errorContext.reason}`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    await driver.quit();
  }
}

processUrls();
