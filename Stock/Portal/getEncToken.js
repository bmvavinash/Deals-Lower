const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function getEncToken() {
    let driver;
    try {
        let options = new chrome.Options();
        options.debuggerAddress("localhost:9222");

        // Initialize Chrome driver
        driver = await chrome.Driver.createSession(options);

        // Enable Network tracking via DevTools
        const devToolsSession = await driver.createCDPConnection('page');
        await driver.sendDevToolsCommand('Network.enable');

        console.log("Connected to Chrome DevTools.");

        let encToken = null;

        // Set up a listener for network responses
        await driver.on('Network.responseReceived', async (params) => {
            const response = params.response;
            const url = response.url;
            if (url.includes('/holdings')) {
                console.log(`Captured response from: ${url}`);

                const headers = response.headers;
                console.log("Headers are:", headers);

                // Retrieve Authorization token from headers
                encToken = headers['Authorization'] || headers['authorization'];
                if (encToken) {
                    console.log("ENC Token found:", encToken);
                } else {
                    console.log("ENC Token not found in headers.");
                }
            }
        });

        // Navigate to the URL
        console.log("Navigating to https://kite.zerodha.com/holdings...");
        await driver.get('https://kite.zerodha.com/holdings');

        // Wait for the token to be captured (set a timeout)
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds delay to capture the token

        if (!encToken) {
            console.log("Failed to capture the ENC Token.");
        }

        // Close the browser
        await driver.quit();
        console.log("Browser closed.");
    } catch (error) {
        console.error("An error occurred:", error);
        if (driver) {
            await driver.quit(); // Ensure the browser closes in case of an error
        }
    }
}

getEncToken();
