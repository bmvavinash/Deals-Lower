const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct } = require("./scrappers/amazon")
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { formatProductInfo, getUserDetails } = require("./utils/commonUtils.js");
const { facebook } = require("./socialMedia/facebookPoster.js");
const extractFacebookToken = require("./socialMedia/extractFacebookToken.js");
const { notificationQueue } = require("./services/NotificationQueueService");

async function postDeals(driver, product, link, shortUrl, username) {
    try {

        // require("chromedriver");

        let text = "";
        let othertext = "";

        let isPhotoRequired = true
        let telegramId = ""
        let whatsappId = ""
        let facebookId = ""
        const constants = require('./config/constants');
        const config = require('./config/config.js');

        const { postingTypesConfig } = require('./config/constants');
        let type = constants.type

        const constantsData = postingTypesConfig[type];

        const dbname = constantsData.DB
        const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
        if (product.discount > 75) {
            telegramId = config.TELEGRAM_CHANNELS.DEALS_ABOVE_75;
            whatsappId = config.WHATSAPP_GROUPS.DEALS_ABOVE_75;
            facebookId = constants.facebookId
        }
        else {
            telegramId = config.TELEGRAM_CHANNELS.ALL_DEALS;
            whatsappId = config.WHATSAPP_GROUPS.ALL_DEALS;
        }


        const user = getUserDetails(username) || null;

        if (username && username.includes("dealsglobalhub")) {
            text = formatProductInfo(product);
        } else if (user && user.amazonTagId) {
            text = formatProductInfo(product, user.amazonTagId, username, link, shortUrl);
        } else {
            // Fallback when user not found or tag is missing
            text = formatProductInfo(product);
        }

        // Optional notification tracking (backward compatible)
        let notificationTrackingDB = null;
        try {
            notificationTrackingDB = require('./database/firebaseDB/notificationTrackingDB').notificationTrackingDB;
        } catch (error) {
            // Tracking is optional
        }

        const productCode = product?.productCode || product?.asin || product?.id || null;
        const dealType = product?.isDeal ? 'hotDeal' : 'productDeal';

        if (constantsData.postTo.telegram) {
            let telegramSuccess = false;
            let telegramError = null;
            
            if (product?.photo != "" || !isPhotoRequired) {
                try {
                    let targetChatId = null;
                    let targetToken = "";

                    if (username && username.includes("dealsglobalhub")) {
                        targetChatId = telegramId;
                    } else if (user && user.telegramId && user.telegramToken) {
                        targetChatId = user.telegramId;
                        targetToken = user.telegramToken;
                    } else {
                        console.log('User not found or missing Telegram credentials; skipping telegram post.');
                        telegramError = 'Missing credentials';
                    }

                    if (targetChatId) {
                        // Enqueue instead of direct send
                        const enqueued = await notificationQueue.enqueue('telegram', {
                            photo: product?.photo || "",
                            chatId: targetChatId,
                            text: text,
                            token: targetToken
                        });
                        if (enqueued) {
                            telegramSuccess = true;
                        } else {
                            telegramError = 'Failed to enqueue';
                        }
                    }
                } catch (error) {
                    telegramError = error.message;
                    console.error('Telegram post error:', error);
                }
            }

            // Track notification if tracking available
            if (productCode && notificationTrackingDB) {
                try {
                    await notificationTrackingDB.trackNotification(productCode, 'telegram', telegramSuccess, dealType, telegramError);
                } catch (trackError) {
                    // Silent fail for tracking
                }
            }
        }
        
        if (constantsData.postTo.whatsapp && username.includes("dealsglobalhub")) {
            let whatsappSuccess = false;
            let whatsappError = null;
            
            try {
                // Enqueue WhatsApp notification
                const enqueued = await notificationQueue.enqueue('whatsapp', {
                    watsCode: whatsappId,
                    text: text
                });
                if (enqueued) {
                    whatsappSuccess = true;
                } else {
                    whatsappError = 'Failed to enqueue WhatsApp';
                }
            } catch (error) {
                whatsappError = error.message;
            }

            // Track notification if tracking available
            if (productCode && notificationTrackingDB) {
                try {
                    await notificationTrackingDB.trackNotification(productCode, 'whatsapp', whatsappSuccess, dealType, whatsappError);
                } catch (trackError) {
                    // Silent fail for tracking
                }
            }
        }
        
        if (constantsData.postTo.facebook && product?.discount >= 75 && username.includes("dealsglobalhub")) {
            console.log("Facebook ID is ", facebookId);
            let facebookSuccess = false;
            let facebookError = null;
            
            try {
                let response = await facebook(product, facebookId, text);
            
                // Check if response is a string and try to parse it
                if (typeof response === 'string' && response.includes('expired')) {
                    try {
                        response = JSON.parse(response);
                    } catch (e) {
                        console.error('Failed to parse response:', e);
                    }
                }
            
                if (response?.error?.message?.includes('Session has expired') || 
                    response?.error?.message?.includes('An active access token')) {
                    console.log('Session expired. Refreshing token...');
            
                    // Refresh the token
                    const newToken = await extractFacebookToken(driver);
                    console.log('New Token:', newToken);
                    facebookId = newToken;
                    constants.facebookId = newToken;
                    response = await facebook(product, facebookId, text);
                }

                if (!response?.error) {
                    facebookSuccess = true;
                } else {
                    facebookError = response.error.message || 'Unknown error';
                }
            } catch (error) {
                facebookError = error.message;
            }

            // Track notification if tracking available
            if (productCode && notificationTrackingDB) {
                try {
                    await notificationTrackingDB.trackNotification(productCode, 'facebook', facebookSuccess, dealType, facebookError);
                } catch (trackError) {
                    // Silent fail for tracking
                }
            }
        }
        
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    postDeals
};