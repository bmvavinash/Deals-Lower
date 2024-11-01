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

// Export the bot and event handlers
module.exports = {
    bot,
    onChannelPost,
    onEditedChannelPost
};
