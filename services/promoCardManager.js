/**
 * Promotional Cards Deduplication, Upsert & Timed-Slot Manager
 * 
 * 1. Deduplication & Upsert:
 *    Ensures that Amazon and partner promotional carousel cards are deduplicated
 *    and updated in place (by image/GIF URL or click redirect URL) rather than creating
 *    redundant duplicate records.
 * 
 * 2. Platform-Specific Timed Slots:
 *    When a later slot goes Live (e.g. Amazon 8PM live, or Flipkart 9PM live),
 *    the earlier slot (e.g. Amazon 3PM, Flipkart 5PM) is disabled (isActive: false)
 *    and removed from display.
 */

const path = require('path');

/**
 * Platform-Specific Timed Event Slots Configuration
 * Configurable per platform:
 *  - Amazon: 3PM Handpicked Deals vs 8PM Deals Live Now
 *  - Flipkart: 5PM Deals vs 9PM Deals
 */
const PLATFORM_TIMED_SLOTS = {
  amazon: [
    {
      slot: '3pm',
      startHour: 15, // 3 PM IST
      endHour: 18,   // 6 PM IST
      hour: 15,
      id: 'amazon_handpicked_promo',
      label: '3 PM Picks',
      match: (card) => {
        if (!card) return false;
        const text = `${card.id || ''} ${card.title || ''} ${card.clickRedirectUrl || ''} ${card.imageUrl || ''}`.toLowerCase();
        return text.includes('handpicked') || text.includes('3 pm') || text.includes('3pm') || text.includes('wp3pmdeals');
      }
    },
    {
      slot: '8pm',
      startHour: 20, // 8 PM IST
      endHour: 24,   // 12 AM (Midnight IST)
      hour: 20,
      id: 'amazon_8pm_promo',
      label: '8 PM Deals',
      match: (card) => {
        if (!card) return false;
        const text = `${card.id || ''} ${card.title || ''} ${card.clickRedirectUrl || ''} ${card.imageUrl || ''}`.toLowerCase();
        return text.includes('8pm') || text.includes('8 pm') || text.includes('wd8pm') || text.includes('amazon_8pm_deals');
      }
    }
  ],
  flipkart: [
    {
      slot: '5pm',
      startHour: 17,
      endHour: 20,
      hour: 17,
      id: 'flipkart_5pm_promo',
      label: '5 PM Deals',
      match: (card) => {
        if (!card) return false;
        const text = `${card.id || ''} ${card.title || ''} ${card.clickRedirectUrl || ''} ${card.imageUrl || ''}`.toLowerCase();
        return text.includes('5pm') || text.includes('5 pm');
      }
    },
    {
      slot: '9pm',
      startHour: 21,
      endHour: 24,
      hour: 21,
      id: 'flipkart_9pm_promo',
      label: '9 PM Deals',
      match: (card) => {
        if (!card) return false;
        const text = `${card.id || ''} ${card.title || ''} ${card.clickRedirectUrl || ''} ${card.imageUrl || ''}`.toLowerCase();
        return text.includes('9pm') || text.includes('9 pm');
      }
    }
  ]
};

/**
 * Normalizes an Amazon or partner URL for canonical comparison.
 * Strips transient tracking IDs (pd_rd_w, pf_rd_p, qid, etc.) while preserving
 * meaningful routing parameters (ref_, node, k, i, ASIN).
 */
function normalizeRedirectUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    const originAndPath = (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, '');
    
    // Check if URL has an Amazon ASIN (/dp/B0... or /gp/product/B0...)
    const asinMatch = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      return `${parsed.origin}/dp/${asinMatch[1].toUpperCase()}`;
    }

    // Extract core event/category params
    const ref = (parsed.searchParams.get('ref_') || parsed.searchParams.get('ref') || '').toLowerCase();
    const node = (parsed.searchParams.get('node') || '').toLowerCase();
    const k = (parsed.searchParams.get('k') || '').toLowerCase();
    const i = (parsed.searchParams.get('i') || '').toLowerCase();

    return `${originAndPath}?ref=${ref}&node=${node}&k=${k}&i=${i}`;
  } catch (e) {
    return url.toLowerCase().split('?')[0].replace(/\/+$/, '');
  }
}

/**
 * Normalizes an image or GIF asset URL.
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const clean = url.split('?')[0].trim().toLowerCase();
    return path.basename(clean);
  } catch (e) {
    return url.trim().toLowerCase();
  }
}

/**
 * Determines whether two cards represent the same promotional item.
 * Matches by:
 * 1. Image / GIF filename (e.g. amazon_8pm_deals.gif)
 * 2. Normalized Click Redirect URL
 * 3. Card ID
 */
function isSamePromoCard(cardA, cardB) {
  if (!cardA || !cardB) return false;

  // 1. Direct Card ID match
  if (cardA.id && cardB.id && cardA.id === cardB.id) {
    return true;
  }

  // 2. GIF / Image URL match
  if (cardA.imageUrl && cardB.imageUrl) {
    const imgA = normalizeImageUrl(cardA.imageUrl);
    const imgB = normalizeImageUrl(cardB.imageUrl);
    if (imgA && imgB && imgA === imgB) {
      return true;
    }
  }

  // 3. Click Redirect URL match
  if (cardA.clickRedirectUrl && cardB.clickRedirectUrl) {
    const urlA = normalizeRedirectUrl(cardA.clickRedirectUrl);
    const urlB = normalizeRedirectUrl(cardB.clickRedirectUrl);
    if (urlA && urlB && urlA === urlB) {
      return true;
    }
  }

  return false;
}

/**
 * Upsert a single card into a list of cards:
 * If a matching card already exists -> UPDATES it in place.
 * If not -> APPENDS it to the list.
 * 
 * @param {Array} cardsList
 * @param {Object} incomingCard
 * @returns {{ isUpdated: boolean, index: number }}
 */
function upsertPromoCard(cardsList, incomingCard) {
  if (!incomingCard) return { isUpdated: false, index: -1 };

  const existingIdx = cardsList.findIndex(existing => isSamePromoCard(incomingCard, existing));

  if (existingIdx !== -1) {
    const existing = cardsList[existingIdx];
    // Merge updates: retain original ID if established, update fresh title, badge, url, etc.
    cardsList[existingIdx] = {
      ...existing,
      ...incomingCard,
      id: existing.id || incomingCard.id,
      title: incomingCard.title || existing.title,
      priceBadge: incomingCard.priceBadge || existing.priceBadge,
      imageUrl: incomingCard.imageUrl || existing.imageUrl,
      clickRedirectUrl: incomingCard.clickRedirectUrl || existing.clickRedirectUrl,
      isActive: incomingCard.isActive !== undefined ? incomingCard.isActive : (existing.isActive !== false),
      lastUpdated: new Date().toISOString()
    };
    return { isUpdated: true, index: existingIdx };
  } else {
    cardsList.push({
      ...incomingCard,
      isActive: incomingCard.isActive !== undefined ? incomingCard.isActive : true,
      lastUpdated: new Date().toISOString()
    });
    return { isUpdated: false, index: cardsList.length - 1 };
  }
}

/**
 * Deduplicates an entire array of promotional cards, ensuring each GIF / image
 * and each redirect destination URL appears at most once.
 * Preserves the most up-to-date attributes when duplicates are merged.
 * 
 * @param {Array} cardsList
 * @returns {Array} Clean deduplicated list
 */
function deduplicatePromoCards(cardsList = []) {
  if (!Array.isArray(cardsList) || cardsList.length === 0) return [];

  const result = [];
  for (const card of cardsList) {
    if (!card) continue;
    upsertPromoCard(result, card);
  }
  return result;
}

/**
 * Applies platform-specific timed slot rules.
 * Rule: When a later slot goes Live (e.g. 8PM for Amazon or 9PM for Flipkart),
 * any earlier slot (e.g. 3PM for Amazon or 5PM for Flipkart) is:
 * 1. Marked as disabled (isActive: false, isExpired: true)
 * 2. Removed from active display if filterForDisplay is true
 * 
 * @param {Array} cardsList
 * @param {Object} options
 * @param {boolean} options.filterForDisplay If true, filters out disabled/expired cards from the array
 * @returns {Array} Processed cards list
 */
function applyPlatformTimedSlotRules(cardsList = [], options = { filterForDisplay: true }) {
  if (!Array.isArray(cardsList) || cardsList.length === 0) return [];

  // Determine current IST hour
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5)); // IST is UTC + 5:30
  const currentHourIST = istDate.getHours();

  for (const [platform, slots] of Object.entries(PLATFORM_TIMED_SLOTS)) {
    // 1. Check if any slot has completed or expired (outside active event hours or explicitly completed)
    for (const slot of slots) {
      const startH = slot.startHour !== undefined ? slot.startHour : slot.hour;
      const endH = slot.endHour !== undefined ? slot.endHour : (startH + 4);
      const isPastSlotWindow = (currentHourIST < startH || currentHourIST >= endH);

      for (const card of cardsList) {
        if ((card.platform === platform || !card.platform || platform === 'amazon') && slot.match(card)) {
          // If explicitly marked inactive/completed or outside its timed slot window
          if (card.isCompleted || card.isActive === false || isPastSlotWindow) {
            card.isActive = false;
            card.isCompleted = true;
            card.isExpired = true;
            card.disabledReason = card.disabledReason || `${slot.label} event completed`;
          }
        }
      }
    }

    // 2. Active slot superseding: when a later slot is currently live, all earlier slots are disabled
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      const startH = slot.startHour !== undefined ? slot.startHour : slot.hour;
      const endH = slot.endHour !== undefined ? slot.endHour : (startH + 4);

      const hasLiveCard = cardsList.some(c => 
        (c.platform === platform || !c.platform || platform === 'amazon') && 
        slot.match(c) && 
        c.isActive === true && 
        !c.isCompleted && 
        !c.isExpired
      );

      const isSlotCurrentlyLive = hasLiveCard && (currentHourIST >= startH && currentHourIST < endH);

      if (isSlotCurrentlyLive) {
        for (let j = 0; j < i; j++) {
          const earlierSlot = slots[j];
          for (const card of cardsList) {
            if ((card.platform === platform || !card.platform || platform === 'amazon') && earlierSlot.match(card)) {
              card.isActive = false;
              card.isExpired = true;
              card.disabledReason = `Superseded by live ${slot.label} event`;
            }
          }
        }
        break; // Found latest live slot for this platform
      }
    }
  }

  if (options.filterForDisplay) {
    return cardsList.filter(card => card.isActive !== false && !card.isCompleted && !card.isExpired);
  }
  return cardsList;
}

module.exports = {
  PLATFORM_TIMED_SLOTS,
  normalizeRedirectUrl,
  normalizeImageUrl,
  isSamePromoCard,
  upsertPromoCard,
  deduplicatePromoCards,
  applyPlatformTimedSlotRules
};
