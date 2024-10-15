const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');

async function whatsappLastMessage(driver) {
    // Initialize the Chrome WebDriver
    try {
        let latestMessage="";
        // Open WhatsApp Web
        // await driver.get('https://web.whatsapp.com');
        
        // // Wait until the QR code is scanned and the WhatsApp chat page is loaded
        // console.log('Please scan the QR code to log in to WhatsApp Web.');
        // await driver.wait(until.elementLocated(By.css('._2_1wd.copyable-text.selectable-text')), 300000);  // Adjust the timeout as needed

        // // Wait for the chat to load
        // await driver.wait(until.elementLocated(By.css('div._3uIPm.message-in')), 10000);

        // Select the latest message element
        // let latestMessage = await driver.findElement(By.css('div._3uIPm.message-in:last-of-type ._1Gy50'));
        // let latestMessage = await driver.findElement(By.xpath('//*[@id="main"]/div[3]/div/div[2]/div[2]/div[3]/div/div/div[1]/div[1]/div[1]/div'));
        try{

            latestMessage = await driver.findElement(By.xpath('//*[@id="main"]/div[3]/div/div[2]/div[2]/div[1]/div/div/div[1]/div[1]/div[1]/div'));
            
        }
        catch(e){
            checkDateChange = await driver.findElement(By.xpath('//*[@id="main"]/div[3]/div/div[2]/div[2]/div[1]/div')).getText();
            checkDateChange = await driver.findElement(By.xpath('//*[@id="main"]/div[3]/div/div[2]/div[2]/div[6]/div')).getText();
            console.log("IN catch ",checkDateChange);
        }

        // Extract and log the message content
        let messageContent = await latestMessage.getText();
        console.log('Latest Message: ', messageContent);

    } finally {
        // Quit the driver after a delay
        await driver.sleep(5000); // Just for visibility, remove if not needed
        // await driver.quit();
    }
}

module.exports = whatsappLastMessage;
