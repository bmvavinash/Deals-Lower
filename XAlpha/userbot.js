const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace this with your bot token
const MY_BOT_TOKEN = '5759815900:AAFKWE5cmFlmIkDUlzXT_-4sqIT2NQix3Ws';
const TARGET_BOT_USERNAME = '@bonercto';
// const TARGET_BOT_USERNAME = '@Xalpha_bot';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(MY_BOT_TOKEN, { polling: true });

// Function to send message to the target bot
async function sendMessageToTargetBot(targetBotUsername, text) {
// async function sendMessageToTargetBot(userId, text) {
    try {
        
        console.log(`Sending message to ${targetBotUsername}: ${text}`);
        const response = await bot.sendMessage(targetBotUsername, text);
        console.log('Message sent successfully:', response);
        // const response = await bot.sendMessage(TARGET_BOT_USERNAME, text);
        return response;
    } catch (error) {
        console.error('Error sending message to target bot:', error.message);
        return null;
    }
}

// Start command handler
bot.onText(/\/start/, (msg) => {
    console.log('Received /start command');
    bot.sendMessage(msg.chat.id, 'Hello! I can communicate with another bot for you. Send me a message and I will forward it.');
});

// Message handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    console.log('Received message:', userMessage);

    if (userMessage.startsWith('/start')) {
        return;
    }

    // Define the target bot username
    const targetBotUsername = '@bonercto';  // Replace with the actual username of the target bot
    // const targetBotUsername = '@Xalpha_bot';  // Replace with the actual username of the target bot

    // Send the message to the target bot
    const targetBotResponse = await sendMessageToTargetBot(targetBotUsername, userMessage);
    // const targetBotResponse = await sendMessageToTargetBot(chatId, userMessage);

    if (targetBotResponse) {
        // Read the response from the target bot
        console.log('Target bot response:', targetBotResponse.text);
        bot.sendMessage(chatId, `Target bot response: ${targetBotResponse.text}`);
    } else {
        console.log('Failed to get a response from the target bot.');
        bot.sendMessage(chatId, 'Failed to get a response from the target bot.');
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.message}`);
});
