const { Builder, By } = require("selenium-webdriver");
// require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { firebaseget } = require("../database/firebaseget");
const { getAccessToken } = require("../database/getAccessToken");
const constants = require("../config/constants");
const { productStatus } = require("../config/const");
const { exit } = require("process");
const fs = require("fs").promises;

async function getSpeedDeals(driver, len = 0, data = {}) {
  try {
    // Data is now passed as parameters instead of calling firebaseget() multiple times
    if(len==0){
        console.log("Unable to fetch the length of DB")
        exit();
    }
    let env = constants.env;

    let access_token = await getAccessToken(env);
    // let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

    //chrome
    // let options = await new chrome.Options();
    // options.debuggerAddress("localhost:9222");
    // //CHROME
    // driver = await chrome.Driver.createSession(options);
    
    const date = new Date();


    try {
      const inputData = await readJsonFile(jsonFilePath);
      const messages = inputData.messages;
      let text = "";
      let link = "";
      let isProductPosted = "";

      for (let message of messages) {
        text = ""
        isProductPosted = false
        if (message && message.text_entities) {
          for (let entity of message.text_entities) {
            if (entity.type === "link") {
              link = entity.text; // Assign link to a string variable
            } else {
              text += entity.text + " "; // Append other text
            }
          }
          isProductPosted = await getProductDetails(driver,link, text, len, access_token);
          console.log("-=-=-=-=-=-=-=-=-=-=-> Is product Posted in speed deals: ",isProductPosted)
          if(isProductPosted === productStatus.PRODUCT_CREATED){
            len+=1
          } else if(isProductPosted === productStatus.PRODUCT_EXCLUDED) {
            console.log("Excluded product detected - not eligible for Amazon Associates Program");
          }
        }

        // Log the link and the full text (excluding the link)
        // console.log("Link:", link);
        // console.log("Text:", text.trim()); // Trim to remove any leading/trailing whitespace

        // Example for further processing
        // if (link) {
        //     await driver.get(link);
        //     // Further processing logic here
        // }
      }
    } catch (error) {
      console.error("Error processing links:", error);
    }
  } catch (e) {console.log("Error in Telegram",e);}
}

// Example function to extract details from a page
// async function extractDetailsFromPage(driver) {
//     // Implement details extraction logic here
//     // Example: const title = await driver.findElement(By.tagName("h1")).getText();
// }

// Replace 'your_json_file_path.json' with the actual path to your JSON file

module.exports = {
  getSpeedDeals,
};
