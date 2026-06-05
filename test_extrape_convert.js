const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const constants = require('./config/constants');

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
    for (let char of constants.extraPeUsername) {
        await emailField.sendKeys(char);
        await driver.sleep(10);
    }
    
    let buttons = await driver.findElements(By.css('button'));
    for (let b of buttons) {
      let text = await b.getText();
      if (text.includes('Continue') && !text.includes('Google')) {
          await b.click();
          break;
      }
    }
    await driver.sleep(2000);
    
    const passwordField = await driver.findElement(By.id('outlined'));
    await passwordField.click();
    await passwordField.clear();
    for (let char of constants.extraPePassword) {
        await passwordField.sendKeys(char);
        await driver.sleep(10);
    }
    
    buttons = await driver.findElements(By.css('button'));
    for (let b of buttons) {
      let text = await b.getText();
      if (text.includes('Sign in') || text.includes('Login')) {
          await b.click();
          break;
      }
    }
    console.log("Logged in");
    await driver.sleep(5000);
    
    await driver.get("https://www.extrape.com/link-converter");
    await driver.sleep(5000);
    
    console.log("On Link Converter page");
    const textareas = await driver.findElements(By.css('textarea'));
    for (let i=0; i<textareas.length; i++) {
        let isDisplayed = await textareas[i].isDisplayed();
        let placeholder = await textareas[i].getAttribute('placeholder');
        console.log(`Textarea ${i}: displayed=${isDisplayed}, placeholder=${placeholder}`);
    }
    
    const pageButtons = await driver.findElements(By.css('button'));
    for (let b of pageButtons) {
        let text = await b.getText();
        if (text) {
            console.log("Button text:", text);
        }
    }

  } catch (error) {
    console.error(error);
  } finally {
    if (driver) await driver.quit();
  }
}

testExtraction();
