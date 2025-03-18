const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { TelegramBotKey } = require('../config/constants');

// Replace this with your bot token
const MY_BOT_TOKEN = TelegramBotKey;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(MY_BOT_TOKEN, { polling: true });

// Function to get updates from the bot
async function getUpdates() {
    try {
        const updates = await bot.getUpdates();
        console.log('Received updates:', updates);
        return updates;
    } catch (error) {
        console.error('Error getting updates:', error.message);
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

    // Send the message to the target bot
    const targetBotResponse = await sendMessageToTargetBot(targetBotUsername, userMessage);

    if (targetBotResponse) {
        // Read the response from the target bot
        console.log('Target bot response:', targetBotResponse.text);
        bot.sendMessage(chatId, `Target bot response: ${targetBotResponse.text}`);
    } else {
        console.log('Failed to get a response from the target bot.');
        bot.sendMessage(chatId, 'Failed to get a response from the target bot.');
    }
});

// Function to send a message to the target bot
async function sendMessageToTargetBot(targetBotUsername, text) {
    try {
        console.log(`Sending message to ${targetBotUsername}: ${text}`);
        const response = await bot.sendMessage(targetBotUsername, text);
        console.log('Message sent successfully:', response);
        return response;
    } catch (error) {
        console.error('Error sending message to target bot:', error.message);
        return null;
    }
}

// Error handling
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.message}`);
});

// Periodically fetch updates
setInterval(async () => {
    const updates = await getUpdates();
    if (updates && updates.length > 0) {
        updates.forEach((update) => {
            const message = update.message;
            if (message && message.text) {
                console.log('New message:', message.text);
                // Process the message here
            }
        });
    }
}, 5000);  // Adjust the interval as needed
