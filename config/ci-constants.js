// CI environment overrides
// In CI, all secrets come from environment variables, not from local files

const constants = require('./constants');

if (!process.env.TELEGRAM_BOT_KEY) {
  throw new Error("TELEGRAM_BOT_KEY environment variable must be set in CI");
}

module.exports = {
  ...constants,
  pathToFile: null,
  TelegramBotKey: process.env.TELEGRAM_BOT_KEY,
  DealsGlobalBotKey: process.env.DEALS_GLOBAL_BOT_KEY,
  FirebaseApiKey: process.env.FIREBASE_API_KEY
};
