// extractLinksAndText - for bot
// extractTextAndLinks - for Telegram

const { Builder, By } = require("selenium-webdriver");
require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const { getProductDetails } = require("../scheduler");
const { firebaseget } = require("../database/firebaseget");
const constants = require("../config/constants");
const { productStatus, storeMap, searchStatus } = require("../config/const");
const { initializeBot, processMessagesQueue, getNewBotMessages } = require("./autoTelegramAll");
const { getModuleLogger } = require("../logger/logger");
const { scrapePage, loadConfig } = require("../pageScheduler");
const { getformattedDate, extractLinksAndText } = require("../utils/commonUtils");
// const fs = require("fs").promises;

const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('telegram');

let len = null;
let jsonData = null;
let todayJsonData = null;

// File path for saving "Hold" products
const holdProductsFilePath = path.join(__dirname, 'scrappers', 'holdProducts.json');

// Global variable to hold unprocessed products
let holdProducts = [];

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
async function processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct = true, username) {
  let isProductPosted = await getProductDetails(driver, link, text, len, accessToken, jsonData, todayJsonData, postProduct, username);
  if (isProductPosted === productStatus.PRODUCT_CREATED) {
    len += 1;
  } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
    logger.warn(`Missed link: ${link}`, { functionName: 'processProduct' });
  }
}

// Handles product processing flow, including getCode check and fallback function
async function handleProductProcessing(driver, link, text, len, accessToken, jsonData, todayJsonData, username) {
  let products = [];
  try {

    await driver.get(link);
    link = await driver.getCurrentUrl();
    const storeKey = Object.keys(storeMap).find(key => link.includes(key));
    const { getCode, storeType } = storeMap[storeKey];
    productCode = getCode(link);
    // const productCode = await storeMap.getCode(link);

    if (productCode) {
      // logger.info("Product code found, proceeding with normal flow", { functionName: 'handleProductProcessing' });
      await processProduct(driver, link, text, len, accessToken, jsonData, todayJsonData,true, username);
    } else {
      // logger.info("No product code found, calling fallback function", { functionName: 'handleProductProcessing' });


      try {
        // Load configuration for the specified platform
        const platform = Object.keys(storeMap).find(key => link.includes(key));
        const pageType = 'searchPage';
        const config = await loadConfig(`./PageConfig/${platform}PageConfig.js`);

        // Call the scrapePage function with the loaded configuration
        products = await scrapePage(link, driver, config, pageType);

        console.log("Extracted Products:", products);
      } catch (error) {
        console.error("Error during scraping:", error);
      }

      // const fallbackData = await scrapePage(); // Assumes this function returns array of objects

      // for (const data of products) {
      try {
        for (let i = 0; i < products?.length; i++) {
          const product = products[i];
          if (i < 3) {
            // Process first 3 products with `productpost = true`
            await driver.get(product?.productUrl);
            await processProduct(driver, product?.productUrl, product.name, len, accessToken, jsonData, todayJsonData, true, username);
          } else if (i < 10) {
            // Process next 7 products with `productpost = false`
            await driver.get(product?.productUrl);
            await processProduct(driver, product?.productUrl, product.name, len, accessToken, jsonData, todayJsonData, false, username);
          } else {
            // Remaining products - Add to holdProducts
            // Add all remaining products (from index 10 onwards) to holdProducts at once
            holdProducts.push(...products.slice(10));
            console.log('Added remaining products to hold');
            break;  // Exit the loop since all remaining products are processed
          }
        }
      } catch (error) {
        console.error('Error in processProducts:', error.message);
        // } finally {
        //   // Save the holdProducts to file
        //   try {
        //     fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2));
        //     console.log('Hold products saved to file.');
        //   } catch (error) {
        //     console.error('Error saving holdProducts to file:', error.message);
        //   }
      }
      return searchStatus.SEARCH_CREATED
    }
  } catch (e) {
    console.log("Handle Product Processing Error ", e);
    return searchStatus.SEARCH_ERROR

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
  // finally {
  //   //   // Save the holdProducts to file
  //     try {
  //       fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2));
  //       console.log('Hold products saved to file.');
  //     } catch (error) {
  //       console.error('Error saving holdProducts to file:', error.message);
  //     }
  //   }
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

async function loadHoldProducts() {
  try {
    if (fs.existsSync(holdProductsFilePath)) {
      const data = fs.readFileSync(holdProductsFilePath, 'utf-8');
      holdProducts = JSON.parse(data);
      console.log('Loaded held products from file.');
    } else {
      console.log('No existing hold products file found.');
    }
  } catch (error) {
    console.error('Error reading hold products file:', error.message);
  }
}

// Save held products to JSON file
function saveHoldProducts() {
  try {
    fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2), 'utf-8');
    console.log('Saved hold products to file.');
  } catch (error) {
    console.error('Error saving hold products file:', error.message);
  }
}

async function processHoldProducts(driver, len, accessToken, jsonData, todayJsonData) {
  if (holdProducts.length === 0) {
    await loadHoldProducts(); // Load products from file if the array is empty
  }

  if (holdProducts.length > 0) {
    const product = holdProducts.shift(); // Remove the first product
    try {
      await driver.get(product?.productUrl);
      await processProduct(driver, product?.productUrl, product?.name || product?.urltext, len, accessToken, jsonData, todayJsonData, false);
      console.log(`Processed held product: ${product.name}`);
    } catch (error) {
      console.error('Error processing held product:', product.name, error.message);
      holdProducts.push(product); // Re-add product if processing fails
    }
  }

  // Save updated holdProducts to file
  // try {
  //   fs.writeFileSync(holdProductsFilePath, JSON.stringify(holdProducts, null, 2));
  //   console.log('Updated hold products saved to file.');
  // } catch (error) {
  //   console.error('Error saving updated holdProducts to file:', error.message);
  // }
}

// Processes messages from the bot's queue
async function processBotMessages(driver, len, accessToken, jsonData, todayJsonData) {
  let missedSearchLinks;
  // Fetch new bot messages
  try {

    let messagesToProcess = [];
    // messagesToProcess = await processMessagesQueue();

    messagesToProcess = await getNewBotMessages();

    if (messagesToProcess.length === 0) {

      logger.info("No new bot messages to process", { functionName: 'processBotMessages' });
      await processHoldProducts(driver, len, accessToken, jsonData, todayJsonData)
      return;
    }

    // Process each message from the queue

    for (const message of messagesToProcess) {
      const { link, plainText, username } = message;

      // Check if 'link' is an array
      if (Array.isArray(link)) {
        for (const indilink of link) {
          value = await handleProductProcessing(driver, indilink, plainText, len, accessToken, jsonData, todayJsonData, username);
          if (value == searchStatus.SEARCH_ERROR) {
            //missed search links logic
            missedSearchLinks += link + "\n";
          } else if (value == productStatus.PRODUCT_ERROR) {
            //missed product links logic
            missedLinks += link + "\n";

          }
          messagesToProcess.shift();
        }
      } else if (typeof link === 'string') {
        // Handle case where 'link' is a single string
        value = await handleProductProcessing(driver, link, plainText, len, accessToken, jsonData, todayJsonData, username);
        if (value == searchStatus.SEARCH_ERROR) {
          //missed search links logic
          missedSearchLinks += link + "\n";

        } else if (value == productStatus.PRODUCT_ERROR) {
          //missed product links logic
          missedLinks += link + "\n";
        }
        messagesToProcess.shift();
      } else {
        // Log an error if the link is not valid
        logger.error("Invalid link format in message", { functionName: 'processMessages', link });
      }


    }
    messagesToProcess = [];
  } catch (e) {
    console.log("ProcessBotMessage error ", e);
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
    saveHoldProducts();
    logger.info("Completed Telegram deal link processing", { functionName: 'getTelegramDealLink' });
    console.log("missedLinks are ", missedLinks);
    console.log("\n");
    console.log("missedSearchLinks are ", missedSearchLinks);
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

module.exports = { getTelegramDealLink, handleProductProcessing, continuouslyProcessBotMessages };
