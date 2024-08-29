const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace these with your bot tokens
const MY_BOT_TOKEN = '';
const TARGET_BOT_TOKEN = 'TARGET_BOT_TOKEN';
const TARGET_BOT_USERNAME = '@target_bot_username';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(MY_BOT_TOKEN, { polling: true });

// Function to forward message to the target bot
async function forwardToTargetBot(text) {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${TARGET_BOT_TOKEN}/sendMessage`, {
            chat_id: TARGET_BOT_USERNAME,
            text: text
        });
        return response.data;
    } catch (error) {
        console.error('Error forwarding message:', error);
        return null;
    }
}

// Start command handler
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Hello! I can communicate with another bot for you. Send me a message and I will forward it.');
});

// Message handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    if (userMessage.startsWith('/start')) {
        return;
    }

    const targetBotResponse = await forwardToTargetBot(userMessage);

    if (targetBotResponse && targetBotResponse.ok) {
        bot.sendMessage(chatId, `Target bot response: ${targetBotResponse.result.text}`);
    } else {
        bot.sendMessage(chatId, 'Failed to get a response from the target bot.');
    }
});
