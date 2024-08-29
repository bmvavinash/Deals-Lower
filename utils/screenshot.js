const { Builder, By, until, Key, Actions } = require('selenium-webdriver');
const fs = require('fs');
const { promisify } = require('util');
const Jimp = require('jimp');  // To crop the screenshot

// Convert fs.writeFile to a promise-based function
const writeFileAsync = promisify(fs.writeFile);

(async function example() {
    let driver = await new Builder().forBrowser('chrome').build();

    try {
        await driver.get('https://example.com');  // Replace with the desired URL

        // Simulate the click-and-drag action
        const actions = driver.actions({ async: true });
        const element = await driver.findElement(By.css('body'));  // Replace with the desired element
        
        await actions
            .move({ origin: element })
            .press()
            .move({ origin: element, x: 200, y: 200 })  // Adjust the x and y values as needed
            .release()
            .perform();

        // Take a full-page screenshot
        const screenshot = await driver.takeScreenshot();
        
        // Save the screenshot as a file
        await writeFileAsync('full-screenshot.png', screenshot, 'base64');

        // Load the image with Jimp to crop it
        const image = await Jimp.read(Buffer.from(screenshot, 'base64'));

        // Crop the image to the desired region (adjust the values as needed)
        const croppedImage = image.crop(50, 50, 200, 200);  // x, y, width, height

        // Save the cropped image
        await croppedImage.writeAsync('cropped-screenshot.png');
    } finally {
        await driver.quit();
    }
})();
