const { getModuleLogger } = require('../logger/logger');
const { saveNotification, getNotifications } = require('../database/stocksMultiDB');
const { sendSingleAlert, dispatchGroupedTradeAlerts } = require('./genericTelegramDispatcher');

const logger = getModuleLogger('stockAlertNotificationService');

// Notification cooldown cache: symbol_condition -> timestamp
const notificationHistory = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per stock condition to avoid spam

/**
 * Check a signal against CMP and construct an alert record if conditions are met
 * @param {object} signal - Signal object enriched with currentCMP, status, etc.
 * @param {object} options - { sendImmediately: boolean }
 * @returns {object|null} Notification object if condition met, null otherwise
 */
async function checkAndTriggerSignalNotification(signal, options = { sendImmediately: true }) {
  if (!signal || !signal.currentCMP || !signal.symbol) {
    return null;
  }

  const symbol = signal.symbol.toUpperCase();
  const cmp = signal.currentCMP;
  const action = (signal.action || '').toUpperCase();
  const status = signal.status;

  let shouldNotify = false;
  let notificationType = null;
  let alertTitle = '';
  let alertMessage = '';

  // Condition 1: Target / Exit Price Triggered (SELL / EXIT)
  if (status === 'TRIGGERED' || (action.includes('SELL') || action.includes('EXIT'))) {
    const exitLevel = Number(signal.entryPrice || signal.entryMin || signal.target1);
    if (exitLevel && cmp >= exitLevel) {
      const gainAboveExit = (((cmp - exitLevel) / exitLevel) * 100).toFixed(1);
      shouldNotify = true;
      notificationType = 'EXIT_TRIGGERED';
      alertTitle = `TARGET / EXIT LEVEL MET: ${symbol}`;
      alertMessage = `*${symbol}* (${signal.companyName || symbol}) has crossed recommended exit price!\n` +
        `• Recommended Level: ₹${exitLevel}\n` +
        `• *Current Live CMP*: ₹${cmp} (+${gainAboveExit}% above exit) ✅\n` +
        `• Call: *${signal.action}*\n` +
        `• Source: _${signal.source || 'Advisory'}_`;
    }
  }

  // Condition 2: Buy Zone Entered (BUY) - Suppressed if Buy is Expired by WhatsApp exit
  if (!shouldNotify && !signal.isExpired && status !== 'EXPIRED' && (status === 'IN_BUY_RANGE' || action === 'BUY')) {
    const buyCeiling = Number(signal.entryMax || signal.entryPrice);
    if (buyCeiling && cmp <= buyCeiling) {
      const discount = (((buyCeiling - cmp) / buyCeiling) * 100).toFixed(1);
      shouldNotify = true;
      notificationType = 'BUY_ZONE_ENTERED';
      alertTitle = `BUY OPPORTUNITY IN RANGE: ${symbol}`;
      alertMessage = `*${symbol}* (${signal.companyName || symbol}) is currently within buying range!\n` +
        `• Buy Ceiling: ₹${buyCeiling}\n` +
        `• *Current Live CMP*: ₹${cmp} (${discount}% discount) 🚀\n` +
        (signal.rating ? `• ⭐ Star Rating: ${signal.rating}\n` : '') +
        `• Source: _${signal.source || 'Advisory'}_`;
    }
  }

  // Condition 3: Target 1 / Target 2 Hit
  if (!shouldNotify && (status === 'TGT1_HIT' || status === 'TGT2_HIT')) {
    shouldNotify = true;
    notificationType = status;
    alertTitle = `TARGET ACHIEVED: ${symbol}`;
    alertMessage = `*${symbol}* (${signal.companyName || symbol}) has achieved target level!\n` +
      `• *Current Live CMP*: ₹${cmp}\n` +
      `• Status: ${signal.statusReason || status}\n` +
      `• Source: _${signal.source || 'Advisory'}_`;
  }

  // Condition 4: Stoploss Hit
  if (!shouldNotify && status === 'SL_HIT') {
    shouldNotify = true;
    notificationType = 'SL_HIT';
    alertTitle = `STOP LOSS TRIGGERED: ${symbol}`;
    alertMessage = `*${symbol}* has hit stop loss level of ₹${signal.stopLoss}.\n` +
      `• Current CMP: ₹${cmp}\n` +
      `• Action: EXIT recommended to preserve capital.`;
  }

  if (!shouldNotify) {
    return null;
  }

  // Check cooldown to avoid duplicate spam per stock symbol
  const cooldownKey = `${symbol}_${notificationType}`;
  const lastSent = notificationHistory.get(cooldownKey) || 0;
  if (Date.now() - lastSent < COOLDOWN_MS) {
    logger.debug(`Notification for ${cooldownKey} suppressed by cooldown.`);
    return null;
  }

  // Set cooldown timestamp IMMEDIATELY to prevent asynchronous loop race conditions
  notificationHistory.set(cooldownKey, Date.now());

  // Construct Notification Record
  const notificationRecord = {
    id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    signalId: signal.id,
    symbol,
    companyName: signal.companyName || symbol,
    type: notificationType,
    title: alertTitle,
    message: alertMessage,
    currentCMP: cmp,
    action: signal.action,
    level: signal.entryPrice || signal.entryMax || signal.entryMin,
    rating: signal.rating || null,
    source: signal.source,
    timestamp: new Date().toISOString(),
    channelSent: false
  };

  logger.info(`🚨 [STOCK ALERT] Condition met for ${symbol}: ${notificationType} (CMP: ₹${cmp})`);

  // 1. Dispatch Telegram Alert immediately if requested (e.g. single real-time stream message)
  if (options.sendImmediately) {
    try {
      const res = await sendSingleAlert(notificationRecord, 'stocks');
      notificationRecord.channelSent = Boolean(res.success);
    } catch (tgErr) {
      logger.warn(`Could not dispatch single Telegram alert: ${tgErr.message}`);
    }
  }

  // 2. Persist in Multi-DB
  await saveNotification(notificationRecord);

  return notificationRecord;
}

/**
 * Scan all signals against latest CMP, evaluate triggers, and dispatch batched grouped notifications
 * if multiple alerts fire at once (eliminates notification noise and avoids Telegram 429)
 */
async function evaluateAndDispatchBatch(signals, domain = 'stocks') {
  if (!Array.isArray(signals) || signals.length === 0) return { triggeredCount: 0, dispatchedBatches: 0 };

  const triggered = [];

  for (const sig of signals) {
    try {
      // Evaluate without sending individual messages immediately
      const notif = await checkAndTriggerSignalNotification(sig, { sendImmediately: false });
      if (notif) {
        triggered.push(notif);
      }
    } catch (e) {
      logger.warn(`Error evaluating alert for ${sig.symbol}:`, { error: e.message });
    }
  }

  if (triggered.length === 0) {
    return { triggeredCount: 0, dispatchedBatches: 0 };
  }

  logger.info(`Batch evaluation generated ${triggered.length} alerts. Dispatching via generic grouped dispatcher...`);

  // Dispatch grouped by priority (4-5★, 3★, Exits)
  const dispatchRes = await dispatchGroupedTradeAlerts(triggered, domain);

  return {
    triggeredCount: triggered.length,
    dispatchedBatches: dispatchRes.batchesSent || 0,
    details: dispatchRes
  };
}

/**
 * Scan all signals against latest CMP and evaluate notifications (legacy wrapper)
 */
async function evaluateAllSignalAlerts(signals) {
  const result = await evaluateAndDispatchBatch(signals, 'stocks');
  return result;
}

async function getTriggeredNotifications(limit = 50) {
  return await getNotifications(limit);
}

module.exports = {
  checkAndTriggerSignalNotification,
  evaluateAndDispatchBatch,
  evaluateAllSignalAlerts,
  getTriggeredNotifications,
  notificationHistory
};
