// bot.js
const TelegramBot = require('node-telegram-bot-api');
const constants = require('../config/constants');

// Create the bot instance
const bot = new TelegramBot(constants.TelegramBotKey, { polling: true });

// Function to handle new channel posts
const onChannelPost = (callback) => {
    bot.on('channel_post', (post) => {
        console.log('Received channel post:', post);
        if (callback) {
            callback(post); // Pass the post data to the callback
        }
    });
};

// Function to handle edited channel posts
const onEditedChannelPost = (callback) => {
    bot.on('edited_channel_post', (editedPost) => {
        console.log('Received edited channel post:', editedPost);
        if (callback) {
            callback(editedPost); // Pass the edited post data to the callback
        }
    });
};

// Listen for private messages to help users find their personal Chat ID
bot.on('message', (msg) => {
    if (msg.chat && msg.chat.type === 'private') {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        console.log(`Received private message from ${msg.from?.first_name || 'User'} (chat_id: ${chatId}): ${text}`);
        
        if (text.startsWith('/start') || text.startsWith('/myid') || text.toLowerCase().includes('id')) {
            bot.sendMessage(
                chatId, 
                `👋 Hello ${msg.from?.first_name || 'there'}!\n\nYour personal Telegram Chat ID is:\n<code>${chatId}</code>\n\nUse this ID in your profile settings (e.g. <code>chatId</code> under Telegram preferences) to receive private Price Drop & Stock alerts!`, 
                { parse_mode: 'HTML' }
            ).catch(err => console.error('Failed to send Telegram private ID message:', err.message));
        }
    }
});

// Export the bot and event handlers
module.exports = {
    bot,
    onChannelPost,
    onEditedChannelPost
};
