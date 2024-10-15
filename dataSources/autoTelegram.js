// works for own channel new messages - dealshubglobal2 new and edited messages
// check two bots as one bot messages cannot be read by another


const TelegramBot = require('node-telegram-bot-api');
// import constants from '../config/constants';
const constants = require('../config/constants')

const bot = new TelegramBot(constants.TelegramBotKey, { polling: true });

bot.on('channel_post', (post) => {
    // TODO: Store channel post
    console.log('Received channel post:', post);
});

bot.on('edited_channel_post', (editedPost) => {
    // TODO: Store edited channel post
    console.log('Received edited channel post:', editedPost);
});
