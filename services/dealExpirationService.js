process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const cheerio = require("cheerio");
const { productDealsDB } = require("../database/firebaseDB/productDealsDB");
const { notificationTrackingDB } = require("../database/firebaseDB/notificationTrackingDB");
const { editTelegramMessage } = require("../socialMedia/telegramPoster");
const { getModuleLogger } = require("../logger/logger");
const { getISTTimestamp } = require("../utils/commonUtils");
const config = require("../config/config");
const constants = require("../config/constants");

const logger = getModuleLogger("dealExpirationService");

/**
 * Format the updated Telegram message indicating deal expiration / price increase
 * @param {object} product - The product object
 * @param {number} previousPrice - The original deal price when posted
 * @param {number} currentPrice - The newly detected price
 * @param {number} missedSavings - Amount of money the user could have saved
 * @param {boolean} isOutOfStock - Whether the product is out of stock
 * @param {string} reason - Expiry reason
 * @returns {string} - Formatted Telegram HTML string
 */
function formatExpiredTelegramMessage(product, previousPrice, currentPrice, missedSavings, isOutOfStock = false, reason = "") {
  const title = product.urltext || product.productText || product.title || "Product Deal";
  const store = product.storeType || "Online Store";
  const link = product.links?.avinashbmvINR || product.links?.avinashbmv || product.productUrl || "https://dealshubglobal.com";

  let statusSection = "";
  if (isOutOfStock) {
    statusSection = `❌ <b>Status:</b> <b>SOLD OUT / OUT OF STOCK</b>\n` +
      `💰 <b>Original Deal Price:</b> ₹${previousPrice || "N/A"}`;
  } else if (currentPrice && previousPrice && currentPrice > previousPrice) {
    statusSection = `❌ <b>Status:</b> <b>DEAL EXPIRED (Price Increased)</b>\n` +
      `💰 <b>Earlier Deal Price:</b> ₹${previousPrice}\n` +
      `📈 <b>Current Price:</b> ₹${currentPrice}\n` +
      `💸 <b>You lost a deal with which you could save up to ₹${missedSavings || (currentPrice - previousPrice)}!</b>`;
  } else {
    statusSection = `❌ <b>Status:</b> <b>LIMITED-TIME DEAL ENDED</b>\n` +
      `💰 <b>Deal Price was:</b> ₹${previousPrice || "N/A"}`;
    if (missedSavings && missedSavings > 0) {
      statusSection += `\n💸 <b>Missed Savings:</b> Up to ₹${missedSavings}!`;
    }
  }

  return `⚠️ <b>DEAL EXPIRED / YOU MISSED THIS DEAL</b> ⚠️\n\n` +
    `<s>${title}</s>\n\n` +
    `${statusSection}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔔 <b>Never miss a loot deal again!</b>\n` +
    `⚡ Don't lose out on big savings next time! <b>Enable channel notifications</b> 🔔 and visit our platform to set instant price alerts for this product!\n\n` +
    `👉 <a href="${link}">View Product on ${store}</a>\n` +
    `🌐 <a href="https://dealshubglobal.com">Set Price Alerts & Explore Hot Deals</a>\n` +
    `━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Handle deal expiration for a product:
 * 1. Checks if posted to Telegram -> edits message with FOMO copy & lost savings
 * 2. Updates Firebase DB (deals, productdeals, productdeals_static)
 * 3. Updates Notification Tracking DB
 * @param {object} product - Product record
 * @param {object} options - Expiry options (newPrice, previousPrice, isOutOfStock, reason, forceExpire)
 * @returns {Promise<{success: boolean, productCode: string, telegramUpdated: boolean, missedSavings: number}>}
 */
async function expireDeal(product, options = {}) {
  const productCode = product.productCode || product.asin || product.id || product.key;
  if (!productCode) {
    logger.warn("expireDeal called without valid productCode or ID", { product });
    return { success: false, error: "Missing productCode" };
  }

  const previousPrice = Number(options.previousPrice || product.dealPrice || product.price || 0);
  const currentPrice = Number(options.newPrice || product.currentPrice || product.price || previousPrice);
  const isOutOfStock = Boolean(options.isOutOfStock || product.isOutOfStock);

  let missedSavings = Number(options.missedSavings || 0);
  if (!missedSavings) {
    if (currentPrice > previousPrice && previousPrice > 0) {
      missedSavings = currentPrice - previousPrice;
    } else if (product.mrp && previousPrice && Number(product.mrp) > previousPrice) {
      missedSavings = Number(product.mrp) - previousPrice;
    } else {
      missedSavings = 0;
    }
  }

  const reason = options.reason || (isOutOfStock ? "out_of_stock" : (currentPrice > previousPrice ? "price_increased" : "deal_ended"));

  logger.info(`Processing deal expiration for product: ${productCode}`, {
    productCode,
    previousPrice,
    currentPrice,
    missedSavings,
    isOutOfStock,
    reason
  });

  // --- Step 1: Telegram Message Editing ---
  let telegramUpdated = false;
  let telegramMessageId = product.telegramMessageId;
  let telegramChatId = product.telegramChatId;
  let isPhoto = product.isPhoto !== undefined ? product.isPhoto : true;

  // If Telegram details not directly on product, check notificationTrackingDB
  if (!telegramMessageId) {
    try {
      const trackingStatus = await notificationTrackingDB.getNotificationStatus(productCode);
      if (trackingStatus && trackingStatus.sentTo && trackingStatus.sentTo.telegram) {
        const tgData = trackingStatus.sentTo.telegram;
        if (tgData.messageId) {
          telegramMessageId = tgData.messageId;
          telegramChatId = tgData.chatId || config.TELEGRAM_CHANNELS.DEALS_ABOVE_75;
          if (tgData.isPhoto !== undefined) isPhoto = tgData.isPhoto;
          logger.debug("Retrieved Telegram messageId from notificationTrackingDB", {
            productCode,
            telegramMessageId,
            telegramChatId
          });
        }
      }
    } catch (trackLookupErr) {
      logger.warn("Error looking up notification tracking status", {
        productCode,
        error: trackLookupErr.message
      });
    }
  }

  if (telegramMessageId && telegramChatId) {
    try {
      const updatedText = formatExpiredTelegramMessage(
        product,
        previousPrice,
        currentPrice,
        missedSavings,
        isOutOfStock,
        reason
      );

      const editResult = await editTelegramMessage(
        telegramChatId,
        telegramMessageId,
        updatedText,
        isPhoto
      );

      if (editResult && editResult.success) {
        telegramUpdated = true;
        logger.info(`Successfully edited Telegram message to EXPIRED for ${productCode}`, {
          productCode,
          telegramMessageId,
          telegramChatId,
          alreadyUpdated: !!editResult.alreadyUpdated
        });
      } else {
        logger.warn(`Failed to edit Telegram message for ${productCode}`, {
          productCode,
          telegramMessageId,
          error: editResult?.error
        });
      }
    } catch (tgErr) {
      logger.error(`Exception while editing Telegram message for ${productCode}`, {
        productCode,
        error: tgErr.message
      });
    }
  } else {
    logger.info(`Product ${productCode} was not posted to Telegram (or missing messageId). Updating DB & UI only.`);
  }

  // --- Step 2: Update Firebase Database ---
  const nowIST = getISTTimestamp();
  const dbUpdates = {
    isExpired: true,
    isDeal: false,
    dealStatus: "expired",
    expiredAt: new Date().toISOString(),
    dealPrice: previousPrice,
    currentPrice: currentPrice,
    missedSavings: missedSavings,
    isOutOfStock: isOutOfStock,
    expiryReason: reason,
    updateTimestamp: nowIST,
    updatedAt: nowIST,
    updatedatetime: Date.now()
  };

  try {
    // Update in productdeals and productdeals_static
    await productDealsDB.updateIndividualProduct(productCode, dbUpdates, "productdeals");
    
    // Also update in deals (Hot Deals) node so it reflects as expired
    await productDealsDB.updateIndividualProduct(productCode, dbUpdates, "deals");

    logger.info(`Updated Firebase DB records for expired product ${productCode}`, {
      productCode,
      missedSavings,
      expiryReason: reason
    });
  } catch (dbErr) {
    logger.error(`Error updating DB for expired product ${productCode}`, {
      productCode,
      error: dbErr.message
    });
  }

  // --- Step 3: Track in Notification Tracking DB ---
  try {
    await notificationTrackingDB.trackNotification(
      productCode,
      "telegram",
      true,
      "expiredDeal",
      null,
      {
        status: "expired",
        expiredAt: new Date().toISOString(),
        missedSavings,
        telegramUpdated
      }
    );
  } catch (trackErr) {
    logger.debug(`Could not update notification tracking for ${productCode}: ${trackErr.message}`);
  }

  return {
    success: true,
    productCode,
    telegramUpdated,
    missedSavings,
    currentPrice,
    previousPrice
  };
}

/**
 * Fast price & availability checker using HTTP + Cheerio
 * @param {string} url - Product URL
 * @param {string} storeType - Amazon, Flipkart, Myntra, etc.
 * @returns {Promise<{currentPrice: number|null, isOutOfStock: boolean, title: string}>}
 */
async function checkLiveProductPrice(url, storeType = "") {
  if (!url) return { currentPrice: null, isOutOfStock: false, title: "" };

  const store = (storeType || "").toLowerCase();
  logger.debug(`Checking live price for URL (${storeType}): ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: "follow"
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      logger.info(`Product URL returned 404 (Out of stock / discontinued): ${url}`);
      return { currentPrice: null, isOutOfStock: true, title: "" };
    }

    if (!response.ok) {
      logger.warn(`Live price check HTTP status ${response.status} for ${url}`);
      return { currentPrice: null, isOutOfStock: false, title: "" };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let currentPrice = null;
    let isOutOfStock = false;
    let title = $("title").text().trim();

    if (store.includes("amazon") || url.includes("amazon.")) {
      // Out of stock indicators
      const availText = $("#availability, #outOfStock").text().toLowerCase();
      if (availText.includes("currently unavailable") || availText.includes("out of stock") || availText.includes("we don't know when")) {
        isOutOfStock = true;
      }

      // Price selectors
      const priceSelectors = [
        "span.a-price .a-price-whole",
        "#corePriceDisplay_desktop_feature_div .a-price-whole",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-section.a-spacing-none.aok-align-center .a-price-whole"
      ];

      for (const sel of priceSelectors) {
        const text = $(sel).first().text().replace(/[^\d.]/g, "").trim();
        if (text) {
          const parsed = parseFloat(text);
          if (!isNaN(parsed) && parsed > 0) {
            currentPrice = parsed;
            break;
          }
        }
      }
    } else if (store.includes("flipkart") || url.includes("flipkart.")) {
      // Out of stock indicators
      const soldOutText = $("div._16FRp0, div._1V3wAi, div._2JC0hw").text().toLowerCase();
      if (soldOutText.includes("sold out") || soldOutText.includes("currently unavailable")) {
        isOutOfStock = true;
      }

      // Price selectors
      const priceSelectors = [
        "div._30jeq3._16Jk6d",
        "div._30jeq3",
        "div.Nx9bqj.CxhGGd",
        "div.Nx9bqj"
      ];

      for (const sel of priceSelectors) {
        const text = $(sel).first().text().replace(/[^\d.]/g, "").trim();
        if (text) {
          const parsed = parseFloat(text);
          if (!isNaN(parsed) && parsed > 0) {
            currentPrice = parsed;
            break;
          }
        }
      }
    } else if (store.includes("myntra") || url.includes("myntra.")) {
      const priceText = $("strong.pdp-price, span.pdp-price").first().text().replace(/[^\d.]/g, "").trim();
      if (priceText) {
        const parsed = parseFloat(priceText);
        if (!isNaN(parsed) && parsed > 0) {
          currentPrice = parsed;
        }
      }
    }

    logger.debug(`Live price parsed for ${url}`, { currentPrice, isOutOfStock, title });
    return { currentPrice, isOutOfStock, title };
  } catch (err) {
    logger.debug(`Error during live price check for ${url}: ${err.message}`);
    return { currentPrice: null, isOutOfStock: false, title: "" };
  }
}

/**
 * Verify and update today's active deals from Firebase
 * Checks for price changes, timers, and out of stock status
 * @param {object} options - Configuration options
 * @returns {Promise<{totalChecked: number, expiredCount: number, telegramEditedCount: number, dbUpdatedCount: number}>}
 */
async function verifyAndUpdateTodaysDeals(options = {}) {
  const { maxDealsToCheck = 100, liveCheck = true } = options;
  logger.info("🔍 Starting today's deals expiration check...", { maxDealsToCheck, liveCheck });

  let totalChecked = 0;
  let expiredCount = 0;
  let telegramEditedCount = 0;
  let dbUpdatedCount = 0;

  try {
    // 1. Fetch deals from Firebase
    const { firebaseget } = require("../database/firebaseget");
    const result = await firebaseget(true, "deals");
    const data = result && result.data ? result.data : {};

    const dealEntries = Object.entries(data);
    logger.info(`Found ${dealEntries.length} total deals in Firebase (deals node)`);

    const now = Date.now();

    for (const [key, deal] of dealEntries) {
      if (totalChecked >= maxDealsToCheck) break;

      // Skip already expired deals
      if (deal.isExpired === true || deal.dealStatus === "expired") {
        continue;
      }

      totalChecked++;
      const productCode = deal.productCode || deal.asin || deal.id || key;
      const originalPrice = Number(deal.price || deal.offerPrice || 0);
      const url = deal.productUrl || deal.url || "";
      const storeType = deal.storeType || "";

      let shouldExpire = false;
      let expiryReason = "";
      let detectedNewPrice = null;
      let detectedOutOfStock = false;

      // Check 1: Timer expiration
      if (deal.dealExpiresAt) {
        const expiry = Number(deal.dealExpiresAt);
        if (expiry && expiry <= now) {
          shouldExpire = true;
          expiryReason = "timer_expired";
          logger.info(`Deal timer expired for ${productCode} (Expired at ${new Date(expiry).toISOString()})`);
        }
      }

      // Check 2: Live price check (if URL available and liveCheck enabled)
      if (!shouldExpire && liveCheck && url) {
        try {
          const liveData = await checkLiveProductPrice(url, storeType);
          detectedNewPrice = liveData.currentPrice;
          detectedOutOfStock = liveData.isOutOfStock;

          if (detectedOutOfStock) {
            shouldExpire = true;
            expiryReason = "out_of_stock";
            logger.info(`Product is Out of Stock: ${productCode}`);
          } else if (detectedNewPrice && originalPrice && detectedNewPrice > originalPrice) {
            shouldExpire = true;
            expiryReason = "price_increased";
            logger.info(`Price increased for ${productCode}: earlier ₹${originalPrice} ➔ current ₹${detectedNewPrice} (+₹${detectedNewPrice - originalPrice})`);
          }
        } catch (liveErr) {
          logger.debug(`Live check skipped for ${productCode}: ${liveErr.message}`);
        }
      }

      // If expired, trigger expiration
      if (shouldExpire) {
        expiredCount++;
        const expireResult = await expireDeal(deal, {
          newPrice: detectedNewPrice || originalPrice,
          previousPrice: originalPrice,
          isOutOfStock: detectedOutOfStock,
          reason: expiryReason
        });

        if (expireResult.success) {
          dbUpdatedCount++;
          if (expireResult.telegramUpdated) {
            telegramEditedCount++;
          }
        }
      }

      // Add a small pause between checks to avoid rate limiting
      if (liveCheck) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    logger.info("✅ Today's deals verification completed successfully", {
      totalChecked,
      expiredCount,
      telegramEditedCount,
      dbUpdatedCount
    });

    return {
      totalChecked,
      expiredCount,
      telegramEditedCount,
      dbUpdatedCount
    };
  } catch (error) {
    logger.error("Error during verifyAndUpdateTodaysDeals:", {
      error: error.message,
      stack: error.stack
    });
    return {
      totalChecked,
      expiredCount,
      telegramEditedCount,
      dbUpdatedCount,
      error: error.message
    };
  }
}

module.exports = {
  formatExpiredTelegramMessage,
  expireDeal,
  checkLiveProductPrice,
  verifyAndUpdateTodaysDeals
};
