'use strict';

/**
 * Deal Slot Utilities
 * Handles detection, normalization, date-tagging, and date filtering of time-slot deals
 * (e.g. 12 PM Loot, 3 PM Handpicked, 5 PM Deals, 6 PM Rush, 8 PM Prime Deals, 9 PM Deals).
 */

const VALID_SLOTS = ['12pm', '3pm', '5pm', '6pm', '8pm', '9pm'];

const SLOT_CONFIG = {
  '12pm': { slot: '12pm', hour: 12, label: '12 PM Flash Deals', defaultBadge: '12 PM Loot' },
  '3pm':  { slot: '3pm',  hour: 15, label: '3 PM Handpicked Deals', defaultBadge: '3 PM Picks' },
  '5pm':  { slot: '5pm',  hour: 17, label: '5 PM Deals', defaultBadge: '5 PM Deals' },
  '6pm':  { slot: '6pm',  hour: 18, label: '6 PM Rush Deals', defaultBadge: '6 PM Rush' },
  '8pm':  { slot: '8pm',  hour: 20, label: '8 PM Prime Deals', defaultBadge: '8 PM Deals' },
  '9pm':  { slot: '9pm',  hour: 21, label: '9 PM Deals', defaultBadge: '9 PM Deals' }
};

/**
 * Returns current date string in IST (Asia/Kolkata) as 'YYYY-MM-DD'
 * Ensures consistency across cloud servers (Render, GitHub Actions) and local machines.
 */
function getISTDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  } catch (e) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(date.getTime() + istOffset);
    return istTime.toISOString().slice(0, 10);
  }
}

/**
 * Returns current hour (0-23) in IST
 */
function getISTHour(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false
    }).formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
  } catch (e) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(date.getTime() + istOffset).getUTCHours();
  }
}

/**
 * Normalizes any slot string into a canonical slot name ('12pm', '3pm', '5pm', '6pm', '8pm', '9pm')
 */
function normalizeSlotName(slotStr) {
  if (!slotStr || typeof slotStr !== 'string') return null;
  const clean = slotStr.toLowerCase().trim().replace(/[\s\-_]+/g, '');

  if (clean.includes('12pm') || clean === '12' || clean === '1200pm') return '12pm';
  if (clean.includes('3pm') || clean === '3' || clean === '15' || clean === '1500') return '3pm';
  if (clean.includes('5pm') || clean === '5' || clean === '17') return '5pm';
  if (clean.includes('6pm') || clean === '6' || clean === '18') return '6pm';
  if (clean.includes('8pm') || clean === '8' || clean === '20') return '8pm';
  if (clean.includes('9pm') || clean === '9' || clean === '21') return '9pm';

  return null;
}

/**
 * Automatically determines the closest active or upcoming slot for the current IST hour
 */
function getCurrentOrClosestSlot() {
  const currentHour = getISTHour();
  if (currentHour >= 11 && currentHour < 14) return '12pm';
  if (currentHour >= 14 && currentHour < 17) return '3pm';
  if (currentHour >= 17 && currentHour < 18) return '5pm';
  if (currentHour >= 18 && currentHour < 20) return '6pm';
  if (currentHour >= 20 && currentHour < 21) return '8pm';
  if (currentHour >= 21 || currentHour < 11) return '9pm';
  return '12pm';
}

/**
 * Detects deal slot from product attributes, URL, or explicit context
 * @param {Object} params
 * @param {string} params.url - Source page or product URL
 * @param {Object} params.raw - Raw product object extracted from DOM
 * @param {Object} params.product - Product object
 * @param {string} params.envSlot - Explicit slot from process.env or runner
 */
function detectDealSlot({ url = '', raw = {}, product = {}, envSlot = '' } = {}) {
  // 1. Explicit env or passed slot
  const explicitSlot = normalizeSlotName(envSlot || process.env.DEAL_SLOT);
  if (explicitSlot) return explicitSlot;

  // 2. URL analysis (source page URL or product link)
  const combinedUrl = `${url} ${product.sourceUrl || ''} ${product.productUrl || ''}`.toLowerCase();
  if (combinedUrl.includes('12pm') || combinedUrl.includes('12-pm') || combinedUrl.includes('12_pm')) return '12pm';
  if (combinedUrl.includes('3pm') || combinedUrl.includes('3-pm') || combinedUrl.includes('wp3pmdeals') || combinedUrl.includes('handpicked')) return '3pm';
  if (combinedUrl.includes('5pm') || combinedUrl.includes('5-pm')) return '5pm';
  if (combinedUrl.includes('6pm') || combinedUrl.includes('6-pm')) return '6pm';
  if (combinedUrl.includes('8pm') || combinedUrl.includes('8-pm') || combinedUrl.includes('wd8pm')) return '8pm';
  if (combinedUrl.includes('9pm') || combinedUrl.includes('9-pm')) return '9pm';

  // 3. Product text & badges analysis (DOM labels, timer, badges, titles)
  const combinedText = [
    product.deal,
    product.limitedTimeDeal,
    product.timer,
    product.dealLabel,
    product.dealName,
    product.title,
    product.shortText,
    product.badge,
    product.priceBadge,
    raw.deal,
    raw.limitedTimeDeal,
    raw.timer,
    raw.title,
    raw.badge,
    raw.priceBadge,
    raw.dealLabel,
    raw.dealName
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b12\s*(?::00)?\s*pm\b|\b12pm\b/i.test(combinedText)) return '12pm';
  if (/\b3\s*(?::00)?\s*pm\b|\b3pm\b|\bhandpicked\b/i.test(combinedText)) return '3pm';
  if (/\b5\s*(?::00)?\s*pm\b|\b5pm\b/i.test(combinedText)) return '5pm';
  if (/\b6\s*(?::00)?\s*pm\b|\b6pm\b/i.test(combinedText)) return '6pm';
  if (/\b8\s*(?::00)?\s*pm\b|\b8pm\b/i.test(combinedText)) return '8pm';
  if (/\b9\s*(?::00)?\s*pm\b|\b9pm\b/i.test(combinedText)) return '9pm';

  return null;
}

/**
 * Enriches a product object with slot deal attributes:
 * - dealSlot: canonical slot name ('12pm', '3pm', etc.)
 * - dealDate: YYYY-MM-DD in IST (Asia/Kolkata)
 * - dealSlotKey: `${dealDate}_${dealSlot}` for indexed database querying
 * - isSlotDeal: boolean true
 */
function enrichProductWithSlot(product, { raw = {}, url = '', envSlot = '' } = {}) {
  if (!product) return product;

  const detectedSlot = detectDealSlot({ url, raw, product, envSlot });
  const todayIST = getISTDateString();

  if (detectedSlot) {
    product.dealSlot = detectedSlot;
    product.dealDate = product.dealDate || todayIST;
    product.dealSlotKey = `${product.dealDate}_${detectedSlot}`;
    product.isSlotDeal = true;
    product.isDeal = true;

    if (!product.dealLabel) {
      product.dealLabel = SLOT_CONFIG[detectedSlot]?.defaultBadge || `${detectedSlot.toUpperCase()} Deal`;
    }
    if (!product.dealName) {
      product.dealName = SLOT_CONFIG[detectedSlot]?.label || `${detectedSlot.toUpperCase()} Flash Deals`;
    }
  } else if (product.dealSlot) {
    const norm = normalizeSlotName(product.dealSlot);
    if (norm) {
      product.dealSlot = norm;
      product.dealDate = product.dealDate || todayIST;
      product.dealSlotKey = `${product.dealDate}_${norm}`;
      product.isSlotDeal = true;
    }
  }

  return product;
}

/**
 * Checks if a product belongs to the given slot AND matches today's IST date.
 * Strictly filters out older deals from previous days.
 *
 * @param {Object} product - Product to check
 * @param {string} slotName - Slot name (e.g. '12pm')
 * @param {string} [targetDate] - Target date string (defaults to today's IST date)
 * @returns {boolean} True if deal matches slot and belongs to targetDate
 */
function isSlotDealValidForToday(product, slotName, targetDate = getISTDateString()) {
  if (!product) return false;
  const normSlot = normalizeSlotName(slotName);
  const prodSlot = normalizeSlotName(product.dealSlot || product.saleName || '');

  if (normSlot && prodSlot !== normSlot) return false;

  // Strict date check: dealDate (or date) MUST match targetDate (today in IST)
  const productDate = product.dealDate || product.date || '';
  if (productDate !== targetDate) {
    return false;
  }

  return true;
}

module.exports = {
  VALID_SLOTS,
  SLOT_CONFIG,
  getISTDateString,
  getISTHour,
  normalizeSlotName,
  getCurrentOrClosestSlot,
  detectDealSlot,
  enrichProductWithSlot,
  isSlotDealValidForToday
};
