
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
async function check() {
  let options = new chrome.Options();
  options.addArguments("--headless", "--no-sandbox");
  let driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  await driver.get("https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4");
  await driver.wait(until.elementLocated(By.css("body")), 10000);
  let html = await driver.getPageSource();
  const fs = require("fs");
  fs.writeFileSync("fk_page.html", html);
  console.log("Saved to fk_page.html");
  await driver.quit();
}
check();

