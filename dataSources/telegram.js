const { Builder, By } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { firebaseget } = require("../database/firebaseget");
const { getAccessToken } = require("../database/getAccessToken");
const constants = require("../config/constants");
const { exit } = require("process");
const fs = require("fs").promises;

async function readJsonFile(filePath) {
    try{

        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data);
    }
    catch(e){

    }
}

async function getTelegramDealLink(driver) {
  let missedLinks = "";
  try {
    let len;
    let result = await firebaseget();
    let todayresult = await firebaseget(true);
    if(len==0){
      
      result = await firebaseget();
      if(len==0){
        console.log("Unable to fetch the length of DB")
        exit();
      }
    }
    len = result.len;
    let jsondata = result.data;
    let env = constants.env;

    let access_token = await getAccessToken(env);
    // let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

    //chrome
    let options = await new chrome.Options();
    options.debuggerAddress("localhost:9222");
    //CHROME
    driver = await chrome.Driver.createSession(options);
    // driver = await chrome.Driver.createSession();

    const date = new Date();

    // Get the year, month, and day from the date object
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed, add 1 to get the correct month
    const day = String(date.getDate()).padStart(2, "0");

    // Format the date as YYYY-MM-DD
    const formattedDate = `${year}-${month}-${day}`;

    // const jsonFilePath = `C:/Users/Dell/Downloads/Telegram Desktop/ChatExport_${formattedDate}/result.json`;
    // const jsonFilePath = `C:/Users/avina/Downloads/Telegram Desktop/ChatExport_${formattedDate}/result.json`;
    const jsonFilePath = `C:/Users/avina/AppData/Roaming/Telegram Desktop/tdata/tdummy/tr9 deals/ChatExport_${formattedDate}/result.json`;

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
          isProductPosted = await getProductDetails(link, text, len, access_token, driver, jsondata);
          console.log("-=-=-=-=-=-=-=-=-=-=-> Is product Posted in telegram: ",isProductPosted)
          if(isProductPosted){
            len+=1
          } else {
            missedLinks += link + "\n"
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
  finally{
    console.log(" Missed Links are ",missedLinks)
  }
}

// Example function to extract details from a page
// async function extractDetailsFromPage(driver) {
//     // Implement details extraction logic here
//     // Example: const title = await driver.findElement(By.tagName("h1")).getText();
// }

// Replace 'your_json_file_path.json' with the actual path to your JSON file

module.exports = {
  getTelegramDealLink,
};
