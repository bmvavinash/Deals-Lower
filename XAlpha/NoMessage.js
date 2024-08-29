const TelegramBot = require('node-telegram-bot-api');

// Replace this with your bot token
const MY_BOT_TOKEN = '5759815900:AAFKWE5cmFlmIkDUlzXT_-4sqIT2NQix3Ws';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(MY_BOT_TOKEN, { polling: true });

// Function to get updates from the bot
async function getUpdates(offset = 0) {
    try {
        const updates = await bot.getUpdates({ offset });
        console.log('Received updates:', updates);
        return updates;
    } catch (error) {
        console.error('Error getting updates:', error.message);
        return null;
    }
}

// Function to process updates
async function processUpdates() {
    let offset = 0;

    setInterval(async () => {
        const updates = await getUpdates(offset);
        if (updates && updates.length > 0) {
            updates.forEach((update) => {
                const message = update.message;
                if (message && message.text) {
                    console.log('New message:', message.text);
                    // Process the message here
                }
            });

            // Update offset to the latest update_id + 1
            offset = updates[updates.length - 1].update_id + 1;
        }
    }, 5000);  // Adjust the interval as needed
}

// Start processing updates
processUpdates();

// Error handling
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.message}`);
});
