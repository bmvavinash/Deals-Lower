const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver');
const chrome = require('selenium-webdriver/chrome');

async function browserTelegramScrap() {
    let driver;
    try {
        // chrome options
        let options = new chrome.Options();
        options.addArguments("--remote-debugging-port=9222");
        // options.addArguments("--start-maximized"); // To maximize the browser window

        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

        await driver.get('https://web.telegram.org/k/#@bonercto');

        // Add logic to wait for specific elements and scrape data as required
        // Example: waiting for messages to load
        await driver.wait(until.elementLocated(By.className('tgme_widget_message_text')), 10000);

        let messages = await driver.findElements(By.className('tgme_widget_message_text'));
        for (let message of messages) {
            console.log(await message.getText());
        }
    } catch (e) {
        console.log('Telegram Error', e);
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

browserTelegramScrap();

module.exports = {
    browserTelegramScrap,
};
