// extractLinksAndText - for bot
// extractTextAndLinks - for Telegram

const { Builder, By } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { firebaseget } = require("../database/firebaseget");
const constants = require("../config/constants");
const { productStatus, storeMap } = require("../config/const");
const { initializeBot, processMessagesQueue, getNewBotMessages } = require("./autoTelegramAll");
const { getModuleLogger } = require("../logger/logger");
const { scrapePage, loadConfig } = require("../pageScheduler");
const { getformattedDate, extractLinksAndText } = require("../utils/commonUtils");
const fs = require("fs").promises;

const logger = getModuleLogger('telegram');

let len = null;
let jsonData = null;
let todayJsonData = null;

// Reads JSON file and parses the content
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (e) {
    logger.error("Error reading JSON file", { functionName: 'readJsonFile', error: e });
    return null;
  }
}

// Processes a single product and logs missed links if necessary
async function processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData) {
  let isProductPosted = await getProductDetails(driver, link, text, len, accessToken, jsonData, todayJsonData);
  if (isProductPosted === productStatus.PRODUCT_CREATED) {
    len += 1;
  } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
    logger.warn(`Missed link: ${link}`, { functionName: 'processProduct' });
  }
}

// Handles product processing flow, including getCode check and fallback function
async function handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData) {
  try {

    await driver.get(link);
    link = await driver.getCurrentUrl();
    const storeKey = Object.keys(storeMap).find(key => link.includes(key));
    const { getCode, storeType } = storeMap[storeKey];
    productCode = getCode(link);
    // const productCode = await storeMap.getCode(link);

    if (productCode) {
      logger.info("Product code found, proceeding with normal flow", { functionName: 'handleProductProcessing' });
      await processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData);
    } else {
      logger.info("No product code found, calling fallback function", { functionName: 'handleProductProcessing' });


      try {
        // Load configuration for the specified platform
        const platform = Object.keys(storeMap).find(key => link.includes(key));
        const pageType = 'searchPage';
        const config = await loadConfig(`./PageConfig/${platform}PageConfig.js`);

        // Call the scrapePage function with the loaded configuration
        const products = await scrapePage(link, driver, config, pageType);

        console.log("Extracted Products:", products);
      } catch (error) {
        console.error("Error during scraping:", error);
      }

      // const fallbackData = await scrapePage(); // Assumes this function returns array of objects

      for (const data of products) {
        await processProduct(driver, data.link, data.text || text, len, accessToken, jsonData, todayJsonData);
      }
    }
  } catch (e) {
    console.log("Handle Product Processing Error ",e);
  }

}

// Processes JSON messages one by one and alternates to bot message processing after each JSON message
async function processJsonAndBotMessages(driver, jsonMessages, len, accessToken, jsonData, todayJsonData) {
  try {
    // Process JSON messages if present
    if (jsonMessages.length > 0) {
      logger.info("Starting JSON message processing", { functionName: 'processJsonAndBotMessages' });

      for (let i = 0; i < jsonMessages.length; i++) {
        const message = jsonMessages[i];
        logger.info(`Processing JSON message #${i + 1}`, { functionName: 'processJsonAndBotMessages' });

        const { text, links } = extractTextAndLinks(message);
        for (const link of links) {
          await handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData);
          // messagesQueue.shift();
        }

        // Process bot messages after each JSON message
        await processBotMessages(driver, len, accessToken, jsonData, todayJsonData);
      }

      logger.info("Completed JSON message processing", { functionName: 'processJsonAndBotMessages' });
    } else {
      logger.info("No JSON messages found. Skipping JSON processing.", { functionName: 'processJsonAndBotMessages' });
    }

    // Move to continuous bot message processing
    await continuouslyProcessBotMessages(driver, len, accessToken, jsonData, todayJsonData);
  } catch (error) {
    logger.error("Error in processJsonAndBotMessages", { functionName: 'processJsonAndBotMessages', error });
  }
}

// Extracts text and links from a message
function extractTextAndLinks(message) {
  let text = "";
  const links = [];
  if (message && message.text_entities) {
    message.text_entities.forEach(entity => {
      if (entity.type === "link") {
        links.push(entity.text);
      } else {
        text += `${entity.text} `;
      }
    });
  }
  return { text: text.trim(), links };
}

// Processes messages from the bot's queue
async function processBotMessages(driver, len, accessToken, jsonData, todayJsonData) {
  // Fetch new bot messages
  try {

    let messagesToProcess = [];
    // messagesToProcess = await processMessagesQueue();

    messagesToProcess = await getNewBotMessages();
    
    if (messagesToProcess.length === 0) {
      logger.info("No new bot messages to process", { functionName: 'processBotMessages' });
      return;
    }
    
    // Process each message from the queue
    
    for (const message of messagesToProcess) {
      const { link, plainText } = message;
      
      // Check if 'link' is an array
      if (Array.isArray(link)) {
        for (const indilink of link) {
          await handleProductProcessing(driver, indilink, plainText, len, accessToken, jsonData, todayJsonData);
          messagesToProcess.shift();
        }
      } else if (typeof link === 'string') {
        // Handle case where 'link' is a single string
        await handleProductProcessing(driver, link, plainText, len, accessToken, jsonData, todayJsonData);
        messagesToProcess.shift();
      } else {
        // Log an error if the link is not valid
        logger.error("Invalid link format in message", { functionName: 'processMessages', link });
      }
      
      
    }
    messagesToProcess = [];
  } catch(e) {
    console.log("ProcessBotMessage error ",e);
  }
}


// Main function to get Telegram deal link, sequentially handling JSON and bot messages
async function getTelegramDealLink(driver) {
  try {
    const firebaseData = await firebaseget();
    len = firebaseData.len;
    jsonData = firebaseData.data;

    const todayFirebaseData = await firebaseget(true);
    todayJsonData = todayFirebaseData.data;
    let formattedDate = getformattedDate();
    const jsonFilePath = `C:/Users/avina/AppData/Roaming/Telegram Desktop/tdata/tdummy/tr9 deals/ChatExport_${formattedDate}/result.json`; // Specify the correct path
    const jsonMessages = await readJsonFile(jsonFilePath)?.messages || [];

    await initializeBot();
    await processJsonAndBotMessages(driver, jsonMessages, len, "", jsonData, todayJsonData);
  } catch (error) {
    logger.error("Error in getTelegramDealLink", { functionName: 'getTelegramDealLink', error });
  } finally {
    logger.info("Completed Telegram deal link processing", { functionName: 'getTelegramDealLink' });
  }
}

// Continuously check for new bot messages
async function continuouslyProcessBotMessages(driver, len, accessToken, jsonData, todayJsonData) {
  try {
    logger.info("Starting continuous bot message processing", { functionName: 'continuouslyProcessBotMessages' });

    while (true) {
      await processBotMessages(driver, len, accessToken, jsonData, todayJsonData);

      // Monitor for performance issues (e.g., clear cache if needed)
      if (shouldClearCache()) {
        await clearBrowserCache(driver);
        logger.info("Browser cache cleared for performance optimization", { functionName: 'continuouslyProcessBotMessages' });
      }
    }
  } catch (error) {
    logger.error("Error in continuouslyProcessBotMessages", { functionName: 'continuouslyProcessBotMessages', error });
  }
}

// Placeholder function for clearing browser cache
async function clearBrowserCache(driver) {
  try {
    await driver.executeScript("window.localStorage.clear(); window.sessionStorage.clear();");
    logger.info("Successfully cleared browser cache", { functionName: 'clearBrowserCache' });
  } catch (error) {
    logger.warn("Failed to clear browser cache", { functionName: 'clearBrowserCache', error });
  }
}

// Check if cache clearing is needed (placeholder logic)
function shouldClearCache() {
  // Replace with real logic to detect performance issues
  return false;
}


// Placeholder for fallback function
async function fallbackFunction() {
  // TODO: Implement functionality to fetch fallback data with multiple URLs and attributes
  return []; // Returns array of objects with link, text, and optional attributes like coupon, deal names
}

module.exports = { getTelegramDealLink };
