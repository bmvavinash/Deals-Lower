const { getModuleLogger } = require('../logger/logger');
const { saveNotification, getNotifications, isAlertOnCooldown, recordAlertSent, updateSignal } = require('../database/stocksMultiDB');
const { sendSingleAlert, dispatchGroupedTradeAlerts } = require('./genericTelegramDispatcher');

const logger = getModuleLogger('stockAlertNotificationService');

// 12-hour persistent cooldown per stock condition to eliminate spam
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

/**
 * Check a signal against CMP and construct an alert record ONLY if conditions trigger a STATE CHANGE.
 * User Rule: "I don't require the old messages which are already in the Same state(buy or Sell).
 *             I require notifications Only if the state changes."
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
  const currentStatus = signal.status;
  const prevStatus = signal.previousStatus || null;
  const lastNotifiedStatus = signal.lastNotifiedStatus || null;
  const isExpired = signal.isExpired === true || currentStatus === 'EXPIRED';

  // =========================================================================
  // CRITICAL USER INSTRUCTION:
  // "I don't require the old messages which are already in the Same state(buy or Sell).
  //  I require notifications Only if the state changes."
  // =========================================================================
  if (lastNotifiedStatus && lastNotifiedStatus === currentStatus) {
    // Exactly the same state as last notified -> SILENCE! No duplicate notification.
    return null;
  }

  let isStateChange = false;
  let notificationType = null;
  let alertTitle = '';
  let alertMessage = '';

  // 1. Transition into TRIGGERED (Sell / Exit level achieved)
  if (currentStatus === 'TRIGGERED' || (action.includes('SELL') || action.includes('EXIT'))) {
    const exitLevel = Number(signal.entryPrice || signal.entryMin || signal.target1);
    if (exitLevel && cmp >= exitLevel) {
      if (lastNotifiedStatus !== 'TRIGGERED') {
        const gainAboveExit = (((cmp - exitLevel) / exitLevel) * 100).toFixed(1);
        isStateChange = true;
        notificationType = 'EXIT_TRIGGERED';
        alertTitle = `🎯 STATE CHANGE: ${symbol} REACHED EXIT LEVEL`;
        alertMessage = `*${symbol}* (${signal.companyName || symbol}) has crossed recommended exit price!\n` +
          `• Transition: *${prevStatus || 'MONITORING'}* ➔ *TRIGGERED* ✅\n` +
          `• Recommended Exit: ₹${exitLevel}\n` +
          `• *Current Live CMP*: ₹${cmp} (+${gainAboveExit}% above exit)\n` +
          `• Call: *${signal.action}*\n` +
          `• Source: _${signal.source || 'Advisory'}_`;
      }
    }
  }

  // 2. Transition into BUY ZONE (IN_BUY_RANGE)
  if (!isStateChange && !isExpired && (currentStatus === 'IN_BUY_RANGE' || action === 'BUY')) {
    const rating = Number(signal.rating || 0);
    const isHighOrMediumConviction = rating >= 3 || signal.isSourceOfTruth;
    const buyCeiling = Number(signal.entryMax || signal.entryPrice);

    if (isHighOrMediumConviction && buyCeiling && cmp <= (buyCeiling * 0.98)) {
      if (lastNotifiedStatus !== 'IN_BUY_RANGE') {
        const discount = (((buyCeiling - cmp) / buyCeiling) * 100).toFixed(1);
        isStateChange = true;
        notificationType = 'BUY_ZONE_ENTERED';
        alertTitle = `🟢 STATE CHANGE: ${symbol} ENTERED BUY ZONE`;
        alertMessage = `*${symbol}* (${signal.companyName || symbol}) has dipped into active buying range!\n` +
          `• Transition: *${prevStatus || 'ABOVE_ENTRY'}* ➔ *IN_BUY_RANGE* 🚀\n` +
          `• Buy Ceiling: ₹${buyCeiling}\n` +
          `• *Current Live CMP*: ₹${cmp} (${discount}% discount)\n` +
          (signal.rating ? `• ⭐ Star Rating: ${signal.rating}\n` : '') +
          `• Source: _${signal.source || 'Advisory'}_`;
      }
    }
  }

  // 3. Approaching Buy Zone Alert (Within 1.5% of Buy Ceiling)
  if (!isStateChange && !isExpired && action === 'BUY') {
    const buyCeiling = Number(signal.entryMax || signal.entryPrice);
    if (buyCeiling && cmp > (buyCeiling * 0.98) && cmp <= (buyCeiling * 1.015)) {
      if (lastNotifiedStatus !== 'NEAR_BUY_ZONE' && lastNotifiedStatus !== 'IN_BUY_RANGE') {
        isStateChange = true;
        notificationType = 'NEAR_BUY_ZONE';
        alertTitle = `👀 HEADS-UP: ${symbol} APPROACHING BUY ZONE`;
        alertMessage = `*${symbol}* (${signal.companyName || symbol}) is within 1.5% of entering buy range!\n` +
          `• Current CMP: ₹${cmp} vs Buy Ceiling ₹${buyCeiling}\n` +
          `• Distance to entry: ${(((cmp - buyCeiling) / buyCeiling) * 100).toFixed(1)}%\n` +
          `• Watch closely for limit order placement.`;
      }
    }
  }

  // 4. Target 1 or Target 2 Hit
  if (!isStateChange && (currentStatus === 'TGT1_HIT' || currentStatus === 'TGT2_HIT')) {
    if (lastNotifiedStatus !== currentStatus) {
      isStateChange = true;
      notificationType = currentStatus;
      alertTitle = `🏆 TARGET ACHIEVED: ${symbol}`;
      alertMessage = `*${symbol}* (${signal.companyName || symbol}) has achieved target level!\n` +
        `• Transition: *${prevStatus || 'ACTIVE'}* ➔ *${currentStatus}*\n` +
        `• *Current Live CMP*: ₹${cmp}\n` +
        `• Status: ${signal.statusReason || currentStatus}\n` +
        `• Source: _${signal.source || 'Advisory'}_`;
    }
  }

  // 5. Stop Loss Hit
  if (!isStateChange && currentStatus === 'SL_HIT') {
    if (lastNotifiedStatus !== 'SL_HIT') {
      isStateChange = true;
      notificationType = 'SL_HIT';
      alertTitle = `🛑 STOP LOSS TRIGGERED: ${symbol}`;
      alertMessage = `*${symbol}* has breached stop loss level of ₹${signal.stopLoss}!\n` +
        `• Transition: *${prevStatus || 'ACTIVE'}* ➔ *SL_HIT*\n` +
        `• Current CMP: ₹${cmp}\n` +
        `• Capital protection exit recommended.`;
    }
  }

  // 6. Advisory Auto-Expired (Conflict Resolution)
  if (!isStateChange && currentStatus === 'EXPIRED') {
    if (lastNotifiedStatus !== 'EXPIRED' && signal.hasMultipleSources) {
      isStateChange = true;
      notificationType = 'ADVISORY_EXPIRED';
      alertTitle = `🔄 ADVISORY UPDATE: ${symbol} BUY EXPIRED`;
      alertMessage = `*${symbol}* previous buy recommendation is now EXPIRED.\n` +
        `• Reason: WhatsApp Source of Truth exit call is active.\n` +
        `• *Current Live CMP*: ₹${cmp}`;
    }
  }

  if (!isStateChange || !notificationType) {
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

  // Update in-memory and signal object state
  signal.lastNotifiedStatus = currentStatus;
  signal.lastNotifiedAt = new Date().toISOString();
  if (prevStatus) signal.previousStatus = prevStatus;

  // Persist lastNotifiedStatus to Multi-DB so reboots don't reset it
  updateSignal(signal.id, {
    lastNotifiedStatus: currentStatus,
    lastNotifiedAt: signal.lastNotifiedAt,
    previousStatus: prevStatus
  }).catch(() => {});

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
    previousStatus: prevStatus,
    newStatus: currentStatus,
    timestamp: new Date().toISOString(),
    channelSent: false
  };

  logger.info(`🚨 [STATE CHANGE ALERT] ${symbol}: ${prevStatus || 'NONE'} ➔ ${currentStatus} (CMP: ₹${cmp})`);

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
