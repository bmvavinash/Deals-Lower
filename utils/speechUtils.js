// const express = require('express');
const say = require('say');
const { Builder, By, until } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");

async function textToSpeech(text, outputFile) {
    return new Promise((resolve, reject) => {
        say.export(text, 'Microsoft David Desktop', 1.0, outputFile, (err) => {
            if (err) {
                console.error('Error in speech synthesis:', err);
                return reject(err);
            }
            console.log(`Text has been spoken and saved to ${outputFile}`);
            resolve();
        });
    });
}


say.getInstalledVoices((err, voices) => {
    if (err) {
        return console.error('Error listing voices:', err);
    }
    console.log('Available voices:', voices);
});


// const app = express();
// const port = 3000;

// Middleware to parse JSON bodies
// app.use(express.json());

// app.post('/speak', (req, res) => {
//     const text = req.body.text;

//     if (!text) {
//         return res.status(400).send('Text is required');
//     }

//     say.speak(text, 'Alex', 1.0, (err) => {
//         if (err) {
//             return res.status(500).send('Error in speech synthesis');
//         }

//         res.send('Text is being spoken');
//     });
// });

// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });

// Integrating your getTwitter function
async function getSpeech() {
    let driver;
    try {
        console.log("Initializing Chrome options...");

        // Set Chrome options
        let options = new chrome.Options();
        options.debuggerAddress("localhost:9222");

        // Create a new driver session
        driver = await chrome.Driver.createSession(options);
        console.log("Chrome session created.");

        // Navigate to Twitter
        await driver.get("https://twitter.com");
        console.log("Navigated to Twitter.");

        // Wait for the notifications element to be located and retrieve its inner HTML
        let notificationElement = await driver.wait(
            until.elementLocated(By.xpath('//*[@id="react-root"]/div/div/div[2]/header/div/div/div/div[1]/div[2]/nav/a[3]/div/div/div/span')),
            10000
        );
        let notifications = await notificationElement.getAttribute("innerHTML");
        console.log("Number of notifications:", notifications);
    } catch (e) {
        console.error("Twitter Error:", e);
    } finally {
        if (driver) {
            await driver.quit();
            console.log("Driver session closed.");
        }
    }
}

// getSpeech();
textToSpeech("hello I am avinash",'./audiocheck')

module.exports = {
    getSpeech,
    textToSpeech
};
