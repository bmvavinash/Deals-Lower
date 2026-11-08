const admin = require('firebase-admin');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('bundleService');

/**
 * Maps a sequential integer counter (1, 2, 3...) to an alphanumeric ID.
 * Follows the user requirement:
 * 1 -> A1, 2 -> A2, ..., 100 -> A100
 * 101 -> B1, ..., 200 -> B100
 * ...
 * 2600 -> Z100
 * 2601 -> AA1, ..., 2700 -> AA100
 * 2701 -> AB1, etc.
 *
 * This provides ultra-short (2-4 character), memorable, and easily readable codes for YouTube viewers.
 */
function formatBundleId(n) {
  const num = Number(n);
  if (!num || isNaN(num) || num < 1) return 'A1';
  
  const numPerLetter = 100;
  const letterIndex = Math.floor((num - 1) / numPerLetter);
  const itemNumber = ((num - 1) % numPerLetter) + 1;

  let prefix = '';
  let temp = letterIndex;
  do {
    prefix = String.fromCharCode(65 + (temp % 26)) + prefix;
    temp = Math.floor(temp / 26) - 1;
  } while (temp >= 0);

  return `${prefix}${itemNumber}`;
}

/**
 * Normalizes user input bundle code to canonical format (e.g. "a1" -> "A1", "#b12" -> "B12")
 */
function normalizeBundleId(rawId) {
  if (!rawId) return '';
  return String(rawId).trim().toUpperCase().replace(/^#/, '').replace(/\s+/g, '');
}

/**
 * Atomically allocates the next bundle counter and formats the short alphanumeric ID
 */
async function allocateNextBundleId() {
  if (!admin.apps.length) {
    logger.warn('Firebase Admin not initialized, cannot allocate bundle ID');
    return null;
  }

  const db = admin.database();
  const counterRef = db.ref('counters/lastBundleNumber');

  const result = await counterRef.transaction((currentValue) => {
    return (currentValue || 0) + 1;
  });

  if (!result.committed) {
    throw new Error('Transaction failed while allocating next bundle ID');
  }

  const numericId = result.snapshot.val();
  const bundleId = formatBundleId(numericId);
  logger.info(`Allocated new collection bundle ID: ${bundleId} (Counter: ${numericId})`);
  return { bundleId, numericId };
}

/**
 * Creates and stores a collection / bundle of products in Firebase RTDB
 * @param {Object} bundleData
 * @param {string} [bundleData.title] - Optional title (e.g. "YouTube Top 5 Deals")
 * @param {Array<string>} [bundleData.productCodes] - Array of product codes
 * @param {Array<number>} [bundleData.productNumbers] - Array of numeric product IDs
 * @param {Array<Object>} [bundleData.items] - Pre-constructed product items
 * @param {Object} [bundleData.metadata] - Extra context (sourceUrl, videoId, etc.)
 * @returns {Promise<Object>} Created bundle object
 */
async function createBundle(bundleData = {}) {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  const db = admin.database();
  const { bundleId, numericId } = await allocateNextBundleId();
  if (!bundleId) {
    throw new Error('Failed to generate bundle ID');
  }

  const productCodes = Array.isArray(bundleData.productCodes)
    ? [...new Set(bundleData.productCodes.filter(Boolean))]
    : [];

  const productNumbers = Array.isArray(bundleData.productNumbers)
    ? [...new Set(bundleData.productNumbers.filter(n => n && !isNaN(Number(n))).map(Number))]
    : [];

  let items = Array.isArray(bundleData.items) ? [...bundleData.items] : [];

  // If items weren't directly supplied, populate minimal item records from codes & numbers
  if (items.length === 0 && productCodes.length > 0) {
    items = productCodes.map((code, idx) => ({
      productCode: code,
      productNumber: productNumbers[idx] || null,
      lowerdealUrl: `https://lowerdeal.com/p/${code}`
    }));
  }

  const now = new Date();
  const bundlePayload = {
    bundleId,
    numericId,
    title: bundleData.title || 'Featured Deals Collection',
    createdAt: now.toISOString(),
    createdTimestamp: now.getTime(),
    bundleUrl: `https://lowerdeal.com/b/${bundleId}`,
    productCodes,
    productNumbers,
    itemCount: items.length || productCodes.length,
    items,
    metadata: bundleData.metadata || {}
  };

  await db.ref(`bundles/${bundleId}`).set(bundlePayload);
  logger.info(`✅ Successfully saved collection bundle #${bundleId} with ${bundlePayload.itemCount} item(s)`, {
    bundleId,
    bundleUrl: bundlePayload.bundleUrl,
    itemCount: bundlePayload.itemCount
  });

  return bundlePayload;
}

/**
 * Fetches a bundle by its alphanumeric ID (e.g. "A1", "B12")
 * Enriches product items with real-time deal data from /deals/${productCode}
 * @param {string} rawBundleId
 * @returns {Promise<Object|null>}
 */
async function getBundleById(rawBundleId) {
  const bundleId = normalizeBundleId(rawBundleId);
  if (!bundleId || !admin.apps.length) return null;

  const db = admin.database();
  const snap = await db.ref(`bundles/${bundleId}`).once('value');
  if (!snap.exists()) return null;

  const bundle = snap.val();
  const productCodes = bundle.productCodes || [];
  
  // Real-time enrichment: fetch live deal details from Firebase RTDB
  if (productCodes.length > 0) {
    const dealsPromises = productCodes.map(async (code) => {
      try {
        let dealSnap = await db.ref(`deals/${code}`).once('value');
        if (!dealSnap.exists()) {
          dealSnap = await db.ref(`productdeals/${code}`).once('value');
        }
        if (dealSnap.exists()) {
          return { productCode: code, ...dealSnap.val() };
        }
      } catch (err) {
        logger.warn(`Failed to enrich product [${code}] in bundle [${bundleId}]: ${err.message}`);
      }
      return null;
    });

    const liveDeals = await Promise.all(dealsPromises);
    const liveDealsMap = {};
    liveDeals.filter(Boolean).forEach(d => {
      liveDealsMap[d.productCode || d.id] = d;
    });

    // Merge live data with bundle items
    if (Array.isArray(bundle.items) && bundle.items.length > 0) {
      bundle.items = bundle.items.map(item => {
        const live = liveDealsMap[item.productCode];
        if (!live) return item;

        const currentPrice = Number(live.dealPrice || live.price || live.discountedPrice || item.price || 0);
        const originalPrice = Number(live.originalPrice || live.regularPrice || live.mrp || item.originalPrice || currentPrice);
        const discountPercent = originalPrice > currentPrice
          ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
          : (Number(live.discountPercent || item.discountPercent || 0));

        return {
          ...item,
          title: live.title || live.productTitle || item.title || 'Special Deal',
          storeType: live.storeType || live.store || item.storeType || 'Store',
          price: currentPrice,
          originalPrice,
          discountPercent,
          imageUrl: live.imageUrl || live.image || live.thumbnail || item.imageUrl,
          dealUrl: live.dealUrl || live.url || live.productUrl || item.dealUrl,
          lowerdealUrl: item.lowerdealUrl || `https://lowerdeal.com/p/${item.productCode}`,
          inStock: live.inStock !== false && !live.isOutOfStock,
          productNumber: item.productNumber || live.productNumber || null
        };
      });
    } else if (liveDeals.length > 0) {
      bundle.items = liveDeals.filter(Boolean).map(live => {
        const currentPrice = Number(live.dealPrice || live.price || live.discountedPrice || 0);
        const originalPrice = Number(live.originalPrice || live.regularPrice || live.mrp || currentPrice);
        const discountPercent = originalPrice > currentPrice
          ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
          : (Number(live.discountPercent || 0));

        return {
          productCode: live.productCode || live.id,
          productNumber: live.productNumber || null,
          title: live.title || live.productTitle || 'Special Deal',
          storeType: live.storeType || live.store || 'Store',
          price: currentPrice,
          originalPrice,
          discountPercent,
          imageUrl: live.imageUrl || live.image || live.thumbnail,
          dealUrl: live.dealUrl || live.url || live.productUrl,
          lowerdealUrl: `https://lowerdeal.com/p/${live.productCode || live.id}`,
          inStock: live.inStock !== false && !live.isOutOfStock
        };
      });
    }
  }

  return bundle;
}

module.exports = {
  formatBundleId,
  normalizeBundleId,
  createBundle,
  getBundleById
};
