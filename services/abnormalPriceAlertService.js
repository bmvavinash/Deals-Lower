/**
 * services/abnormalPriceAlertService.js
 * Intelligent Category-Aware Abnormal Price & Discount Alert Service.
 * Detects abnormal price drops, inverted pricing, and scraper glitches,
 * and triggers immediate alerts via Telegram (@notifyavi).
 */

const { getModuleLogger } = require('../logger/logger');
const constants = require('../config/constants');
const admin = require('firebase-admin');

const logger = getModuleLogger('abnormal-price-alert');

// Category-specific discount thresholds (percentage)
// Model: Mobiles getting 30% is borderline normal; 70% is abnormal.
// Fashion getting 70% is common; 88%+ is abnormal.
const CATEGORY_DISCOUNT_THRESHOLDS = {
  mobiles: {
    name: 'Mobiles & Smartphones',
    normalMax: 30,
    borderlineMax: 45,
    abnormalMin: 50,    // >= 50% is abnormal; 70% is extreme anomaly
    minRealisticPrice: 2000,
    keywords: ['mobile', 'smartphone', 'iphone', 'galaxy', 'oneplus', 'redmi', 'realme', 'vivo', 'oppo', 'poco', 'pixel', 'phone', 'cellphone']
  },
  laptops: {
    name: 'Laptops & Computers',
    normalMax: 30,
    borderlineMax: 45,
    abnormalMin: 50,
    minRealisticPrice: 8000,
    keywords: ['laptop', 'macbook', 'thinkpad', 'notebook', 'desktop', 'chromebook', 'vivobook', 'zenbook', 'ideapad', 'pavilion']
  },
  tablets: {
    name: 'Tablets & iPads',
    normalMax: 30,
    borderlineMax: 45,
    abnormalMin: 55,
    minRealisticPrice: 3000,
    keywords: ['tablet', 'ipad', 'tab', 'kindle']
  },
  televisions: {
    name: 'Smart TVs & Displays',
    normalMax: 40,
    borderlineMax: 50,
    abnormalMin: 65,
    minRealisticPrice: 4000,
    keywords: ['tv', 'television', 'led tv', 'oled', 'qled', 'smart tv', '4k tv']
  },
  appliances: {
    name: 'Large Appliances',
    normalMax: 40,
    borderlineMax: 50,
    abnormalMin: 65,
    minRealisticPrice: 2000,
    keywords: ['refrigerator', 'fridge', 'washing machine', 'air conditioner', 'ac', 'microwave', 'cooler', 'visi cooler', 'dishwasher']
  },
  audio: {
    name: 'Audio & Headphones',
    normalMax: 50,
    borderlineMax: 65,
    abnormalMin: 75,
    minRealisticPrice: 250,
    keywords: ['headphone', 'earphone', 'earbuds', 'tws', 'speaker', 'soundbar', 'bluetooth speaker']
  },
  grocery: {
    name: 'Grocery & Essentials',
    normalMax: 25,
    borderlineMax: 40,
    abnormalMin: 55,
    minRealisticPrice: 10,
    keywords: ['grocery', 'food', 'oil', 'flour', 'rice', 'dal', 'snack', 'beverage', 'tea', 'coffee', 'soap', 'shampoo']
  },
  books: {
    name: 'Books & Stationery',
    normalMax: 40,
    borderlineMax: 55,
    abnormalMin: 75,
    minRealisticPrice: 50,
    keywords: ['book', 'paperback', 'hardcover', 'novel', 'stationery', 'pen', 'notebook']
  },
  fashion: {
    name: 'Fashion & Apparel',
    normalMax: 70,      // 50-70% is standard in Indian fashion sales
    borderlineMax: 80,
    abnormalMin: 88,    // 88%+ is abnormal liquidation/error
    minRealisticPrice: 100,
    keywords: ['shirt', 't-shirt', 'tshirt', 'jeans', 'trousers', 'saree', 'kurta', 'dress', 'shoes', 'sneakers', 'footwear', 'jacket', 'watch', 'sunglasses']
  },
  default: {
    name: 'General Products',
    normalMax: 45,
    borderlineMax: 60,
    abnormalMin: 75,
    minRealisticPrice: 50,
    keywords: []
  }
};

/**
 * Detects product category key based on title, categoryGroup, and metadata
 * @param {Object} product 
 * @returns {string} categoryKey
 */
function detectCategoryKey(product) {
  if (!product) return 'default';

  const categoryHint = String(
    product.categoryGroup || 
    product.hierarchicalCategory?.subcategory || 
    product.hierarchicalCategory?.mainCategory || 
    product.category?.c1 || 
    product.category?.c2 || 
    ''
  ).toLowerCase();

  const titleLower = String(product.title || product.productText || product.shortText || '').toLowerCase();
  const fullText = `${categoryHint} ${titleLower}`;

  // Check specific categories first
  if (/\b(?:iphone|galaxy\s+s|galaxy\s+z|smartphone|mobile\s+phone|cellphone)\b/i.test(fullText)) {
    return 'mobiles';
  }
  if (/\b(?:laptop|macbook|notebook|chromebook)\b/i.test(fullText)) {
    return 'laptops';
  }
  if (/\b(?:ipad|tablet|tab\s+s\d|lenovo\s+tab)\b/i.test(fullText)) {
    return 'tablets';
  }
  if (/\b(?:smart\s*tv|television|qled|oled|led\s+tv)\b/i.test(fullText)) {
    return 'televisions';
  }
  if (/\b(?:refrigerator|fridge|washing\s+machine|air\s+conditioner|visi\s+cooler|cooler)\b/i.test(fullText)) {
    return 'appliances';
  }
  if (/\b(?:tws|earbuds|headphones|soundbar|bluetooth\s+speaker)\b/i.test(fullText)) {
    return 'audio';
  }
  if (/\b(?:grocery|supermarket|tea|coffee|atta|cooking\s+oil)\b/i.test(fullText)) {
    return 'grocery';
  }
  if (/\b(?:shirt|tshirt|jeans|trousers|saree|kurta|dress|sneakers|shoes|sandals)\b/i.test(fullText)) {
    return 'fashion';
  }

  // Iterate threshold map for category match
  for (const [key, config] of Object.entries(CATEGORY_DISCOUNT_THRESHOLDS)) {
    if (key === 'default') continue;
    if (config.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(fullText))) {
      return key;
    }
  }

  return 'default';
}

/**
 * Evaluates whether a product's price, MRP, and discount are abnormal.
 * @param {Object} product 
 * @returns {Object} evaluation - { isAbnormal, severity, reason, details }
 */
function evaluatePriceAbnormality(product) {
  if (!product) {
    return { isAbnormal: false, reason: 'No product data provided' };
  }

  const rawPrice = product.price != null ? product.price : product.dealPrice;
  const rawMrp = product.mrp != null ? product.mrp : product.originalPrice;

  const cleanNum = (val) => {
    if (val == null || val === '') return null;
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  };

  const price = cleanNum(rawPrice);
  const mrp = cleanNum(rawMrp);

  // If price is missing or out of stock, not an abnormal price error
  if (!price || price <= 0) {
    return { isAbnormal: false, reason: 'Price is zero or unavailable' };
  }

  const categoryKey = detectCategoryKey(product);
  const config = CATEGORY_DISCOUNT_THRESHOLDS[categoryKey] || CATEGORY_DISCOUNT_THRESHOLDS.default;

  // 1. INVERTED PRICE CHECK: Price > MRP
  if (mrp && price > mrp) {
    return {
      isAbnormal: true,
      severity: 'CRITICAL',
      category: config.name,
      categoryKey,
      price,
      mrp,
      calculatedDiscount: 0,
      rule: 'PRICE_EXCEEDS_MRP',
      reason: `Price (₹${price}) is higher than MRP (₹${mrp}). Definite inversion glitch.`
    };
  }

  // 2. FAKE PROMOTIONAL "500" / MICRO-PRICE GLITCH CHECK
  // e.g. Flagship electronics or mobiles priced at ₹1, ₹10, ₹99, or ₹500 when MRP > ₹5,000
  if (mrp && mrp >= 5000 && price <= 500) {
    return {
      isAbnormal: true,
      severity: 'CRITICAL',
      category: config.name,
      categoryKey,
      price,
      mrp,
      calculatedDiscount: Math.round(((mrp - price) / mrp) * 100),
      rule: 'PROMOTIONAL_MICRO_PRICE_GLITCH',
      reason: `High MRP item (₹${mrp}) priced at suspiciously low ₹${price} (likely promotional banner or coupon coupon code parsed as price).`
    };
  }

  // Compute mathematical discount percentage
  let discount = null;
  if (mrp && mrp > price) {
    discount = Math.round(((mrp - price) / mrp) * 100);
  } else if (product.discount) {
    discount = parseInt(String(product.discount).replace(/[^\d]/g, ''), 10) || null;
  }

  if (discount == null) {
    return { isAbnormal: false, reason: 'Cannot compute discount (missing MRP)' };
  }

  const priceDiff = mrp ? mrp - price : 0;

  // 3. CATEGORY-AWARE ABNORMAL DISCOUNT CHECK
  // e.g. Mobiles: 30% normal, 70% abnormal (threshold abnormalMin: 50%)
  if (discount >= config.abnormalMin) {
    const isExtreme = discount >= (config.abnormalMin + 15) || (priceDiff >= 25000 && discount >= 60);
    return {
      isAbnormal: true,
      severity: isExtreme ? 'CRITICAL' : 'HIGH',
      category: config.name,
      categoryKey,
      price,
      mrp,
      discount,
      priceDiff,
      threshold: config.abnormalMin,
      normalMax: config.normalMax,
      rule: 'EXCESSIVE_CATEGORY_DISCOUNT',
      reason: `${config.name} discount is ${discount}% (Category normal max is ${config.normalMax}%, abnormal threshold is ${config.abnormalMin}%). Difference: ₹${priceDiff}.`
    };
  }

  // 4. SUSPICIOUS HIGH-VALUE PRICE FLOOR CHECK
  // e.g. An iPhone / Laptop priced under the category minRealisticPrice
  if (config.minRealisticPrice && price < config.minRealisticPrice && mrp && mrp > (config.minRealisticPrice * 3)) {
    return {
      isAbnormal: true,
      severity: 'HIGH',
      category: config.name,
      categoryKey,
      price,
      mrp,
      discount,
      priceDiff,
      rule: 'SUB_FLOOR_PRICE_ANOMALY',
      reason: `${config.name} priced at ₹${price}, below minimum realistic price floor of ₹${config.minRealisticPrice} with MRP ₹${mrp}.`
    };
  }

  // 5. STATED VS CALCULATED DISCOUNT CONFLICT (> 25% discrepancy)
  if (product.discount && mrp && price) {
    const statedDisc = parseInt(String(product.discount).replace(/[^\d]/g, ''), 10);
    if (!isNaN(statedDisc) && Math.abs(statedDisc - discount) >= 25) {
      return {
        isAbnormal: true,
        severity: 'MEDIUM',
        category: config.name,
        categoryKey,
        price,
        mrp,
        discount,
        statedDiscount: statedDisc,
        rule: 'DISCOUNT_MISMATCH',
        reason: `Stated discount (${statedDisc}%) differs by ${Math.abs(statedDisc - discount)}% from calculated discount (${discount}%).`
      };
    }
  }

  return {
    isAbnormal: false,
    category: config.name,
    categoryKey,
    price,
    mrp,
    discount,
    reason: `Normal pricing: ${discount}% discount is within expected range (max normal: ${config.normalMax}%).`
  };
}

/**
 * Formats a Telegram alert payload with Markdown
 * @param {Object} product 
 * @param {Object} analysis 
 * @returns {string} formatted message
 */
function formatTelegramAlertMessage(product, analysis) {
  const title = (product.title || product.productText || 'Product').substring(0, 100);
  const code = product.productCode || product.id || 'N/A';
  const store = product.storeType || product.store || 'Online Store';
  const storeUrl = product.affiliateUrl || product.productUrl || product.url || '';
  const cleanCode = (code && code.includes('_DUMMY')) ? 'B0C3D6WTJX' : code;
  const lowerdealUrl = product.lowerdealUrl || (cleanCode && cleanCode !== 'N/A' ? `https://lowerdeal.com/p/${cleanCode}` : '');
  const severityEmoji = analysis.severity === 'CRITICAL' ? '🚨🚨🚨' : '⚠️';

  let linksSection = '';
  if (lowerdealUrl && storeUrl && lowerdealUrl !== storeUrl) {
    linksSection = `🌐 *LowerDeal:* ${lowerdealUrl}\n🛒 *Store:* ${storeUrl}`;
  } else if (lowerdealUrl) {
    linksSection = `🌐 *LowerDeal:* ${lowerdealUrl}`;
  } else if (storeUrl) {
    linksSection = `🔗 *Link:* ${storeUrl}`;
  }

  return `${severityEmoji} *ABNORMAL PRICE ALERT* ${severityEmoji}
━━━━━━━━━━━━━━━━━━━━━━
📱 *Category:* ${analysis.category || 'General'}
📦 *Product:* ${title}
🆔 *Code:* \`${code}\`
🏪 *Store:* ${store}

💰 *Offer Price:* ₹${analysis.price != null ? analysis.price : 'N/A'}
🏷️ *MRP:* ₹${analysis.mrp != null ? analysis.mrp : 'N/A'}
🔥 *Discount:* ${analysis.discount != null ? analysis.discount + '%' : 'N/A'} (Normal max: ${analysis.normalMax != null ? analysis.normalMax + '%' : 'N/A'})
📉 *Price Diff:* ₹${analysis.priceDiff != null ? analysis.priceDiff : (analysis.mrp && analysis.price ? analysis.mrp - analysis.price : 0)}

🔍 *Anomaly Reason:*
${analysis.reason}

${linksSection}
━━━━━━━━━━━━━━━━━━━━━━
_LowerDeal Anomaly Protection Engine_`;
}

/**
 * Sends alert message via Telegram Bot API
 * Targets @notifyavi (or TELEGRAM_ALERT_CHAT_ID from environment)
 * @param {string} text 
 * @param {string} [photoUrl] 
 * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
 */
async function sendTelegramAlert(text, photoUrl = '') {
  const botToken = process.env.TELEGRAM_ALERT_BOT_TOKEN || process.env.BOT_TOKEN || constants.TelegramBotKey;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_ALERT_USER || '@notifyavi';

  logger.info('Sending abnormal price alert to Telegram', { chatId, preview: text.slice(0, 100) });

  try {
    const endpoint = photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')
      ? `https://api.telegram.org/bot${botToken}/sendPhoto`
      : `https://api.telegram.org/bot${botToken}/sendMessage`;

    const body = photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')
      ? { chat_id: chatId, photo: photoUrl, caption: text, parse_mode: 'Markdown' }
      : { chat_id: chatId, text, parse_mode: 'Markdown' };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.ok) {
      logger.info('Telegram alert delivered successfully to ' + chatId);
      return { success: true, delivered: true, chatId, result: data.result };
    } else {
      logger.warn('Telegram alert API returned error:', {
        chatId,
        errorCode: data.error_code,
        description: data.description,
        note: data.error_code === 403 
          ? 'Bot must be added as administrator in channel @notifyavi to broadcast messages.' 
          : undefined
      });
      return { 
        success: false, 
        delivered: false, 
        chatId, 
        errorCode: data.error_code, 
        error: data.description,
        note: data.error_code === 403 
          ? 'Please add the Telegram bot (username: @all1appbot) as an Administrator in @notifyavi to receive broadcasts.' 
          : undefined
      };
    }
  } catch (err) {
    logger.error('Failed to dispatch Telegram alert:', { error: err.message });
    return { success: false, delivered: false, error: err.message };
  }
}

/**
 * Main function: Evaluates a product, logs to database, and triggers alert if abnormal
 * @param {Object} product 
 * @param {Object} [options]
 * @returns {Promise<{ isAbnormal: boolean, analysis: Object, alertSent?: boolean }>}
 */
async function checkAndAlertAbnormalPrice(product, options = {}) {
  const analysis = evaluatePriceAbnormality(product);

  if (!analysis.isAbnormal) {
    return { isAbnormal: false, analysis };
  }

  logger.warn('🚨 ABNORMAL PRICE DETECTED:', {
    productCode: product.productCode || product.id,
    title: product.title,
    rule: analysis.rule,
    reason: analysis.reason
  });

  const alertMessage = formatTelegramAlertMessage(product, analysis);
  const photo = product.photo || product.image || '';

  // 1. Send Telegram Alert
  const alertResult = await sendTelegramAlert(alertMessage, photo);

  // 2. Persist anomaly record in Firebase RTDB under /abnormal_price_alerts
  try {
    if (admin.apps.length) {
      const db = admin.database();
      const alertRef = db.ref('abnormal_price_alerts').push();
      await alertRef.set({
        productCode: product.productCode || product.id || 'N/A',
        title: product.title || '',
        store: product.storeType || 'Amazon',
        price: analysis.price,
        mrp: analysis.mrp,
        discount: analysis.discount,
        priceDiff: analysis.priceDiff,
        category: analysis.category,
        rule: analysis.rule,
        reason: analysis.reason,
        severity: analysis.severity,
        lowerdealUrl: product.lowerdealUrl || (product.productCode ? `https://lowerdeal.com/p/${product.productCode}` : ''),
        url: product.productUrl || product.url || '',
        telegramStatus: alertResult.delivered ? 'delivered' : 'failed',
        telegramError: alertResult.error || null,
        timestamp: new Date().toISOString()
      });
    }
  } catch (dbErr) {
    logger.warn('Could not save anomaly to Firebase RTDB:', { error: dbErr.message });
  }

  return {
    isAbnormal: true,
    analysis,
    alertSent: alertResult.delivered,
    telegramResult: alertResult
  };
}

/**
 * Triggers a dummy test alert to verify the Telegram integration (@notifyavi)
 * Specifically uses the mobile 70% abnormal discount scenario requested by the user.
 * @returns {Promise<Object>}
 */
async function triggerDummyAlert() {
  const dummyProduct = {
    id: 'B0C3D6WTJX_DUMMY',
    productCode: 'B0C3D6WTJX_DUMMY',
    title: 'Apple iPhone 15 (128 GB) - Black [DUMMY TEST ALERT]',
    productText: 'Apple iPhone 15 (128 GB) - Black',
    price: '23999',
    mrp: '79900',
    discount: '70%',
    categoryGroup: 'Mobiles',
    storeType: 'Amazon',
    lowerdealUrl: 'https://lowerdeal.com/p/B0C3D6WTJX',
    photo: 'https://m.media-amazon.com/images/I/71657TiFeHL._SX679_.jpg',
    productUrl: 'https://www.amazon.in/dp/B0C3D6WTJX?tag=dealshubglo0c-21'
  };

  logger.info('Executing dummy abnormal price alert trigger for scenario: Mobile 70% discount...');
  return await checkAndAlertAbnormalPrice(dummyProduct);
}

module.exports = {
  CATEGORY_DISCOUNT_THRESHOLDS,
  detectCategoryKey,
  evaluatePriceAbnormality,
  formatTelegramAlertMessage,
  sendTelegramAlert,
  checkAndAlertAbnormalPrice,
  triggerDummyAlert
};
