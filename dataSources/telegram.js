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
const { continuousProcess, initializeBot, getNewBotMessages, processBotMessage, processMessagesQueue } = require("./autoTelegramAll");
const { getModuleLogger } = require("../logger/logger");
const fs = require("fs").promises;
const logger = getModuleLogger('telegram');

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading JSON file:", e);
  }
}

async function getTelegramDealLink(driver) {
  let missedLinks = "";
  try {
    let len;
    let result = await firebaseget();
    let todayresult = await firebaseget(true);
    len = result.len;
    let jsondata = result.data;
    let todaylen = todayresult.len;

    let todayjsondata = todayresult.data;
    let env = constants.env;
    if (len == 0) {
      result = await firebaseget();
      if (len == 0) {
        logger.error("Unable to fetch the length of DB", { functionName: 'Telegram' });
        exit();
      }
    }

    let access_token = "";
    // await getAccessToken(env);
    // let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options()).build();

    //chrome
    let options = await new chrome.Options();
    options.debuggerAddress("localhost:9222");
    //CHROME
    driver = await chrome.Driver.createSession(options);

    let formattedDate = getformattedDate();
    // const jsonFilePath = `C:/Users/avina/Downloads/Telegram Desktop/ChatExport_${formattedDate}/result.json`;
    const jsonFilePath = `C:/Users/avina/AppData/Roaming/Telegram Desktop/tdata/tdummy/tr9 deals/ChatExport_${formattedDate}/result.json`;

    try {
      await initializeBot();
      const inputData = await readJsonFile(jsonFilePath);
      const messages = inputData?.messages;

      let text = "";
      let link = "";
      let links = [];
      let isProductPosted = "";
      try {
        // for (let message of messages) {
          for (let i = 0; i < messages?.length; i++) {
            links = []
            const message = messages[i];
          text = "";
          isProductPosted = "";
          logger.info(`Processing Json message #${i + 1}`, { functionName: 'Telegram' });

          if (message && message.text_entities) {
            for (let entity of message.text_entities) {
              if (entity.type === "link") {
                // link = entity.text; // Assign link to a string variable
                links.push(entity.text);
              } else {
                text += entity.text + " "; // Append other text
              }
            }

            // Call getProductDetails for each link
            for (const link of links) {
              isProductPosted = await getProductDetails(driver, link, text, len, access_token, jsondata, todayjsondata);
              logger.info(`-=-=-=-=-=-=-=-=-=-=-> Is product Posted in telegram: ${isProductPosted}`, { functionName: 'getTelegramDealLink(Telegram)' }, )
              if (isProductPosted == productStatus.PRODUCT_CREATED) {
                len += 1
              } else if (isProductPosted == productStatus.PRODUCT_ERROR) {
                missedLinks += link + "\n"
              }

              await new Promise((resolve) => setTimeout(resolve, 5000));

              while (true) {
                // const botMessages = await getNewBotMessages();
                try {
                  // Wait for messages to accumulate in the queue
                  const messagesToProcess = await processMessagesQueue();

                  // Process each message in the returned messages array
                  if (messagesToProcess.length > 0) {
                    logger.info(`Bot Messages in queue ${messagesToProcess.length}`, { functionName: 'getTelegramDealLink(Telegram)' });

                    for (let j = 0; j < messagesToProcess.length; j++) {
                      const message = messagesToProcess[j];
                      logger.info(`Processing Bot message #${j + 1} of ${messagesToProcess.length}`, { functionName: 'getTelegramDealLink(Telegram)' });
                    // for (const message of messagesToProcess) {
                      // link = "";
                      const { link, plainText } = message; // Destructure each message object
                      // let len = 0;
                      // let missedLinks = "";
                      // if(links.length>0) {
                      //   for (const link of links) {
                      isProductPosted = "";
                      isProductPosted = await getProductDetails(driver, link, plainText, len, access_token, jsondata, todayjsondata);
                      if (isProductPosted === productStatus.PRODUCT_CREATED) {
                        len += 1;
                      } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
                        missedLinks += `${link}\n`;
                      }
                      //   }
                      // }

                      // console.log("Total products created:", len);
                      if (missedLinks) {
                        logger.warn(`Missed links: ${missedLinks}`, { functionName: 'getTelegramDealLink(Telegram)' } );
                      }
                    }
                  } else {
                    logger.info("No new bot messages. Returning to JSON processing.", { functionName: 'getTelegramDealLink(Telegram)' });
                    break; // Break out to continue JSON processing
                  }

                  // Wait a bit before checking for new messages again (adjust as needed)
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                } catch (error) {
                  logger.warn(`Error during message processing loop: , ${error}`, { functionName: 'getTelegramDealLink(Telegram)' });
                }
                //Bot Code integration Starts
                // link="";
                // links, text = await continuousProcess(driver);
                // await continuousProcess(driver);
                // links, text = await continuousProcess();
                // links, text = await initializeBot();

                // link = links[0];
                // if(link && link != ""){

                //   isProductPosted = await getProductDetails(driver, link, text, len, access_token, jsondata, todayjsondata);
                //   console.log("-=-=-=-=-=-=-=-=-=-=-> Is product Posted in telegram: ",isProductPosted)
                //   if(isProductPosted == productStatus.PRODUCT_CREATED){
                //     len+=1
                //   } else if(isProductPosted == productStatus.PRODUCT_ERROR){
                //     missedLinks += link + "\n"
                //   }
                // }

              }

              // Log the link and the full text (excluding the link)
              // console.log("Link:", link);
              // console.log("Text:", text.trim()); // Trim to remove any leading/trailing whitespace

              // Example for further processing
              // if (link) {
              //     await driver.get(link);
              //     // Further processing logic here
            }
          }

        }
      } catch (e) {
        logger.warn("Json File Reading Error", { functionName: 'getTelegramDealLink(Telegram)' })
      }

      // # Comment ToDo
      
      // await clearBrowserCache(driver);
      
      // const botMessages = await getNewBotMessages();

      // for (const message of botMessages) {
      //   await processBotMessage(driver, message.caption);
      // }
      while (true) {
        // try {

          // const botMessages = await getNewBotMessages();
          
          // for (const message of botMessages) {
          //   await processBotMessage(driver, message.caption);
          // }
        // } catch(e) {
        //   console.log("Error in bot Messages ",e);
        // }
        try {

          await new Promise((resolve) => setTimeout(resolve, 5000));
          // Wait for messages to accumulate in the queue
          let messagesToProcess = [];
          messagesToProcess = await processMessagesQueue();

          // Process each message in the returned messages array
          if (messagesToProcess.length > 0) {
            for (const message of messagesToProcess) {
              // link = "";
              const { link, plainText } = message; // Destructure each message object
              // let len = 0;
              // let missedLinks = "";
              // if(links.length>0) {
              //   for (const link of links) {
              isProductPosted="";
              isProductPosted = await getProductDetails(driver, link, plainText, len, access_token, jsondata, todayjsondata);
              if (isProductPosted === productStatus.PRODUCT_CREATED) {
                len += 1;
              } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
                missedLinks += `${link}\n`;
              }
              isProductPosted="";
              //   }
              // }

              // console.log("Total products created:", len);
              if (missedLinks) {
                console.log("Missed links:", missedLinks);
              }
            }
          }
        } catch(e) {
          logger.warn(`Error in Telegram ${e}`, { functionName: 'getTelegramDealLink(Telegram)' });
        }





        // const botMessages = await getNewBotMessages();

        // if (botMessages.length > 0) {
        //   for (const message of botMessages) {
        //     await processBotMessage(driver, message.caption);
        //   }
        // } else {
        //   console.log("No new bot messages. Returning to JSON processing.");
        //   break; // Break out to return to JSON message processing
        // }

      }
    } catch (error) {
      console.error("Error processing links:", error);
    }
  } catch (e) { logger.warn(`Error in Telegram ${e}`, { functionName: 'getTelegramDealLink(Telegram)' }); }
  finally {
    logger.warn(` Missed Links are ${missedLinks}`, { functionName: 'getTelegramDealLink(Telegram)' } );
    return null;
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
