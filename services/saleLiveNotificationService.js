'use strict';

const admin = require('firebase-admin');
const constants = require('../config/constants');
const { getModuleLogger } = require('../logger/logger');
const { broadcastWebPush } = require('./webPushService');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');

const logger = getModuleLogger('sale-live-notification-service');

/**
 * Sends a formatted Telegram message/photo using the bot key
 */
async function sendTelegramAlert(text, photoUrl = '') {
  const token = process.env.TELEGRAM_BOT_KEY || constants.TelegramBotKey;
  if (!token) {
    logger.warn('Telegram bot key not configured, skipping Telegram alert.');
    return { success: false, reason: 'missing_token' };
  }

  const channels = ['@dealshubglobal', '@dealshubglobal2'];
  const results = [];

  for (const channel of channels) {
    try {
      const endpoint = photoUrl
        ? `https://api.telegram.org/bot${token}/sendPhoto`
        : `https://api.telegram.org/bot${token}/sendMessage`;

      const body = photoUrl
        ? { chat_id: channel, photo: photoUrl, caption: text }
        : { chat_id: channel, text };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        logger.info(`✅ Telegram sale alert sent to ${channel}`, { messageId: data.result?.message_id });
        results.push({ channel, success: true, messageId: data.result?.message_id });
      } else {
        logger.warn(`⚠️ Telegram sale alert failed for ${channel}: ${data.description}`);
        results.push({ channel, success: false, error: data.description });
      }
    } catch (err) {
      logger.error(`❌ Error sending Telegram alert to ${channel}:`, { error: err.message });
      results.push({ channel, success: false, error: err.message });
    }
  }

  const anySuccess = results.some(r => r.success);
  return { success: anySuccess, results };
}

/**
 * Helper to get the primary Realtime Database (lowerdealhub)
 */
function getPrimaryDb() {
  try {
    const defaultApp = admin.apps.find(a => a.name === '[DEFAULT]');
    if (defaultApp) {
      return defaultApp.database();
    }
    // Try requiring bannerDB to initialize primary app
    try {
      require('../database/firebaseDB/bannerDB');
      const app = admin.apps.find(a => a.name === '[DEFAULT]');
      if (app) return app.database();
    } catch (e) {}

    // Fallback: initialize default app if credentials available
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app'
      });
      return app.database();
    }
  } catch (err) {
    logger.warn('Failed to obtain primary Firebase DB:', err.message);
  }
  return null;
}

/**
 * Triggers end-to-end notifications (Browser Push, Telegram, and In-App) for a live sale card
 * @param {Object} card - Promotional card object
 * @param {Object} options - { force: boolean, cooldownHours: number }
 */
async function triggerSaleLiveNotifications(card, options = {}) {
  const force = options.force || false;
  const cooldownHours = options.cooldownHours || 4;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  if (!card || !card.title) {
    logger.warn('No valid card provided for sale live notification.');
    return { success: false, reason: 'invalid_card' };
  }

  logger.info(`🔔 Processing sale live notification for "${card.title}" (force: ${force})...`);

  // 1. Check cooldown / deduplication against Firebase RTDB
  const primaryDb = getPrimaryDb();

  if (primaryDb && !force) {
    try {
      const snap = await primaryDb.ref('amazon_promo_cards_meta/lastSaleAlert').once('value');
      const lastAlert = snap.val();
      if (lastAlert && lastAlert.timestampMs) {
        const timeSinceLast = Date.now() - lastAlert.timestampMs;
        const sameCard = lastAlert.cardId === card.id || lastAlert.title === card.title;
        if (sameCard && timeSinceLast < cooldownMs) {
          const hoursLeft = ((cooldownMs - timeSinceLast) / (60 * 60 * 1000)).toFixed(1);
          logger.info(`⏳ Cooldown active for "${card.title}". Last alert sent ${hoursLeft}h ago. Skipping duplicate broadcast.`);
          return {
            success: true,
            skipped: true,
            reason: 'cooldown_active',
            lastAlert
          };
        }
      }
    } catch (err) {
      logger.warn('Failed to check lastSaleAlert cooldown from Firebase:', err.message);
    }
  }

  let cleanTitle = (card.title || '').trim();
  if (!cleanTitle || cleanTitle.toLowerCase() === 'sponsored') {
    cleanTitle = (card.priceBadge || card.badge || 'Amazon Live Event Deals').trim();
  }
  let cleanBadge = (card.priceBadge || card.badge || card.tagline || 'Limited-time live deals').trim();
  if (cleanBadge.toLowerCase() === cleanTitle.toLowerCase()) {
    cleanBadge = 'Exclusive Live Deals on LowerDeal';
  }
  const platformName = (card.platform || 'Amazon').toUpperCase();

  // 2. Broadcast Web Push (Browser notification across all devices)
  let pushResult = { sent: 0, failed: 0 };
  try {
    pushResult = await broadcastWebPush({
      title: `🔥 ${cleanTitle} is LIVE! | LowerDeal`,
      body: `${cleanBadge} is now live on lowerdeal.com. Check out exclusive deals!`,
      link: 'https://lowerdeal.com',
      extraData: {
        saleName: cleanTitle,
        badge: cleanBadge,
        platform: platformName
      }
    });
    logger.info(`📢 Browser Web Push dispatched: ${pushResult.sent} delivered, ${pushResult.failed} failed.`);
  } catch (pushErr) {
    logger.error('Web Push broadcast failed:', { error: pushErr.message });
  }

  // 3. Broadcast Telegram notification to @dealshubglobal & @dealshubglobal2
  const tgMessage = [
    `🔥 *NEW SALE LIVE ON LOWERDEAL!* 🔥`,
    ``,
    `🛍️ *Sale:* ${cleanTitle}`,
    `🏷️ *Offer:* ${cleanBadge}`,
    `📦 *Platform:* ${platformName}`,
    ``,
    `👉 *Check out all live deals on LowerDeal now:*`,
    `https://lowerdeal.com`
  ].join('\n');

  let tgPhotoUrl = '';
  if (card.imageUrl && card.imageUrl.startsWith('http')) {
    tgPhotoUrl = card.imageUrl;
  }

  const tgResult = await sendTelegramAlert(tgMessage, tgPhotoUrl);

  // 4. Record Global In-App Notification (bell dropdown on LowerDeal)
  try {
    await userFavoritesDB.addGlobalNotification({
      title: `🔥 ${cleanTitle} is LIVE!`,
      message: `${cleanBadge} is now live on LowerDeal. Tap to view exclusive deals!`,
      channel: 'Global Broadcast',
      link: '/'
    });
    logger.info('📱 Global in-app notification recorded in database.');
  } catch (inAppErr) {
    logger.warn('Failed to record global in-app notification:', inAppErr.message);
  }

  // 5. Update lastSaleAlert in Firebase RTDB
  if (primaryDb) {
    try {
      await primaryDb.ref('amazon_promo_cards_meta/lastSaleAlert').set({
        cardId: card.id || 'promo_live',
        title: cleanTitle,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        webpushSent: pushResult.sent || 0,
        telegramSuccess: tgResult.success
      });
      logger.info('💾 lastSaleAlert metadata updated in Firebase RTDB.');
    } catch (saveErr) {
      logger.warn('Failed to save lastSaleAlert in Firebase:', saveErr.message);
    }
  }

  return {
    success: true,
    card: { id: card.id, title: cleanTitle, badge: cleanBadge },
    webPush: pushResult,
    telegram: tgResult
  };
}

module.exports = {
  triggerSaleLiveNotifications,
  sendTelegramAlert
};
