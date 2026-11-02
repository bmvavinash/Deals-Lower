const { getModuleLogger } = require('../logger/logger');
const { saveNotification, getNotifications, isAlertOnCooldown, recordAlertSent } = require('../database/stocksMultiDB');
const { sendSingleAlert, dispatchGroupedTradeAlerts } = require('./genericTelegramDispatcher');

const logger = getModuleLogger('stockAlertNotificationService');

// 12-hour persistent cooldown per stock condition to eliminate spam
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

/**
 * Check a signal against CMP and construct an alert record if conditions are met
 * @param {object} signal - Signal object enriched with currentCMP, status, etc.
 * @param {object} options - { sendImmediately: boolean }
 * @returns {object|null} Notification object if condition met, null otherwise
 */
async function checkAndTriggerSignalNotification(signal, options = { sendImmediately: false }) {
  if (!signal || !signal.currentCMP || !signal.symbol) {
    return null;
  }

  const symbol = signal.symbol.toUpperCase();
  const cmp = Number(signal.currentCMP);
  const action = (signal.action || '').toUpperCase();
  const status = signal.status;
  const isExpired = signal.isExpired === true || status === 'EXPIRED';

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

  // Condition 2: Buy Zone Entered (BUY)
  // Strict quality filter: Must NOT be expired, must be 3★+ or WhatsApp Source of Truth,
  // and CMP must be at least 2% below buy ceiling to prevent marginal false alarms
  if (!shouldNotify && !isExpired && (status === 'IN_BUY_RANGE' || action === 'BUY')) {
    const rating = Number(signal.rating || 0);
    const isHighOrMediumConviction = rating >= 3 || signal.isSourceOfTruth;

    if (isHighOrMediumConviction) {
      const buyCeiling = Number(signal.entryMax || signal.entryPrice);
      if (buyCeiling && cmp <= (buyCeiling * 0.98)) {
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

  // Persistent Cooldown Check: Survives server restarts and redeployments
  const cooldownKey = `${symbol}_${notificationType}`;
  if (isAlertOnCooldown(cooldownKey, COOLDOWN_MS)) {
    logger.debug(`Notification for ${cooldownKey} suppressed by 12h persistent cooldown.`);
    return null;
  }

  // Lock cooldown immediately to prevent concurrent triggers
  recordAlertSent(cooldownKey);

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

  // Dispatch individual immediate alert only if specifically forced (not used during batch scans)
  if (options.sendImmediately) {
    try {
      const res = await sendSingleAlert(notificationRecord, 'stocks');
      notificationRecord.channelSent = Boolean(res.success);
    } catch (tgErr) {
      logger.warn(`Could not dispatch single Telegram alert: ${tgErr.message}`);
    }
  }

  // Persist in Multi-DB
  await saveNotification(notificationRecord);

  return notificationRecord;
}

/**
 * Scan all signals against latest CMP, evaluate triggers, and dispatch consolidated batched notifications
 * Eliminates notification noise and avoids Telegram 429 rate limits
 */
async function evaluateAndDispatchBatch(signals, domain = 'stocks') {
  if (!Array.isArray(signals) || signals.length === 0) return { triggeredCount: 0, dispatchedBatches: 0 };

  const triggeredMap = new Map();

  for (const sig of signals) {
    try {
      // Evaluate with sendImmediately: false to prevent spamming individual messages
      const notif = await checkAndTriggerSignalNotification(sig, { sendImmediately: false });
      if (notif) {
        // Deduplicate per symbol so 1 stock doesn't produce multiple duplicate rows
        const key = `${notif.symbol}_${notif.type}`;
        if (!triggeredMap.has(key)) {
          triggeredMap.set(key, notif);
        }
      }
    } catch (e) {
      logger.warn(`Error evaluating alert for ${sig.symbol}:`, { error: e.message });
    }
  }

  const triggered = Array.from(triggeredMap.values());
  if (triggered.length === 0) {
    return { triggeredCount: 0, dispatchedBatches: 0 };
  }

  logger.info(`Batch evaluation generated ${triggered.length} unique alerts. Dispatching via consolidated grouped dispatcher...`);

  // Dispatch grouped into at most ONE message per topic (Exits, High Conviction, 3★ Buys)
  const dispatchRes = await dispatchGroupedTradeAlerts(triggered, domain);

  return {
    triggeredCount: triggered.length,
    dispatchedBatches: dispatchRes.batchesSent || 0,
    details: dispatchRes
  };
}

/**
 * Scan all signals against latest CMP and evaluate notifications
 */
async function evaluateAllSignalAlerts(signals) {
  return await evaluateAndDispatchBatch(signals, 'stocks');
}

async function getTriggeredNotifications(limit = 50) {
  return await getNotifications(limit);
}

module.exports = {
  checkAndTriggerSignalNotification,
  evaluateAndDispatchBatch,
  evaluateAllSignalAlerts,
  getTriggeredNotifications,
  COOLDOWN_MS
};
