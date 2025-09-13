const { Builder, By } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { firebaseget } = require("../database/firebaseget");
const { getAccessToken } = require("../database/getAccessToken");
const constants = require("../config/constants");
const { exit } = require("process");
const { getformattedDate } = require("../utils/commonUtils");
const { productStatus } = require("../config/const");
const fs = require('fs');
const { createInterface } = require("readline");
const { handleProductProcessing } = require("./handleProductProcessing");

// const fs = require("fs").promises;


async function readUrlsFromTxt(driver, len = 0, jsondata = {}, todayjsondata = {}) {
    let missedLinks = "";
    try {
        // Data is now passed as parameters instead of calling firebaseget() multiple times
        let env = constants.env;
        if (len == 0) {
            console.log("Unable to fetch the length of DB")
            exit();
        }

        let access_token = "";
        // await getAccessToken(env);
        // let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

        //chrome
        // let options = await new chrome.Options();
        // options.debuggerAddress("localhost:9222");
        // //CHROME
        // driver = await chrome.Driver.createSession(options);
        let text="";
        let formattedDate = getformattedDate();
        const jsonFilePath = `C:/Users/avina/AppData/Roaming/Telegram Desktop/tdata/tdummy/tr9 deals/ChatExport_${formattedDate}/result.json`;
        const filePath = 'F:/Study/Affiliate/selenium/Deals Optimised/DealsOptimised/scrappers/url.txt';

        try {
            // Function to read URLs from a text file and process them
            // async function readUrlsFromTxt(filePath, processUrl) {
            try {
                const fileStream = fs.createReadStream(filePath);

                // Create a readline interface to process the file line by line
                const rl = createInterface({
                    input: fileStream,
                    crlfDelay: Infinity, // Recognize all instances of CR LF as a single line break
                });

                for await (const line of rl) {
                    // Call the function to process each URL
                    // await getProductDetails(driver, line.trim());
                    let link = line.trim();
                    isProductPosted = await handleProductProcessing(driver, link, text, len, access_token, jsondata, todayjsondata);
                    // isProductPosted = await getProductDetails(driver, link, text, len, access_token, jsondata, todayjsondata);

                    // #ToDo: Handling missing links can be avoided
                    console.log("-=-=-=-=-=-=-=-=-=-=-> Is product Posted in telegram: ", isProductPosted)
                    if (isProductPosted == productStatus.PRODUCT_CREATED) {
                        len += 1
                    } else if (isProductPosted == productStatus.PRODUCT_ERROR) {
                        missedLinks += link + "\n"
                    } else if (isProductPosted == productStatus.PRODUCT_EXCLUDED) {
                        console.log("Excluded product detected - not eligible for Amazon Associates Program");
                    }
                }
            } catch (e) {
                console.error("Error reading the file:", e);
            }
            // }

        } catch (error) {
            console.error("Error processing links:", error);
        }
    } catch (e) { console.log("Error in Telegram", e); }
    finally {
        console.log(" Missed Links are ", missedLinks);
        console.log("\nreturning")
        return null;
    }
}
module.exports = {
    readUrlsFromTxt,
};
