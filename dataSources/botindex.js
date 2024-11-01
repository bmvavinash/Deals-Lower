// index.js
const { bot, onChannelPost, onEditedChannelPost } = require('./bot');

// Your other code in index.js...

// Registering a callback for new channel posts
onChannelPost((post) => {
    console.log('Handling channel post in index.js:', post);
    // Add your logic to handle the post here
});

// Registering a callback for edited channel posts
onEditedChannelPost((editedPost) => {
    console.log('Handling edited channel post in index.js:', editedPost);
    // Add your logic to handle the edited post here
});

// Optionally, you can use the bot instance directly to send messages or interact with Telegram API
// Example: sending a message using the bot
bot.sendMessage(constants.MyChatId, 'Bot is running and listening to channel posts!');
