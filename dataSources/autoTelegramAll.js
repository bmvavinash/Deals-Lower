const TelegramBot = require('node-telegram-bot-api');
const constants = require('../config/constants');
const { getProductDetails } = require('../scheduler');
const { extractLinksAndText } = require('../utils/commonUtils');
const { text } = require('input');
const { productStatus } = require('../config/const');
// const { getTelegramDealLink } = require('./telegram');
// const { getTelegramDealLink } = require('../scheduler'); // Add other required functions

let bot;
const messagesQueue = []; // Global array to store messages with links and text

// Function to initialize the bot and set up listeners
// async function initializeBot(driver) {
async function initializeBot() {
    // bot = new TelegramBot(constants.DealsGlobalBotKey, { polling: true });
    try{

        bot = new TelegramBot(constants.TelegramBotKey, { polling: true });
        let links = [];
        let text = "";
        
        bot.on('channel_post', async (post) => {
        await processBotMessage(post);
        // await processBotMessage(post?.caption || post?.text);
        // await processBotMessage(driver,post.caption);
        // await processAndQueue(post);
        // links,text = await processAndCheck(post);
        // links,text = await processAndCheck(driver, post);
    });
    
    bot.on('edited_channel_post', async (editedPost) => {
        await processBotMessage(editedPost.caption);
        // await processBotMessage(driver,editedPost.caption);
        // await processAndQueue(editedPost);
        // links,text = await processAndCheck(editedPost);
        // links,text = await processAndCheck(driver, editedPost);
    });
    
    console.log('Bot initialized and listening for messages.');
} catch(e) {
    console.log("Polling or initialize Bot Error: ",e)
}
    // return {links,text};
}

async function getNewBotMessages() {

    const messagesToProcess = messagesQueue;
    messagesQueue.length = 0; // Clear the queue after copying


    messagesQueue.length = 0;
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([...messagesToProcess]); 
        // setTimeout(async () => {
            // Fetch any new messages the bot has captured
            // const newMessages = await processBotMessage();
            // resolve(newMessages);
        }, 5000); // Wait for 5 seconds before each check
    });
}


// Function to process posts and trigger getProductDetails if links are present
async function processBotMessage(post) {
// async function processBotMessage(driver={}, post) {
// async function processAndQueue(post) {
// async function processAndCheck(driver, post) {
// async function processAndCheck(post) {
    const { skip, links, plainText } = extractLinksAndText(post?.caption || post?.text);
    // const { skip, links, plainText } = extractLinksAndText(post.caption);
    const username = post?.chat?.username;
    
    if (skip) {
        console.log("No links found. Skipping further processing.");
        return;  // Exit if no links are found
    }

    console.log('Links:', links);
    console.log('Text:', plainText);

    // Store each message as an object in the queue
    links.forEach(link => {
        messagesQueue.push({ link, plainText, username });
    });
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

module.exports = { initializeBot, continuousProcess, getNewBotMessages, processBotMessage, processMessagesQueue };

// module.exports = { initializeBot, processPost };
