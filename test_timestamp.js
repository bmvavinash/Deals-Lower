const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { getProductDetails } = require('./scheduler');

async function testProcess() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    const url = "https://www.amazon.in/dp/B0CS2SVZWC?social_share=cm_sw_r_cp_ud_dp_NQRQQHEFDPVMRNNVTPSB&th=1&linkCode=sl1&tag=dealshubglo0c-21&linkId=823b14dd9705a9425ba4bfc0fda46172&language=en_IN&ref_=as_li_ss_tl";
    
    console.log("Navigating to URL...");
    await driver.get(url);
    await driver.sleep(3000); // Wait for page

    console.log("Calling getProductDetails...");
    const result = await getProductDetails(driver, url, '', 0, '', {}, {}, true, '', false, '');
    console.log("Result:", result);

  } catch (err) {
    console.error("Error:", err);
  }
}

testProcess();
