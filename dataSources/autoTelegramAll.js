const TelegramBot = require('node-telegram-bot-api');
const constants = require('../config/constants');
const { getProductDetails } = require('../scheduler');
const { extractLinksAndText } = require('../utils/commonUtils');
const { text } = require('input');
const { productStatus } = require('../config/const');
const { getModuleLogger } = require('../logger/logger');
// const { getTelegramDealLink } = require('./telegram');
// const { getTelegramDealLink } = require('../scheduler'); // Add other required functions
const { handleProductProcessing } = require('./handleProductProcessing');
const { isDriverSessionValid } = require('../utils/seleniumDriver');


const logger = getModuleLogger('autoTelegramAll');

let bot;
const messagesQueue = []; // Global array to store messages with links and text
let processing = false;
const MAX_CONCURRENT = 2;
let globalDriver = null; // Global driver instance for queue processing
const channelStats = {}; // Track stats per channel

// Function to set the driver for queue processing
function setDriver(driverInstance) {
    globalDriver = driverInstance;
}

// Function to initialize the bot and set up listeners
// async function initializeBot(driver) {
async function initializeBot() {
    // bot = new TelegramBot(constants.DealsGlobalBotKey, { polling: true });
    try {

        // Use global bot instance so listeners stay active
        bot = new TelegramBot(constants.TelegramBotKey, { polling: true });
        console.log('Bot initialized and listening for messages.');
        let links = [];
        let text = "";

        bot.on('channel_post', async (post) => {
            console.log(`[TELEGRAM] Received message from Channel: ${post.chat.title}`);
            console.log(`[TELEGRAM] Message content:`, post.caption || post.text || 'No content');
            console.log(`[TELEGRAM] Message ID:`, post.message_id);
            await processBotMessage(post);
        });

        bot.on('edited_channel_post', async (editedPost) => {
            console.log(`Edited message from Channel: ${editedPost.chat.title}`);
            await processBotMessage(editedPost.caption);
            // await processBotMessage(driver,editedPost.caption);
            // await processAndQueue(editedPost);
            // links,text = await processAndCheck(editedPost);
            // links,text = await processAndCheck(driver, editedPost);
        });

        // Listen for **Group Messages**
        bot.on('message', async (msg) => {
            if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
                console.log(`[TELEGRAM] Received message from Group: ${msg.chat.title}`);
                console.log(`[TELEGRAM] Message content:`, msg.text || msg.caption || 'No content');
                console.log(`[TELEGRAM] Message ID:`, msg.message_id);
                await processBotMessage(msg);
            }
        });

        // Listen for **Edited Messages** in Groups
        bot.on('edited_message', async (editedMsg) => {
            if (editedMsg.chat.type === 'group' || editedMsg.chat.type === 'supergroup') {
                console.log(`Edited message from Group: ${editedMsg.chat.title}`);
                await processBotMessage(editedMsg);
            }
        });

    } catch (e) {
        console.log("Polling or initialize Bot Error: ", e)
    }
    // return {links,text};
}

let pollAttempt = 0;
async function getNewBotMessages() {
    // Snapshot current queue (copy) and clear for next cycle
    const messagesToProcess = [...messagesQueue];
    messagesQueue.length = 0;

    pollAttempt += 1;
    console.log(`[TELEGRAM-POLL] attempt=${pollAttempt} queued=${messagesToProcess.length}`);
    if (messagesToProcess.length === 0) {
        console.log('[TELEGRAM-POLL] no messages in queue this attempt');
    } else {
        console.log(`[TELEGRAM-POLL] processing ${messagesToProcess.length} queued message(s)`);
        messagesToProcess.forEach((msg, idx) => {
            console.log(`[TELEGRAM-POLL] Message ${idx + 1}: ${msg.link}`);
        });
    }

    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`[TELEGRAM-POLL] Resolving ${messagesToProcess.length} messages after 5s delay`);
            resolve([...messagesToProcess]);
        }, 5000); // 5s polling interval
    });
}


// Function to process posts and trigger getProductDetails if links are present
async function processBotMessage(post) {
    console.log(`[TELEGRAM] Processing bot message...`);
    const { skip, links, plainText } = extractLinksAndText(post?.caption || post?.text);
    const username = post?.chat?.username;

    console.log(`[TELEGRAM] Extracted - skip: ${skip}, links: ${links?.length || 0}, text length: ${plainText?.length || 0}`);
    console.log(`[TELEGRAM] Links found:`, links);
    console.log(`[TELEGRAM] Text preview:`, plainText?.substring(0, 100) + (plainText?.length > 100 ? '...' : ''));

    if (skip) {
        console.log("[TELEGRAM] No links found. Skipping further processing.");
        return;  // Exit if no links are found
    }

    logger.info(`Links:, ${links}Text:, ${plainText} Username:, ${username}`, { functionName: 'processBotMessage' });
    console.log("[TELEGRAM] Username found:", username);

    // Store each message as an object in the queue
    const channelName = post.chat?.title || username || 'unknown';
    const generateLink = constants.generateLink === true;
    links.forEach(link => {
        messagesQueue.push({ link, plainText, username, channel: channelName, generateLink });
        console.log(`[TELEGRAM] Added to queue: ${link} (Queue size: ${messagesQueue.length})`);
        
        // Update channel stats
        if (!channelStats[channelName]) {
          channelStats[channelName] = { pending: 0, processing: 0, processed: 0 };
        }
        channelStats[channelName].pending++;
    });

    // Trigger processing immediately if enabled
    if (constants.enableTelegramProcessing) {
        console.log(`[TELEGRAM] Triggering queue processing. Queue size: ${messagesQueue.length}, Driver available: ${!!globalDriver}`);
        kickOffQueueProcessing().catch((e) => {
            console.error('[TELEGRAM] Queue processing failed:', e?.message);
        });
    } else {
        console.log(`[TELEGRAM] Processing disabled via flag`);
    }
}


// return { links, plainText };
// return { driver, links, plainText };

// Pass extracted details to getProductDetails
async function processMessagesQueue() {
    // async function processMessagesQueue(driver) {

    // Copy the current messagesQueue and then clear it
    const messagesToProcess = [...messagesQueue];
    messagesQueue.length = 0; // Clear the queue after copying

    return messagesToProcess;

    // while (messagesQueue.length > 0) {
    //     const message = messagesQueue.shift(); // Get the first item in the queue
    //     const { link, plainText } = message;

    // const isProductPosted = await getProductDetails(driver, link, plainText);
    // if (isProductPosted === productStatus.PRODUCT_CREATED) {
    //     len += 1;
    //     } else if (isProductPosted === productStatus.PRODUCT_ERROR) {
    //     missedLinks += link + "\n";
    //     }
    // }

    // console.log("Total products created:", len);
    // if (missedLinks) {
    //     console.log("Missed links:", missedLinks);
}
// }

async function kickOffQueueProcessing() {
    if (processing) {
        console.log(`[TELEGRAM] Queue processing already in progress, skipping`);
        return;
    }

    const driverReady = await isDriverSessionValid(globalDriver);
    if (!driverReady) {
        console.log('[TELEGRAM] WebDriver not ready — messages stay queued until driver is available');
        return;
    }

    processing = true;
    
    // Get current queue and clear it
    // For LIFO (stack) behavior: reverse the queue so newest items are processed first
    const messagesToProcess = [...messagesQueue].reverse();
    messagesQueue.length = 0;
    
    console.log(`[TELEGRAM] Starting queue processing with ${messagesToProcess.length} messages (LIFO/Stack mode - newest first)`);
    try {
        while (messagesToProcess.length > 0) {
            if (!(await isDriverSessionValid(globalDriver))) {
                console.log('[TELEGRAM] WebDriver became invalid — re-queuing remaining messages');
                messagesToProcess.forEach((msg) => messagesQueue.push(msg));
                break;
            }

            // Process from the beginning (which is now the newest items after reverse)
            const batch = messagesToProcess.splice(0, MAX_CONCURRENT);
            console.log(`[TELEGRAM] Processing batch of ${batch.length} messages (newest first)`);
            await Promise.all(batch.map(async ({ link, plainText, username, generateLink }) => {
                try {
                    console.log(`[TELEGRAM] Processing message: ${link}`);
                    console.log(`[TELEGRAM] Driver available: ${await isDriverSessionValid(globalDriver)}`);
                    console.log(`[TELEGRAM] Generate link: ${generateLink || 'N/A'}`);
                    const result = await handleProductProcessing(globalDriver, link, plainText, 0, '', {}, {}, username || '', generateLink || false);
                    console.log(`[TELEGRAM] Processing result for ${link}:`, result);
                    
                    // Track message progress
                    const { executionTracker } = require('../services/executionTracker');
                    const { searchStatus } = require('../config/const');
                    if (result === searchStatus.SEARCH_CREATED || result === productStatus.PRODUCT_CREATED || result === productStatus.PRODUCT_UPDATED_SUCCESSFULLY) {
                        await executionTracker.updateTelegramMessageProgress('processed');
                    } else {
                        await executionTracker.updateTelegramMessageProgress('failed');
                    }
                } catch (e) {
                    console.error(`[TELEGRAM] handleProductProcessing failed for ${link}:`, e?.message);
                    logger.error('handleProductProcessing failed', { link, error: e?.message });
                    const { executionTracker } = require('../services/executionTracker');
                    await executionTracker.updateTelegramMessageProgress('failed');
                }
            }));
        }
        console.log('[TELEGRAM] Queue processing completed');
    } finally {
        processing = false;
    }
}

// Controller function to manage continuous processing
async function continuousProcess(driver) {
    // async function continuousProcess(driver) {
    // Start the bot for listening to Telegram posts
    // await initializeBot(driver);
    await initializeBot();
    // let links = [], text = "";
    // links,text = await initializeBot(driver);


    setInterval(async () => {
        console.log("Checking for new messages and processing the queue...");
        await processMessagesQueue();
        // await processMessagesQueue(driver);
    }, 10000); // Run every 10 seconds
}


//     while (links.length == 0) {
//         try {
//             // Check for any updates from initializeBot
//             console.log("Checking for Telegram updates...");
//             await new Promise((resolve) => setTimeout(resolve, 5000)); // Interval between checks

//             // Process any other task in parallel if there are no new messages
//             // await getTelegramDealLink();
//             // await getTelegramDealLink(driver);

//         } catch (error) {
//             console.log("Error during continuous processing:", error);
//         }
//         return {links,text};
//     }
// }

// Get queue status for API
function getQueueStatus() {
  const channelStatus = {};
  Object.keys(channelStats).forEach(channel => {
    channelStatus[channel] = { ...channelStats[channel] };
  });
  
  // Count current queue by channel
  messagesQueue.forEach(msg => {
    const channel = msg.channel || 'unknown';
    if (!channelStatus[channel]) {
      channelStatus[channel] = { pending: 0, processing: 0, processed: 0 };
    }
    channelStatus[channel].pending++;
  });
  
  return {
    pending: messagesQueue.length,
    processing: processing ? MAX_CONCURRENT : 0,
    channels: channelStatus
  };
}

module.exports = { initializeBot, continuousProcess, getNewBotMessages, processBotMessage, processMessagesQueue, setDriver, getQueueStatus, kickOffQueueProcessing };

// module.exports = { initializeBot, processPost };
