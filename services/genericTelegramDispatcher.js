const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const constants = require('../config/constants');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('genericTelegramDispatcher');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'telegramTopicsConfig.json');

// In-memory bot cache
let botInstance = null;
let lastOutboundTime = 0;
const MIN_DISPATCH_INTERVAL_MS = 1500; // 1.5s between messages to avoid Telegram 429 rate limit

/**
 * Load Telegram topics and channels configuration
 */
function getTelegramConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.warn('Failed to load telegramTopicsConfig.json, using defaults:', { error: err.message });
  }

  return {
    stocks: {
      channelId: process.env.STOCKS_TELEGRAM_CHANNEL_ID || '',
      channelType: 'group_with_topics',
      topics: {
        high_conviction: process.env.STOCKS_TOPIC_HIGH_CONVICTION || null,
        buy_trades: process.env.STOCKS_TOPIC_BUYS || null,
        sell_trades: process.env.STOCKS_TOPIC_SELLS || null,
        daily_insights: process.env.STOCKS_TOPIC_INSIGHTS || null
      },
      batching: { enabled: true, maxItemsPerMessage: 10 },
      alertThresholds: { minRatingForBuyAlert: 3 }
    },
    deals: {
      channelId: '@dealshubglobal',
      channelType: 'channel',
      topics: { electronics: null, fashion: null, amazon: null, flipkart: null, general: null }
    }
  };
}

/**
 * Save updated Telegram topics and channels configuration
 */
function saveTelegramConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
    logger.info('Updated telegramTopicsConfig.json successfully.');
    return true;
  } catch (err) {
    logger.error('Failed to save telegramTopicsConfig.json:', { error: err.message });
    return false;
  }
}

/**
 * Get or initialize Telegram Bot client
 */
function getBot() {
  const botToken = process.env.STOCKS_TELEGRAM_BOT_TOKEN || constants.TelegramBotKey;
  if (!botToken) return null;
  if (!botInstance) {
    try {
      botInstance = new TelegramBot(botToken);
    } catch (e) {
      logger.error('Failed to instantiate TelegramBot:', { error: e.message });
      return null;
    }
  }
  return botInstance;
}

/**
 * Throttle outbound messages to avoid 429 rate limits
 */
async function rateLimitWait() {
  const now = Date.now();
  const waitMs = Math.max(0, MIN_DISPATCH_INTERVAL_MS - (now - lastOutboundTime));
  if (waitMs > 0) {
    await new Promise(r => setTimeout(r, waitMs));
  }
  lastOutboundTime = Date.now();
}

/**
 * Resolve target chat ID and optional thread/topic ID for domain and category
 */
function resolveDestination(domain = 'stocks', category = null) {
  const config = getTelegramConfig();
  const domainConfig = config[domain];

  if (!domainConfig) {
    return { targetChatId: null, threadId: null, isConfigured: false };
  }

  // CRITICAL CONSTRAINT: For stocks domain, NEVER use @dealshubglobal
  let targetChatId = process.env.STOCKS_TELEGRAM_CHANNEL_ID || domainConfig.channelId || null;
  if (domain === 'stocks' && targetChatId === '@dealshubglobal') {
    targetChatId = null; // Invalidate any erroneous legacy setting
  }

  const isConfigured = Boolean(targetChatId && targetChatId.trim().length > 0);
  const threadId = category && domainConfig.topics?.[category] ? Number(domainConfig.topics[category]) : null;

  return {
    targetChatId,
    threadId,
    isConfigured,
    channelType: domainConfig.channelType || 'channel'
  };
}

/**
 * Low-level send message method supporting channel or forum topic
 */
async function sendRawTelegramMessage(targetChatId, text, threadId = null) {
  if (!targetChatId || !text) {
    return { success: false, reason: 'MISSING_TARGET_OR_TEXT' };
  }

  const bot = getBot();
  if (!bot) {
    return { success: false, reason: 'NO_BOT_TOKEN' };
  }

  await rateLimitWait();

  try {
    const options = { parse_mode: 'Markdown' };
    if (threadId) {
      options.message_thread_id = threadId;
    }

    await bot.sendMessage(targetChatId, text, options);
    logger.info(`✅ Dispatched Telegram message to ${targetChatId} (Topic Thread: ${threadId || 'Default'})`);
    return { success: true };
  } catch (err) {
    logger.error(`❌ Telegram send error to ${targetChatId} (Topic ${threadId}): ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send a single alert message to appropriate topic
 */
async function sendSingleAlert(alert, domain = 'stocks') {
  let category = 'buy_trades';
  const action = (alert.action || '').toUpperCase();
  const type = alert.type || '';
  const rating = Number(alert.rating || 0);

  if (type === 'EXIT_TRIGGERED' || action.includes('SELL') || action.includes('EXIT')) {
    category = 'sell_trades';
  } else if (rating >= 4) {
    category = 'high_conviction';
  }

  const { targetChatId, threadId, isConfigured } = resolveDestination(domain, category);

  if (!isConfigured) {
    logger.info(`[Telegram Notification Pending] Waiting for user to configure new Stocks Telegram Channel. Alert stored in Multi-DB.`);
    return { success: false, reason: 'WAITING_FOR_CHANNEL_CONFIGURATION' };
  }

  const badgeEmoji = category === 'sell_trades' ? '🎯' : rating >= 4 ? '⭐' : '🟢';
  const formattedText = `${badgeEmoji} *${alert.title}*\n━━━━━━━━━━━━━━━━━━━━━━\n${alert.message}\n\n🕒 _Triggered at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

  return await sendRawTelegramMessage(targetChatId, formattedText, threadId);
}

/**
 * Group multiple alerts to eliminate noise and prevent channel muting
 * Groups into:
 * 1. Exits & Targets Reached (Topic: sell_trades)
 * 2. High-Conviction Buys (4★–5★) (Topic: high_conviction)
 * 3. Fresh Buys in Range (3★) (Topic: buy_trades)
 * 4. Speculative / Lower Rating Buys (1★–2★) (Topic: buy_trades)
 */
async function dispatchGroupedTradeAlerts(alerts, domain = 'stocks') {
  if (!Array.isArray(alerts) || alerts.length === 0) return { dispatched: 0 };

  // If only 1 alert, send directly
  if (alerts.length === 1) {
    const res = await sendSingleAlert(alerts[0], domain);
    return { dispatched: res.success ? 1 : 0 };
  }

  const config = getTelegramConfig();
  const minRating = config.stocks?.alertThresholds?.minRatingForBuyAlert || 2;

  // 1. Group Exits & Targets
  const exits = alerts.filter(a => 
    a.type === 'EXIT_TRIGGERED' || a.action?.includes('SELL') || a.action?.includes('EXIT')
  );

  // 2. Group High Conviction Buys (4-5★)
  const highConvictionBuys = alerts.filter(a => 
    (a.type === 'BUY_ZONE_ENTERED' || a.action === 'BUY') && Number(a.rating || 0) >= 4
  );

  // 3. Group Medium Conviction Buys (3★)
  const mediumConvictionBuys = alerts.filter(a => 
    (a.type === 'BUY_ZONE_ENTERED' || a.action === 'BUY') && Number(a.rating || 0) === 3
  );

  // 4. Group Lower Conviction Buys (<= 2★) if meets threshold
  const lowerConvictionBuys = alerts.filter(a => 
    (a.type === 'BUY_ZONE_ENTERED' || a.action === 'BUY') && Number(a.rating || 0) < 3 && Number(a.rating || 0) >= minRating
  );

  let totalDispatched = 0;

  // Dispatch Exits Group
  if (exits.length > 0) {
    const dest = resolveDestination(domain, 'sell_trades');
    if (dest.isConfigured) {
      let msg = `🎯 *TARGETS & EXIT LEVELS MET (${exits.length} Stocks)*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      exits.slice(0, 10).forEach(e => {
        msg += `• *${e.symbol}* (${e.companyName || e.symbol})\n`;
        msg += `  Exit Level: ₹${e.level || '-'} | *CMP: ₹${e.currentCMP}* ✅\n`;
        msg += `  Source: _${e.source || 'Advisory'}_\n\n`;
      });
      if (exits.length > 10) msg += `_...and ${exits.length - 10} more exits._\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n🕒 _${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

      const res = await sendRawTelegramMessage(dest.targetChatId, msg, dest.threadId);
      if (res.success) totalDispatched++;
    }
  }

  // Dispatch High Conviction Buys (4-5★)
  if (highConvictionBuys.length > 0) {
    const dest = resolveDestination(domain, 'high_conviction');
    if (dest.isConfigured) {
      let msg = `⭐ *HIGH CONVICTION BUY CALLS (4★–5★ In Range)*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      highConvictionBuys.slice(0, 10).forEach(b => {
        const stars = '⭐'.repeat(Math.min(5, Number(b.rating || 4)));
        msg += `• *${b.symbol}* [${stars}]\n`;
        msg += `  Buy Upto: ₹${b.level || '-'} | *CMP: ₹${b.currentCMP}* 🚀\n`;
        msg += `  Source: _${b.source || 'Advisory'}_\n\n`;
      });
      if (highConvictionBuys.length > 10) msg += `_...and ${highConvictionBuys.length - 10} more calls._\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n🕒 _${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

      const res = await sendRawTelegramMessage(dest.targetChatId, msg, dest.threadId);
      if (res.success) totalDispatched++;
    }
  }

  // Dispatch Medium Conviction Buys (3★)
  if (mediumConvictionBuys.length > 0) {
    const dest = resolveDestination(domain, 'buy_trades');
    if (dest.isConfigured) {
      let msg = `🟢 *FRESH BUY OPPORTUNITIES (3★ In Range)*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      mediumConvictionBuys.slice(0, 10).forEach(b => {
        msg += `• *${b.symbol}* (${b.companyName || b.symbol}) [⭐⭐⭐]\n`;
        msg += `  Buy Upto: ₹${b.level || '-'} | *CMP: ₹${b.currentCMP}*\n`;
        msg += `  Source: _${b.source || 'Advisory'}_\n\n`;
      });
      if (mediumConvictionBuys.length > 10) msg += `_...and ${mediumConvictionBuys.length - 10} more calls._\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n🕒 _${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

      const res = await sendRawTelegramMessage(dest.targetChatId, msg, dest.threadId);
      if (res.success) totalDispatched++;
    }
  }

  // Dispatch Lower Conviction Buys (<= 2★)
  if (lowerConvictionBuys.length > 0) {
    const dest = resolveDestination(domain, 'buy_trades');
    if (dest.isConfigured) {
      let msg = `📊 *SPECULATIVE / ACCUMULATION BUYS (2★ In Range)*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      lowerConvictionBuys.slice(0, 10).forEach(b => {
        msg += `• *${b.symbol}*: Buy Upto ₹${b.level || '-'} | *CMP: ₹${b.currentCMP}* (Source: _${b.source || 'Advisory'}_)\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n🕒 _${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;

      const res = await sendRawTelegramMessage(dest.targetChatId, msg, dest.threadId);
      if (res.success) totalDispatched++;
    }
  }

  return {
    totalAlertsGrouped: alerts.length,
    batchesSent: totalDispatched,
    exitsCount: exits.length,
    highConvictionCount: highConvictionBuys.length,
    mediumConvictionCount: mediumConvictionBuys.length
  };
}

module.exports = {
  getTelegramConfig,
  saveTelegramConfig,
  resolveDestination,
  sendSingleAlert,
  dispatchGroupedTradeAlerts,
  sendRawTelegramMessage
};
