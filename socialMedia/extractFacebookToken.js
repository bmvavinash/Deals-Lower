const { Builder, By, until } = require('selenium-webdriver');

/**
 * Extract Facebook Access Token from Developer Tools
 * @param {WebDriver} driver - The WebDriver instance used for automation.
 * @returns {Promise<string>} - The extracted access token.
 */
async function extractFacebookToken(driver) {
    const url = 'https://developers.facebook.com/tools/explorer/';
    const userTokenButtonSelector = 'div[data-hover="tooltip"][data-tooltip-display="overflow"]';
    const dealsHubOptionSelector = 'span[data-tooltip-content="Deals Hub Global"]';
    const tokenInputSelector = 'input._4b7k._4b7k_big._53rs';

    try {
        // Navigate to the target URL
        await driver.get(url);
        console.log(`Navigated to ${url}`);

        // Wait for and click the "User Token" button (using the updated selector)
        const userTokenButton = await driver.wait(
            until.elementLocated(By.xpath('//*[@id="facebook"]/body/div[1]/div[5]/div[2]/div/div[2]/span/div/div[2]/div/div[5]/div[5]/div/div/div/div/div/div[7]/div[2]/button/div/div/div/i')),
            // until.elementLocated(By.css(userTokenButtonSelector)),
            5000
        );
        await userTokenButton.click();
        console.log('User Token button clicked.');

        // Wait for and select the "Deals Hub Global" option
        await driver.wait(until.elementLocated(By.css(dealsHubOptionSelector)), 3000);
        const dealsHubOption = await driver.findElement(By.css(dealsHubOptionSelector));
        await dealsHubOption.click();
        console.log('Deals Hub Global option selected.');

        // Wait for and extract the Access Token
        await driver.wait(until.elementLocated(By.css(tokenInputSelector)), 3000);
        const tokenInput = await driver.findElement(By.css(tokenInputSelector));
        const accessToken = await tokenInput.getAttribute('value');
        console.log('Access Token extracted:', accessToken);

        // Return the token
        return accessToken;

    } catch (error) {
        console.error('Error in extractFacebookToken:', error);
        throw error; // Re-throw the error for the caller to handle
    }
}

// Export the function for use in other modules
module.exports = extractFacebookToken ;
