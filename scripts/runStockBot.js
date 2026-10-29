const { initStockTelegramBot } = require('../services/stockTelegramBot');
const { generateBestInsights } = require('../services/stockInsightsAggregator');

console.log('🤖 Starting Stock Telegram Ingestion & Doubt Resolution Bot...');

const bot = initStockTelegramBot();

if (bot) {
  console.log('✅ Stock Telegram Bot is now running and polling for messages.');
  console.log('• Forward trade calls directly to the bot or chat.');
  console.log('• Unmapped tickers will prompt a doubt question on Telegram.');
  console.log('• Reply to any doubt question to confirm the ticker in the database.');
  console.log('• Commands: /insights, /signals, /doubts, /resolve [ID] [SYMBOL]');

  // Initial insight generation
  generateBestInsights()
    .then(ins => console.log(`📊 Initial Insights Generated: ${ins.length} active opportunities.`))
    .catch(err => console.warn('Insights error:', err.message));
} else {
  console.error('❌ Could not start Stock Telegram Bot. Check bot token in config.');
}
