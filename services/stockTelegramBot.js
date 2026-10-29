const TelegramBot = require('node-telegram-bot-api');
const constants = require('../config/constants');
const { parseStockMessage } = require('./stockSignalParser');
const { getLiveQuote, evaluateSignalWithCMP } = require('./marketQuoteService');
const { 
  saveRawMessage, 
  saveSignals, 
  getAllSignals, 
  getPendingClarifications, 
  resolveClarification, 
  getBestInsights 
} = require('../database/stocksMultiDB');
const { generateBestInsights, formatTelegramInsightsMessage } = require('./stockInsightsAggregator');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stockTelegramBot');

let botInstance = null;
let isPolling = false;

// Pending question map: telegramMsgId -> signalId
const pendingQuestionMap = new Map();

/**
 * Initialize and start the Telegram Stock Ingestion & Doubt Resolution Bot
 */
function initStockTelegramBot(token = null) {
  const botToken = token || process.env.STOCKS_TELEGRAM_BOT_TOKEN || constants.TelegramBotKey;

  if (!botToken) {
    logger.error('No Telegram bot token found. Bot cannot start.');
    return null;
  }

  if (botInstance && isPolling) {
    logger.info('Telegram bot is already running.');
    return botInstance;
  }

  try {
    botInstance = new TelegramBot(botToken, { polling: true });
    isPolling = true;

    logger.info('Stock Telegram Bot started polling successfully.');

    // Command: /start
    botInstance.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcome = `📈 *Welcome to Equity Stock Insights Hub Bot*!\n\n` +
        `• *Forward Stock Calls*: Forward any trade advisory message from WhatsApp or other channels here.\n` +
        `• */insights*: View top aggregated high-conviction insights.\n` +
        `• */signals*: View recent active stock signals with live CMP.\n` +
        `• */doubts*: View pending questions/unclear stock names.\n` +
        `• */resolve [ID] [SYMBOL]*: Resolve unmapped company ticker.\n` +
        `• */status*: Check database and scraper metrics.`;
      botInstance.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
    });

    // Command: /insights
    botInstance.onText(/\/insights/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const insights = await generateBestInsights();
        const text = formatTelegramInsightsMessage(insights);
        botInstance.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error generating insights: ${err.message}`);
      }
    });

    // Command: /signals
    botInstance.onText(/\/signals/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const signals = await getAllSignals();
        const top10 = signals.slice(0, 10);
        if (top10.length === 0) {
          return botInstance.sendMessage(chatId, 'No signals stored in database yet.');
        }

        let reply = `📊 *Recent Active Signals (${top10.length}):*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        top10.forEach((s, idx) => {
          const cmpStr = s.currentCMP ? `CMP: ₹${s.currentCMP}` : 'CMP: Fetching...';
          reply += `${idx + 1}. *[${s.action}] ${s.symbol}* (${s.companyName || s.symbol})\n`;
          reply += `   Target/Entry: ₹${s.entryPrice} | *${cmpStr}*\n`;
          reply += `   Status: _${s.status || 'ACTIVE'}_ | Source: _${s.source}_\n\n`;
        });
        botInstance.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error: ${err.message}`);
      }
    });

    // Command: /doubts
    botInstance.onText(/\/doubts/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const doubts = await getPendingClarifications();
        if (doubts.length === 0) {
          return botInstance.sendMessage(chatId, '✅ No pending doubts. All stock tickers are recognized!');
        }

        let reply = `❓ *Pending Doubt Questions (${doubts.length}):*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        doubts.forEach((d, idx) => {
          reply += `${idx + 1}. *${d.companyName}* (Call: ${d.action} @ ₹${d.entryPrice})\n`;
          reply += `   Reason: ${d.reason}\n`;
          reply += `   👉 Resolve with: \`/resolve ${d.signalId} <NSE_SYMBOL>\`\n\n`;
        });
        botInstance.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error: ${err.message}`);
      }
    });

    // Command: /resolve [ID] [SYMBOL]
    botInstance.onText(/\/resolve\s+(\S+)\s+(\S+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const signalId = match[1];
      const symbol = match[2].toUpperCase().trim();

      try {
        const quote = await getLiveQuote(symbol);
        const updated = await resolveClarification(signalId, symbol, `Resolved by Telegram user ${msg.from?.username || msg.from?.id}`);
        if (updated) {
          const cmpText = quote ? `(CMP: ₹${quote.ltp})` : '';
          botInstance.sendMessage(chatId, `✅ Successfully resolved signal to *${symbol}* ${cmpText}!`, { parse_mode: 'Markdown' });
        } else {
          botInstance.sendMessage(chatId, `⚠️ Could not find pending signal ID: ${signalId}`);
        }
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error resolving: ${err.message}`);
      }
    });

    // Main Message Handler (Ingestion & Doubt Resolution)
    botInstance.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || msg.caption;

      if (!text || text.startsWith('/')) {
        return; // Ignore bot commands
      }

      const senderName = msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() : 'Unknown';
      const forwardSource = msg.forward_from_chat?.title || msg.forward_from?.first_name || null;
      const sourceLabel = forwardSource ? `Telegram Fwd: ${forwardSource}` : `Telegram: ${msg.chat.title || senderName}`;

      logger.info(`Received Telegram message from ${sourceLabel}: "${text.substring(0, 80)}..."`);

      // 1. Check if user is replying to a bot doubt question
      if (msg.reply_to_message && pendingQuestionMap.has(msg.reply_to_message.message_id)) {
        const signalId = pendingQuestionMap.get(msg.reply_to_message.message_id);
        const resolvedSymbol = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (resolvedSymbol.length >= 2 && resolvedSymbol.length <= 15) {
          const quote = await getLiveQuote(resolvedSymbol);
          await resolveClarification(signalId, resolvedSymbol, `Resolved via Telegram reply from ${senderName}`);
          pendingQuestionMap.delete(msg.reply_to_message.message_id);

          const ltpText = quote ? `Live CMP: ₹${quote.ltp}` : 'Symbol registered';
          return botInstance.sendMessage(chatId, `✅ Clarification received! Ticker confirmed as *${resolvedSymbol}* (${ltpText}). Signal updated.`, { parse_mode: 'Markdown' });
        }
      }

      // 2. Audit log raw message
      await saveRawMessage({
        source: sourceLabel,
        text,
        sender: senderName,
        chatId,
        messageId: msg.message_id,
        timestamp: new Date().toISOString()
      });

      // 3. Parse trade signals
      const parseResult = parseStockMessage(text, {
        source: sourceLabel,
        sender: senderName,
        timestamp: new Date().toISOString()
      });

      if (!parseResult.isTradeSignal || parseResult.signals.length === 0) {
        logger.debug(`Telegram message did not contain trade signals: ${parseResult.reason || 'Filtered'}`);
        return;
      }

      logger.info(`Parsed ${parseResult.signals.length} stock signal(s) from Telegram message.`);

      const enrichedSignals = [];
      for (const sig of parseResult.signals) {
        const quote = await getLiveQuote(sig.symbol);
        const evaluated = evaluateSignalWithCMP(sig, quote);
        enrichedSignals.push(evaluated || sig);
      }

      // 4. Save to Multi-DB
      await saveSignals(enrichedSignals);

      // 5. Send confirmation and/or ask doubt questions if any symbol was ambiguous
      for (const sig of enrichedSignals) {
        if (sig.requiresClarification) {
          // Send clarification doubt question
          const questionText = `❓ *Clarification Needed for Stock Signal*\n` +
            `Unconfirmed Ticker: *"${sig.companyName}"*\n` +
            `Call: *${sig.action}* @ ₹${sig.entryPrice || '-'}\n` +
            `Reason: ${sig.clarificationReason}\n\n` +
            `👉 *Please reply directly to this message* with the correct NSE symbol (e.g. \`ARCHEAN\` or \`AETHER\`).\n` +
            `\`ID: ${sig.id}\``;

          const sentMsg = await botInstance.sendMessage(chatId, questionText, { parse_mode: 'Markdown' });
          pendingQuestionMap.set(sentMsg.message_id, sig.id);
        } else {
          // Send brief acknowledgment
          const cmpStr = sig.currentCMP ? ` | CMP: ₹${sig.currentCMP} (${sig.status})` : '';
          const ackText = `✅ *Recorded*: [${sig.action}] *${sig.symbol}* @ ₹${sig.entryPrice}${cmpStr}\n` +
            `_Source: ${sig.source}_`;
          botInstance.sendMessage(chatId, ackText, { parse_mode: 'Markdown' });
        }
      }

      // 6. Refresh Insights in background
      generateBestInsights().catch(e => logger.warn('Insight generation error:', { error: e.message }));
    });

    botInstance.on('polling_error', (error) => {
      // Ignore common network dropouts to prevent crash
      logger.warn(`Telegram polling error: ${error.message}`);
    });

    return botInstance;

  } catch (err) {
    logger.error('Failed to initialize Telegram bot:', { error: err.message });
    return null;
  }
}

/**
 * Send an outbound insights message or alert to Telegram channel
 */
async function sendTelegramAlert(text, chatId = null) {
  const botToken = process.env.STOCKS_TELEGRAM_BOT_TOKEN || constants.TelegramBotKey;
  const targetChatId = chatId || process.env.STOCKS_TELEGRAM_CHANNEL_ID || null;

  // CRITICAL: Under no circumstances send stock alerts to @dealshubglobal
  if (!botToken || !text || !targetChatId || targetChatId === '@dealshubglobal') {
    logger.debug('sendTelegramAlert skipped: No valid stock target chat ID configured.');
    return false;
  }

  try {
    const tempBot = botInstance || new TelegramBot(botToken);
    await tempBot.sendMessage(targetChatId, text, { parse_mode: 'Markdown' });
    return true;
  } catch (err) {
    logger.error(`Failed to send Telegram alert to ${targetChatId}: ${err.message}`);
    return false;
  }
}

module.exports = {
  initStockTelegramBot,
  sendTelegramAlert
};
