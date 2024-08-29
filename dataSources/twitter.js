const { Builder, By, until } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
// const { getProductDetails } = require("../scheduler");
// const { firebaseget } = require("../database/firebaseget");
// const { getAccessToken } = require("../database/getAccessToken");
// const constants = require("../config/constants");
// const { exit } = require("process");
// const fs = require("fs").promises;

async function getTwitter() {
    try {
      
      // let env = constants.env;
  
    //   let access_token = await getAccessToken(env);
      // let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();
      console.log("hai")
      //chrome
      let options = await new chrome.Options();
      options.debuggerAddress("localhost:9222");
      //CHROME
      driver = await chrome.Driver.createSession(options);

      await driver.get("https://twitter.com")
      // await driver.sleep(10000);
      // let n  = await driver.findElement(By.xpath('/*[@id="react-root"]/div/div/div[2]/header/div/div/div/div[1]/div[2]/nav/a[3]/div/div/div')).getAttribute("innerHTML");
      // await driver.wait(until.elementLocated(By.xpath('//*[@id="main"]/footer/div[1]/div/span[2]/div/div[2]/div[1]/div/div[1]
      let n  = await driver.wait(until.elementLocated(By.xpath('//*[@id="react-root"]/div/div/div[2]/header/div/div/div/div[1]/div[2]/nav/a[3]/div/div/div/span')),10000).getAttribute("innerHTML");
      // let n  = await driver.findElement(By.xpath('/*[@id="react-root"]/div/div/div[2]/header/div/div/div/div[1]/div[2]/nav/a[3]/div/div/div/span')).getAttribute("innerHTML");
      console.log("Number of notifications are ",n);
    } 
    catch(e) {
        console.log("Twitter Error",e)
    }
}
getTwitter();

module.exports = {
    getTwitter,
  };