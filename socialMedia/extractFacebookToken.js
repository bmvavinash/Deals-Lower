const { Builder, By, until, Key } = require('selenium-webdriver');

async function extractFacebookToken(driver) {
    const url = 'https://developers.facebook.com/tools/explorer/';
    const userTokenButtonSelector = 'button._271k._1qjd._ai7j._ai7k._ai7m';
    const continueButtonText = 'Continue as Bmv Avinash'; // Adjust if your name appears differently
    const tokenInputSelector = 'input._4b7k._4b7k_big._53rs';

    try {
        await driver.get(url);
        console.log(`Navigated to ${url}`);

        // Ensure "User Token" button is interactable
        // let userTokenButton = await driver.wait(
        //     until.elementLocated(By.css(userTokenButtonSelector)),
        //     7000
        // );
        // await driver.wait(until.elementIsVisible(userTokenButton), 7000);
        // await driver.executeScript('arguments[0].click();', userTokenButton); // JS click
        // console.log('User Token button clicked (via JS).');

        // await driver.sleep(1500); // Allow modal to load

        // // Look for "Continue as ..." button inside the modal
        // const continueBtn = await driver.wait(
        //     until.elementLocated(By.xpath(`//span[contains(text(), '${continueButtonText}')]`)),
        //     7000
        // );
        // await driver.executeScript('arguments[0].click();', continueBtn);
        // console.log(`Clicked "${continueButtonText}" in modal.`);



        // Wait for token to load in input field
        const tokenInput = await driver.wait(
            until.elementLocated(By.css(tokenInputSelector)),
            7000
        );
        await driver.wait(until.elementIsVisible(tokenInput), 7000);
        const accessToken = await tokenInput.getAttribute('value');
        console.log('Access Token extracted:', accessToken);

        return accessToken;
    } catch (error) {
        console.error('Error in extractFacebookToken:', error);
        throw error;
    }
}

module.exports = extractFacebookToken;
