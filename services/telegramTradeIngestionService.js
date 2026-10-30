const TelegramBot = require('node-telegram-bot-api');
const constants = require('../config/constants');
const { parseStockMessage } = require('./stockSignalParser');
const { getLiveQuote, evaluateSignalWithCMP } = require('./marketQuoteService');
const { 
  saveRawMessage, 
  saveSignals, 
  getAllSignals, 
  getPendingClarifications, 
  resolveClarification 
} = require('../database/stocksMultiDB');
const { generateBestInsights } = require('./stockInsightsAggregator');
const { dispatchToTopic, getTelegramConfig } = require('./genericTelegramDispatcher');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('telegramTradeIngestionService');

let botInstance = null;
let isPolling = false;
let processedMessageIds = new Set();
let stats = {
  startedAt: null,
  messagesReceived: 0,
  signalsIngested: 0,
  clarificationsPending: 0,
  lastSignalAt: null
};

// Map to track clarification questions: botMsgId -> signalId
const pendingQuestionMap = new Map();

/**
 * Initialize and start Telegram Ingestion Listener / Poller
 */
function startTelegramIngestion(token = null) {
  const botToken = token || process.env.STOCKS_TELEGRAM_BOT_TOKEN;

  if (!botToken || botToken === constants.TelegramBotKey) {
    logger.info('Telegram Trade Ingestion: Polling skipped on shared deals bot token to prevent 409 Conflict with Lowerdeal Live Deals.');
    return { success: false, reason: 'SHARED_DEALS_BOT_TOKEN_SKIP_POLL' };
  }

  if (botInstance && isPolling) {
    logger.info('Telegram Ingestion poller is already running.');
    return { success: true, status: 'already_running', stats };
  }

  try {
    botInstance = new TelegramBot(botToken, { polling: true });
    isPolling = true;
    stats.startedAt = new Date().toISOString();

    logger.info('🚀 Telegram Ingestion Poller active. Ready to ingest forwarded trades 24/7.');

    // Command: /start
    botInstance.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcome = `📈 *Equity Insights Hub — Automated Ingestion Active*\n\n` +
        `• *Forward / Repost Trades*: Forward any trade message here or post in your trade group/topic.\n` +
        `• Live CMP will be fetched from NSE/Yahoo.\n` +
        `• Signal will be automatically validated, stored in Multi-DB, and routed to topic feeds.\n\n` +
        `*Commands:*\n` +
        `• \`/status\` - Ingestion and bot heartbeat\n` +
        `• \`/signals\` - Recent active trades with CMP\n` +
        `• \`/doubts\` - Pending ambiguous tickers\n` +
        `• \`/resolve <ID> <SYMBOL>\` - Clarify ticker`;
      botInstance.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
    });

    // Command: /status
    botInstance.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      const reply = `🤖 *Telegram Ingestion Engine Status*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Status: *Active & Polling* 🟢\n` +
        `• Started At: _${stats.startedAt}_\n` +
        `• Messages Processed: *${stats.messagesReceived}*\n` +
        `• Signals Ingested: *${stats.signalsIngested}*\n` +
        `• Last Signal: _${stats.lastSignalAt || 'None yet'}_\n` +
        `• Pending Clarifications: *${pendingQuestionMap.size}*`;
      botInstance.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
    });

    // Command: /signals
    botInstance.onText(/\/signals/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const signals = await getAllSignals();
        const top = signals.slice(0, 8);
        if (top.length === 0) {
          return botInstance.sendMessage(chatId, 'No signals recorded yet.');
        }
        let reply = `📊 *Recent Signals (${signals.length} total):*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        top.forEach((s, idx) => {
          const cmp = s.currentCMP ? `₹${s.currentCMP}` : 'N/A';
          reply += `${idx + 1}. *[${s.action}] ${s.symbol}* | CMP: *${cmp}* | Tgt: ₹${s.target1 || s.entryPrice || '-'}\n` +
            `   Rating: ${s.rating ? '⭐'.repeat(Math.round(s.rating)) : 'Unrated'} | Status: _${s.status || 'ACTIVE'}_\n\n`;
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
          return botInstance.sendMessage(chatId, '✅ No pending ticker doubts. All company names are resolved!');
        }
        let reply = `❓ *Pending Doubts (${doubts.length}):*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        doubts.forEach((d, idx) => {
          reply += `${idx + 1}. *"${d.companyName}"* (${d.action} @ ₹${d.entryPrice || '-'})\n` +
            `   👉 Reply or send: \`/resolve ${d.signalId} <NSE_SYMBOL>\`\n\n`;
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

    // Main Ingestion Listener: handles messages and channel posts
    const handleIncomingMessage = async (msg) => {
      if (!msg) return;

      const messageId = msg.message_id;
      if (processedMessageIds.has(messageId)) {
        return; // Deduplicate
      }
      processedMessageIds.add(messageId);
      if (processedMessageIds.size > 2000) {
        // Keep memory bounded
        const first = Array.from(processedMessageIds)[0];
        processedMessageIds.delete(first);
      }

      const text = msg.text || msg.caption;
      if (!text || text.startsWith('/')) {
        return; // Skip commands or empty messages
      }

      stats.messagesReceived++;

      const chatId = msg.chat.id;
      const senderName = msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() : (msg.chat.title || 'Telegram User');
      const forwardSource = msg.forward_from_chat?.title || msg.forward_from?.first_name || null;
      const sourceLabel = forwardSource ? `Telegram Fwd: ${forwardSource}` : `Telegram: ${msg.chat.title || senderName}`;

      // 1. Check if user is replying to a bot doubt question
      if (msg.reply_to_message && pendingQuestionMap.has(msg.reply_to_message.message_id)) {
        const signalId = pendingQuestionMap.get(msg.reply_to_message.message_id);
        const resolvedSymbol = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (resolvedSymbol.length >= 2 && resolvedSymbol.length <= 15) {
          const quote = await getLiveQuote(resolvedSymbol);
          await resolveClarification(signalId, resolvedSymbol, `Resolved via Telegram reply from ${senderName}`);
          pendingQuestionMap.delete(msg.reply_to_message.message_id);

          const ltpText = quote ? `Live CMP: ₹${quote.ltp}` : 'Symbol confirmed';
          return botInstance.sendMessage(chatId, `✅ Clarification recorded! Ticker confirmed as *${resolvedSymbol}* (${ltpText}). Signal active in Multi-DB.`, { parse_mode: 'Markdown' });
        }
      }

      // 2. Audit log raw message
      await saveRawMessage({
        source: sourceLabel,
        text,
        sender: senderName,
        chatId,
        messageId,
        timestamp: new Date().toISOString()
      });

      // 3. Parse trade signals
      const parseResult = parseStockMessage(text, {
        source: sourceLabel,
        sender: senderName,
        timestamp: new Date().toISOString()
      });

      if (!parseResult.isTradeSignal || parseResult.signals.length === 0) {
        logger.debug(`Ignored non-trade Telegram message from ${senderName}`);
        return;
      }

      logger.info(`✨ Parsed ${parseResult.signals.length} trade signal(s) from Telegram message (${sourceLabel}).`);

      const enrichedSignals = [];
      for (const sig of parseResult.signals) {
        try {
          const quote = await getLiveQuote(sig.symbol);
          const evaluated = evaluateSignalWithCMP(sig, quote);
          enrichedSignals.push(evaluated || sig);
        } catch (e) {
          enrichedSignals.push(sig);
        }
      }

      // 4. Save to Multi-DB
      await saveSignals(enrichedSignals);
      stats.signalsIngested += enrichedSignals.length;
      stats.lastSignalAt = new Date().toISOString();

      // 5. Send acknowledgment and route to dedicated topic if configured
      for (const sig of enrichedSignals) {
        if (sig.requiresClarification) {
          const questionText = `❓ *Ticker Clarification Needed*\n` +
            `Unmapped Name: *"${sig.companyName}"*\n` +
            `Call: *${sig.action}* @ ₹${sig.entryPrice || '-'}\n` +
            `Reason: ${sig.clarificationReason}\n\n` +
            `👉 *Please reply directly to this message* with the correct NSE ticker (e.g. \`TATAMOTORS\` or \`RELIANCE\`).\n` +
            `\`ID: ${sig.id}\``;

          const sentMsg = await botInstance.sendMessage(chatId, questionText, { parse_mode: 'Markdown' });
          pendingQuestionMap.set(sentMsg.message_id, sig.id);
        } else {
          // Acknowledge receipt
          const cmpText = sig.currentCMP ? ` | Live CMP: *₹${sig.currentCMP}* (${sig.status})` : '';
          const targetText = sig.target1 ? ` | Tgt: ₹${sig.target1}` : '';
          const slText = sig.stopLoss ? ` | SL: ₹${sig.stopLoss}` : '';
          const stars = sig.rating ? ` (${'⭐'.repeat(Math.round(sig.rating))})` : '';

          const ack = `✅ *Trade Ingested*: [${sig.action}] *${sig.symbol}*${stars} @ ₹${sig.entryPrice || '-'}${cmpText}${targetText}${slText}\n` +
            `_Saved to Multi-DB & live market tracking active._`;

          botInstance.sendMessage(chatId, ack, { 
            parse_mode: 'Markdown',
            reply_to_message_id: messageId 
          }).catch(() => {
            botInstance.sendMessage(chatId, ack, { parse_mode: 'Markdown' }).catch(() => {});
          });

          // Route to appropriate topic
          routeSignalToTopic(sig).catch(e => logger.debug('Topic dispatch note:', { error: e.message }));
        }
      }

      // 6. Regenerate best insights in background
      generateBestInsights().catch(e => logger.warn('Insight regeneration note:', { error: e.message }));
    };

    botInstance.on('message', handleIncomingMessage);
    botInstance.on('channel_post', handleIncomingMessage);

    botInstance.on('polling_error', (error) => {
      logger.warn(`Telegram Ingestion polling note: ${error.message}`);
    });

    return { success: true, status: 'running', stats };
  } catch (err) {
    logger.error('Failed to start Telegram Ingestion poller:', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Route individual signal to its designated topic
 */
async function routeSignalToTopic(sig) {
  const config = getTelegramConfig();
  if (!config.stocks?.channelId) return;

  const rating = Number(sig.rating || 0);

  // 1. High conviction topic (4-5 stars)
  if (rating >= 4 && config.stocks.topics?.high_conviction) {
    const text = `⭐ *4-5★ High Conviction Signal Ingested*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*${sig.symbol}* (${sig.companyName || sig.symbol})\n` +
      `• Call: *${sig.action}* @ ₹${sig.entryPrice || '-'}\n` +
      `• Live CMP: *₹${sig.currentCMP || 'Pending'}* (${sig.cmpChangePercent || '0'}%)\n` +
      `• Target: *₹${sig.target1 || '-'}* | SL: *₹${sig.stopLoss || '-'}\n` +
      `• Rating: ${'⭐'.repeat(Math.round(rating))} (${rating}/5)\n` +
      `• Horizon: _${sig.callType || 'Positional'}_\n` +
      `• Source: _${sig.source}_\n` +
      `• Status: *${sig.status || 'IN_BUY_RANGE'}*`;

    await dispatchToTopic('stocks', 'high_conviction', text);
    return;
  }

  // 2. Buy Trades topic
  if (sig.action === 'BUY' && config.stocks.topics?.buy_trades) {
    const text = `🟢 *Buy Trade Signal Ingested*\n` +
      `*${sig.symbol}* @ ₹${sig.entryPrice || '-'}\n` +
      `• CMP: *₹${sig.currentCMP || 'Pending'}* | Target: *₹${sig.target1 || '-'}*\n` +
      `• Source: _${sig.source}_ | Status: *${sig.status}*`;
    await dispatchToTopic('stocks', 'buy_trades', text);
    return;
  }

  // 3. Sell / Exit Trades topic
  if ((sig.action === 'SELL' || sig.action === 'PARTIAL_EXIT' || sig.action === 'COMPLETE_EXIT') && config.stocks.topics?.sell_trades) {
    const text = `🎯 *Exit / Sell Trade Ingested*\n` +
      `*${sig.symbol}* (${sig.action}) @ ₹${sig.entryPrice || '-'}\n` +
      `• CMP: *₹${sig.currentCMP || 'Pending'}*\n` +
      `• Source: _${sig.source}_`;
    await dispatchToTopic('stocks', 'sell_trades', text);
  }
}

/**
 * Get current Ingestion status
 */
function getTelegramIngestionStatus() {
  return {
    isPolling,
    hasBotInstance: !!botInstance,
    stats,
    pendingDoubtsCount: pendingQuestionMap.size
  };
}

module.exports = {
  startTelegramIngestion,
  getTelegramIngestionStatus,
  routeSignalToTopic
};
