const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function testExtraction() {
  let driver;
  try {
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating to extrape...");
    await driver.get("https://www.extrape.com/login");
    await driver.sleep(3000);

    const emailField = await driver.findElement(By.id('outlined'));
    await emailField.click();
    await emailField.clear();
    // sendKeys character by character
    const email = 'test@example.com';
    for (let char of email) {
        await emailField.sendKeys(char);
        await driver.sleep(100);
    }
    console.log("Entered email");

    const buttons = await driver.findElements(By.css('button'));
    let continueBtn;
    for (let b of buttons) {
      let text = await b.getText();
      let classStr = await b.getAttribute('class');
      if (text.includes('Continue') && !text.includes('Google')) {
          continueBtn = b;
          console.log('Found Continue Button, disabled?', classStr.includes('disabled'));
      }
    }
    
    if (continueBtn) {
        await continueBtn.click();
        console.log("Clicked continue");
    }

  } catch (error) {
    console.error(error);
  } finally {
    if (driver) await driver.quit();
  }
}

testExtraction();
