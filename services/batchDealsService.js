const admin = require('firebase-admin');
const constants = require('../config/constants.js');
const config = require('../config/config.js');
const { telegram } = require('../socialMedia/telegramPoster.js');
const { getModuleLogger } = require('../logger/logger.js');
const { getEmojiForCategory, getGenericCategory, normalizeCategory } = require('../utils/commonUtils.js');

const logger = getModuleLogger('batchDealsService');

// Initialize Firebase Admin if not already initialized
function initFirebase() {
    const defaultApp = admin.apps.find(app => app.name === '[DEFAULT]');
    if (!defaultApp) {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            } catch (e) {
                console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
            }
        }

        if (!serviceAccount) {
            const dbname = constants.postingTypesConfig[constants.type].DB;
            const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
            try {
                serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
            } catch (e) {
                console.error(`Firebase credentials file not found.`);
                throw e;
            }
        }
        
        const DB_Name = config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
        const dbUrl = DB_Name === 'lowerdealhub' 
            ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
            : `https://${DB_Name}-default-rtdb.firebaseio.com`;
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl,
        });
    }
    return admin.database();
}

/**
 * Queue a lower deal for later batching
 */
async function queueLowerDeal(product, link, shortUrl) {
    try {
        const db = initFirebase();
        const productCode = product?.productCode || product?.id || Date.now().toString();
        
        // Save relevant info for batching
        const queueRef = db.ref('lower_deals_queue/' + productCode);
        
        let finalCategory = product?.category?.mainCategory || product?.category?.c1;
        let genericCategory = "Other";
        if (finalCategory && finalCategory.trim() !== "") {
            genericCategory = getGenericCategory(normalizeCategory(finalCategory));
        }
        
        let title = product?.urltext || product?.productText || product?.title || "Deal";
        if (title.length > 80) title = title.substring(0, 77) + "...";
        
        const targetUrl = product?.links?.avinashbmvINR || product?.links?.avinashbmv || shortUrl || link;

        await queueRef.set({
            productCode,
            title,
            price: product.price || "N/A",
            storeType: product.storeType || "Unknown",
            category: genericCategory,
            url: targetUrl,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        
        logger.info(`Queued lower deal: ${productCode}`);
        return true;
    } catch (err) {
        logger.error(`Error queueing lower deal: ${err.message}`);
        return false;
    }
}

/**
 * Process and post batched deals
 */
async function processAndPostBatchedDeals() {
    try {
        const db = initFirebase();
        const queueRef = db.ref('lower_deals_queue');
        
        const snapshot = await queueRef.once('value');
        if (!snapshot.exists()) {
            logger.info("No lower deals to batch.");
            return false;
        }
        
        const deals = snapshot.val();
        
        // Group by category
        const groupedDeals = {};
        for (const [key, deal] of Object.entries(deals)) {
            const cat = deal.category || "Other";
            if (!groupedDeals[cat]) groupedDeals[cat] = [];
            groupedDeals[cat].push(deal);
        }
        
        // Format message
        let message = "📉 **Other Lower Deals Available Now** 📉\n\n";
        
        for (const [cat, catDeals] of Object.entries(groupedDeals)) {
            const emoji = getEmojiForCategory(cat);
            // Capitalize first letter
            const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
            message += `${emoji} **${catName}**\n`;
            
            for (const deal of catDeals) {
                message += `▪️ ${deal.title}\n`;
                message += `   ₹${deal.price} | #${deal.storeType} | [Buy Here](${deal.url})\n\n`;
            }
        }
        
        message += "\nStay tuned for more deals!";
        
        // Fetch new channel ID from config
        const channelId = config.TELEGRAM_CHANNELS.LOWER_DEALS || config.TELEGRAM_CHANNELS.ALL_DEALS;
        
        logger.info("Posting batched lower deals message.");
        
        // Post message (passing empty photo as it's a text list)
        await telegram("", channelId, message);
        
        // Clear the queue after successful post
        await queueRef.remove();
        
        logger.info("Successfully posted and cleared batched lower deals.");
        return true;
    } catch (err) {
        logger.error(`Error processing batched deals: ${err.message}`);
        return false;
    }
}

module.exports = {
    queueLowerDeal,
    processAndPostBatchedDeals
};
