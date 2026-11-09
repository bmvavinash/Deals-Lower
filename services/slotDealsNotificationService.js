'use strict';

const admin = require('firebase-admin');
const constants = require('../config/constants');
const { getModuleLogger } = require('../logger/logger');
const { broadcastWebPush } = require('./webPushService');
const { sendTelegramAlert } = require('./saleLiveNotificationService');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const cacheService = require('./cacheService');
const {
  VALID_SLOTS,
  SLOT_CONFIG,
  getISTDateString,
  getISTHour,
  normalizeSlotName,
  getCurrentOrClosestSlot,
  isSlotDealValidForToday
} = require('../utils/dealSlotUtils');

const logger = getModuleLogger('slot-deals-notification-service');

/**
 * Validates that a deal has a valid, non-placeholder image
 */
function hasValidDealImage(deal) {
  if (!deal) return false;
  let photo = deal.photo || deal.image || deal.img || '';
  if (Array.isArray(photo) && photo.length > 0) photo = photo[0] || '';
  if (!photo && Array.isArray(deal.images) && deal.images.length > 0) photo = deal.images[0] || '';
  if (typeof photo !== 'string') return false;
  photo = photo.trim();
  return /^(https?:)?\/\//i.test(photo) &&
         !photo.includes('no-image') &&
         !photo.includes('placeholder') &&
         !photo.startsWith('data:image');
}

/**
 * Validates that a deal is eligible to be displayed
 */
function isValidDealForDisplay(deal) {
  if (!deal) return false;
  const title = (deal.title || deal.shortText || deal.productText || '').trim();
  if (!title || title.length < 3) return false;
  if (/^(access denied|oops!|something went wrong|robot check|page not found|blocked|challenge|403 forbidden|404 not found|amazon\.in)/i.test(title)) return false;
  if (!hasValidDealImage(deal)) return false;
  if (!deal.price && !deal.outOfStock && !deal.isOutOfStock) return false;
  return true;
}

/**
 * Helper to get the primary Realtime Database
 */
function getPrimaryDb() {
  try {
    const defaultApp = admin.apps.find(a => a.name === '[DEFAULT]');
    if (defaultApp) return defaultApp.database();

    try {
      require('../database/firebaseDB/bannerDB');
      const app = admin.apps.find(a => a.name === '[DEFAULT]');
      if (app) return app.database();
    } catch (e) {}

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
 * Safe query with timeout
 */
async function safeQuery(queryRef, timeoutMs = 6000) {
  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firebase query timeout')), timeoutMs);
    });
    const result = await Promise.race([queryRef.once('value'), timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (e) {
    logger.debug('Firebase query timeout or error (continuing):', { error: e.message });
    return null;
  }
}

/**
 * Auto-curates top high-discount deals extracted today and tags them with the active slot
 * (e.g. 3 PM Handpicked Picks, 12 PM Loot, 8 PM Deals).
 */
async function autoTagTodayDealsForSlot(normSlot, targetDate = getISTDateString(), count = 20) {
  try {
    logger.info(`⚡ [AUTO-TAG] Checking today's deals to curate for ${normSlot} on ${targetDate}...`);
    // Query by indexed datetime for instant response (<1s)
    const snap = await safeQuery(productDealsDB.dealsRef.orderByChild('datetime').limitToLast(180), 8000);
    if (!snap || !snap.exists()) return [];

    const rawDeals = Object.values(snap.val() || {}).filter(p => {
      const pDate = p.date || (p.datetime && String(p.datetime).slice(0, 10));
      return pDate === targetDate;
    });
    const validDeals = rawDeals.filter(isValidDealForDisplay);

    validDeals.sort((a, b) => {
      const discA = parseFloat(String(a.discount || a.discountPercentage || 0).replace(/[^0-9.]/g, '')) || 0;
      const discB = parseFloat(String(b.discount || b.discountPercentage || 0).replace(/[^0-9.]/g, '')) || 0;
      return discB - discA;
    });

    const topPicks = validDeals.slice(0, count);
    if (topPicks.length === 0) return [];

    const slotKey = `${targetDate}_${normSlot}`;
    const updates = {};
    const dbRoot = productDealsDB.dealsRef ? productDealsDB.dealsRef.root : null;

    topPicks.forEach(p => {
      p.dealSlot = normSlot;
      p.dealDate = targetDate;
      p.dealSlotKey = slotKey;
      p.isSlotDeal = true;
      p.dealLabel = SLOT_CONFIG[normSlot]?.defaultBadge || `${normSlot.toUpperCase()} Picks`;
      p.dealName = SLOT_CONFIG[normSlot]?.label || `${normSlot.toUpperCase()} Flash Deals`;

      const key = p.productCode || p.id || p.asin;
      if (key && dbRoot) {
        const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
        updates[`deals/${safeKey}/dealSlot`] = normSlot;
        updates[`deals/${safeKey}/dealDate`] = targetDate;
        updates[`deals/${safeKey}/dealSlotKey`] = slotKey;
        updates[`deals/${safeKey}/isSlotDeal`] = true;
        updates[`deals/${safeKey}/dealLabel`] = p.dealLabel;
        updates[`deals/${safeKey}/dealName`] = p.dealName;
      }
    });

    if (dbRoot && Object.keys(updates).length > 0) {
      dbRoot.update(updates).catch(err => {
        logger.warn('Failed to update slot attributes in Firebase deals node:', err.message);
      });
      logger.info(`✅ [AUTO-TAG] Curated and tagged ${topPicks.length} top deals for ${normSlot} on ${targetDate}`);
    }

    return topPicks;
  } catch (err) {
    logger.warn('Error in autoTagTodayDealsForSlot:', err.message);
    return [];
  }
}

/**
 * Fetches products for a specific slot on a specific date (strictly today's date in IST).
 * Past days' deals are filtered out.
 *
 * @param {string} slotName - e.g. '12pm', '3pm'
 * @param {string} [targetDate] - YYYY-MM-DD (defaults to today's date in IST)
 * @returns {Promise<Array>} Array of valid deal objects
 */
async function fetchSlotDeals(slotName, targetDate = getISTDateString()) {
  const normSlot = normalizeSlotName(slotName);
  if (!normSlot) {
    logger.warn(`Invalid slot name requested: ${slotName}`);
    return [];
  }

  const cacheKey = `slot_deals_${targetDate}_${normSlot}`;
  const cached = cacheService.get(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    logger.debug(`Returning ${cached.length} cached slot deals for ${normSlot}`);
    return cached;
  }

  const slotKey = `${targetDate}_${normSlot}`;
  logger.info(`🔍 Fetching slot deals for slotKey="${slotKey}" (date="${targetDate}")...`);

  const dealsMap = new Map();

  const addValidProduct = (p) => {
    if (!p || !isValidDealForDisplay(p)) return;
    // Strict date validation: MUST match targetDate (today in IST)
    if (!isSlotDealValidForToday(p, normSlot, targetDate)) return;

    const code = p.productCode || p.id || p.asin || p.title;
    if (code && !dealsMap.has(code)) {
      dealsMap.set(code, p);
    }
  };

  try {
    // 1. Query recent items by indexed datetime (<1s response)
    const recentDealsSnap = await safeQuery(productDealsDB.dealsRef.orderByChild('datetime').limitToLast(180), 5000);
    if (recentDealsSnap && recentDealsSnap.exists()) {
      Object.values(recentDealsSnap.val() || {}).forEach(addValidProduct);
    }

    // 2. Query indexed dealSlotKey if needed
    if (dealsMap.size === 0) {
      const slotDealsSnap = await safeQuery(productDealsDB.dealsRef.orderByChild('dealSlotKey').equalTo(slotKey).limitToLast(100), 5000);
      if (slotDealsSnap && slotDealsSnap.exists()) {
        Object.values(slotDealsSnap.val() || {}).forEach(addValidProduct);
      }
    }

    // 3. Fallback: Check static deals
    if (dealsMap.size === 0 && productDealsDB.staticRef) {
      const staticSnap = await safeQuery(productDealsDB.staticRef.orderByChild('datetime').limitToLast(100), 4000);
      if (staticSnap && staticSnap.exists()) {
        Object.values(staticSnap.val() || {}).forEach(addValidProduct);
      }
    }

    // 4. Auto-curate and tag top deals for this slot if no deals are explicitly tagged yet
    if (dealsMap.size === 0) {
      const curated = await autoTagTodayDealsForSlot(normSlot, targetDate, 20);
      curated.forEach(addValidProduct);
    }
  } catch (err) {
    logger.error('Error fetching slot deals from Firebase:', { error: err.message });
  }

  const products = Array.from(dealsMap.values());

  // Sort descending by discount percentage or datetime
  products.sort((a, b) => {
    const discA = parseFloat(String(a.discount || a.discountPercentage || 0).replace(/[^0-9.]/g, '')) || 0;
    const discB = parseFloat(String(b.discount || b.discountPercentage || 0).replace(/[^0-9.]/g, '')) || 0;
    if (discB !== discA) return discB - discA;
    const timeA = a.datetime ? new Date(a.datetime).getTime() : 0;
    const timeB = b.datetime ? new Date(b.datetime).getTime() : 0;
    return timeB - timeA;
  });

  logger.info(`✅ Found ${products.length} valid slot deals for ${normSlot} on ${targetDate}`);
  if (products.length > 0) {
    cacheService.set(cacheKey, products, 2 * 60 * 1000); // Cache for 2 minutes
  }
  return products;
}

/**
 * Checks for deals in the specified slot and dispatches notifications if present
 * @param {Object} options
 * @param {string} [options.slot] - Slot name ('12pm', '3pm', '5pm', '6pm', '8pm', '9pm', or 'auto')
 * @param {string} [options.date] - Target date string (defaults to today in IST)
 * @param {boolean} [options.force] - Force sending even if cooldown / already sent today
 */
async function checkAndNotifySlotDeals(options = {}) {
  const inputSlot = options.slot || 'auto';
  const normSlot = inputSlot === 'auto' ? getCurrentOrClosestSlot() : (normalizeSlotName(inputSlot) || getCurrentOrClosestSlot());
  const targetDate = options.date || getISTDateString();
  const force = options.force === true || options.force === 'true';

  const slotInfo = SLOT_CONFIG[normSlot] || {
    slot: normSlot,
    label: `${normSlot.toUpperCase()} Flash Deals`,
    defaultBadge: `${normSlot.toUpperCase()} Loot`
  };

  logger.info(`⚡ Processing slot notification for slot="${normSlot}", date="${targetDate}", force=${force}...`);

  const primaryDb = getPrimaryDb();

  // 1. Idempotency Check: Don't spam users if already sent today
  if (primaryDb && !force) {
    try {
      const snap = await primaryDb.ref(`slot_notifications/${targetDate}_${normSlot}`).once('value');
      const lastAlert = snap.val();
      if (lastAlert && lastAlert.sentAt) {
        logger.info(`⏳ Notification for slot "${normSlot}" on "${targetDate}" was already sent at ${lastAlert.sentAt}. Skipping duplicate broadcast.`);
        return {
          success: true,
          skipped: true,
          reason: 'already_sent_today',
          slot: normSlot,
          date: targetDate,
          lastAlert
        };
      }
    } catch (checkErr) {
      logger.warn('Failed to check slot alert idempotency from Firebase:', checkErr.message);
    }
  }

  // 2. Fetch today's slot deals
  const deals = await fetchSlotDeals(normSlot, targetDate);

  if (!deals || deals.length === 0) {
    logger.info(`ℹ️ No valid deals found for slot "${normSlot}" on "${targetDate}". Notification skipped (deals required to trigger).`);
    return {
      success: true,
      skipped: true,
      reason: 'no_deals_for_slot',
      slot: normSlot,
      date: targetDate,
      count: 0
    };
  }

  const topDeal = deals[0];
  const dealUrl = `https://lowerdeal.com/sale/${normSlot}`;
  const displayLabel = slotInfo.label;

  // 3. Broadcast Web Push (Desktop & Mobile Browser Push)
  let pushResult = { sent: 0, failed: 0 };
  try {
    const topTitle = topDeal.title ? (topDeal.title.length > 55 ? topDeal.title.slice(0, 52) + '...' : topDeal.title) : 'Flash Deals';
    const topPrice = topDeal.price ? ` at ₹${topDeal.price}` : '';
    const extraCount = deals.length > 1 ? ` and ${deals.length - 1} more deals` : '';

    pushResult = await broadcastWebPush({
      title: `🔥 ${displayLabel} are LIVE! | LowerDeal`,
      body: `${topTitle}${topPrice}${extraCount} live right now. Tap to claim!`,
      link: dealUrl,
      icon: topDeal.photo || 'https://lowerdeal.com/logo192.png',
      badge: 'https://lowerdeal.com/logo192.png',
      extraData: {
        slot: normSlot,
        date: targetDate,
        dealCount: deals.length,
        saleName: normSlot
      }
    });
    logger.info(`📢 Slot Web Push dispatched: ${pushResult.sent} delivered, ${pushResult.failed} failed.`);
  } catch (pushErr) {
    logger.error('Slot Web Push broadcast failed:', { error: pushErr.message });
  }

  // 4. Send Telegram Alert to @dealshubglobal & @dealshubglobal2
  let tgResult = { success: false };
  try {
    const top3 = deals.slice(0, 4);
    const tgLines = [
      `🔥 *${slotInfo.label.toUpperCase()} ARE LIVE!* 🔥`,
      `📅 *Date:* ${targetDate}`,
      `⚡ *Live Drops:* ${deals.length} handpicked deals available now!`,
      ``,
      `*Top Picks from this drop:*`
    ];

    top3.forEach((d, idx) => {
      const cleanTitle = (d.title || 'Product').slice(0, 48).trim();
      const priceStr = d.price ? `₹${d.price}` : '';
      const mrpStr = d.mrp || d.originalPrice ? ` ~₹${d.mrp || d.originalPrice}~` : '';
      const discStr = d.discount || d.discountPercentage ? ` (${d.discount || d.discountPercentage}% OFF)` : '';
      tgLines.push(`${idx + 1}. *${cleanTitle}*`);
      tgLines.push(`   💰 ${priceStr}${mrpStr}${discStr}`);
    });

    tgLines.push(``);
    tgLines.push(`👉 *Click below to view all ${normSlot.toUpperCase()} deals on LowerDeal:*`);
    tgLines.push(`${dealUrl}`);

    const tgMessage = tgLines.join('\n');
    const photoUrl = (topDeal.photo && topDeal.photo.startsWith('http')) ? topDeal.photo : '';

    tgResult = await sendTelegramAlert(tgMessage, photoUrl);
    logger.info(`✈️ Telegram slot alert dispatched: success=${tgResult.success}`);
  } catch (tgErr) {
    logger.error('Telegram slot alert failed:', { error: tgErr.message });
  }

  // 5. Record Global In-App Notification (bell dropdown on LowerDeal)
  let inAppSuccess = false;
  try {
    inAppSuccess = await userFavoritesDB.addGlobalNotification({
      title: `🔥 ${slotInfo.label} are LIVE!`,
      message: `${deals.length} deals just dropped for ${normSlot.toUpperCase()} on LowerDeal. Tap to browse!`,
      channel: 'Slot Drop Broadcast',
      link: `/sale/${normSlot}`
    });
    logger.info(`📱 Global in-app notification recorded: success=${inAppSuccess}`);
  } catch (inAppErr) {
    logger.warn('Failed to record global in-app notification:', inAppErr.message);
  }

  // 6. Record Sent Metadata in Firebase RTDB (idempotency guard)
  if (primaryDb) {
    try {
      const alertMeta = {
        slot: normSlot,
        date: targetDate,
        dealCount: deals.length,
        sentAt: new Date().toISOString(),
        timestampMs: Date.now(),
        webPushSent: pushResult.sent || 0,
        telegramSuccess: tgResult.success || false,
        inAppSuccess: !!inAppSuccess,
        topDealTitle: topDeal.title || '',
        redirectUrl: dealUrl
      };
      await primaryDb.ref(`slot_notifications/${targetDate}_${normSlot}`).set(alertMeta);
      logger.info(`💾 Recorded slot notification metadata at slot_notifications/${targetDate}_${normSlot}`);
    } catch (saveErr) {
      logger.warn('Failed to record slot notification metadata in Firebase:', saveErr.message);
    }
  }

  return {
    success: true,
    slot: normSlot,
    date: targetDate,
    count: deals.length,
    webPush: pushResult,
    telegram: tgResult,
    inAppSuccess,
    redirectUrl: dealUrl
  };
}

module.exports = {
  fetchSlotDeals,
  checkAndNotifySlotDeals,
  isValidDealForDisplay
};
