const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function getExtensionPopupUrl(extensionId) {
    // Set the Chrome options to attach to an existing session
    let options = new chrome.Options();
    options = options.debuggerAddress("localhost:9222"); // Connect to existing Chrome session

    // Create a new WebDriver instance with the Chrome options
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        // Navigate to the website where you will click the button
        // await driver.get('https://x.com/XAlphaAI_Team'); // Replace with your website URL

        // Click the button that opens the extension popup
        try {
            await driver.wait(until.elementLocated(By.xpath('//*[@id="xof2idk"]/img')), 10000); // Replace with your button locator
            await driver.findElement(By.xpath('//*[@id="xof2idk"]/img')).click();
        } catch (error) {
            console.log("Error clicking the button:", error.message);
            return;
        }

        console.log("Clicked the button to open extension popup");

        // Wait for the new window (extension popup) to appear
        await driver.sleep(2000); // Adjust as necessary

        // Get the handles of all open windows
        let handles = await driver.getAllWindowHandles();

        // Switch to the new window (extension popup)
        await driver.switchTo().window(handles[1]);

        // Get the URL of the popup window
        let popupUrl = await driver.getCurrentUrl();
        console.log('Popup URL:', popupUrl);

        // Perform any other interactions with the popup if needed

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await driver.quit();
    }
}

let extensionId = '61226D48935CDD5228BEE60134E1ABFE'; // Replace with your extension ID
getExtensionPopupUrl(extensionId).catch(console.error);
