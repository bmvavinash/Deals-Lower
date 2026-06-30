const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { scrapeFlipkartProduct } = require('./scrappers/flipkart');

async function test() {
  const url = 'https://dl.flipkart.com/dl/trust-usa-model-523-inspire-personal-digital-electronic-body-weight-machine-human-180kg-capacity-weighing-scale/p/itmb3a6f89a0d2f9?pid=WSLG8M2YNRWUFRCK&lid=LSTWSLG8M2YNRWUFRCKZVKSOX&marketplace=FLIPKART&_refId=&_appId=WA';
  
  let options = new chrome.Options();
  options.addArguments('--headless');
  options.addArguments('--disable-gpu');
  options.addArguments('--window-size=1920,1080');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    console.log('Navigating to:', url);
    await driver.get(url);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Check if there is a redirect or captcha
    const currentUrl = await driver.getCurrentUrl();
    console.log('Current URL after load:', currentUrl);
    
    const pageSource = await driver.getPageSource();
    if (pageSource.includes('captcha') || pageSource.includes('robot')) {
        console.log('CAPTCHA DETECTED!');
    }

    console.log('Scraping product...');
    const result = await scrapeFlipkartProduct(url, "", driver);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await driver.quit();
  }
}

test();
