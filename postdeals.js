const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct } = require("./scrappers/amazon")
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { formatProductInfo, getUserDetails } = require("./utils/commonUtils.js");
const { facebook } = require("./socialMedia/facebookPoster.js");
const extractFacebookToken = require("./socialMedia/extractFacebookToken.js");


async function postDeals(driver, product, link, shortUrl, username) {
    try {

        require("chromedriver");

        // var chrome = require("selenium-webdriver/chrome");

        // let options = await new chrome.Options();
        let text = "";
        let othertext = "";

        // options.debuggerAddress("localhost:9222");

        //CHROME
        // driver = await chrome.Driver.createSession(options);
        let isPhotoRequired = true
        let telegramId = ""
        let whatsappId = ""
        let facebookId = ""
        const constants = require('./config/constants');
        const config = require('./config/config.js');

        const { postingTypesConfig } = require('./config/constants');
        type = constants.type

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


        // text=text+product?.productText + `\n\nhttps://dealshubglobal.com/p/${product?.id}` + " \n#"+product?.storeType + " #"+product?.category
        user = getUserDetails(username)

        if (username.includes("dealsglobalhub")) {
            text = formatProductInfo(product);
        } else {
            text = formatProductInfo(product, user.amazonTagId, username, link, shortUrl);
        }
        // othertext = formatProductInfo(product,"dealshubworld-21",link);
        // othertext = formatProductInfo(product,"RamTechTelugu-21");

        // console.log("Text in Telegram is ",text)

        if (constantsData.postTo.telegram) {
            if (product?.photo != "") {
                if (username.includes("dealsglobalhub")) {
                    await telegram(product?.photo, telegramId, text)
                } else {
                    // await telegram(product?.photo,telegramId,text)
                    await telegram(product?.photo, user.telegramId, text, user.telegramToken)
                }
                // await telegram(product?.photo,"@DealsHubWorld",othertext)
                // await telegram(product?.photo,"@RamTechTelugu",othertext)
            }
            else if (!isPhotoRequired) {
                await telegram(product?.photo, telegramId, text)
                // https://t.me/RamTechTelugu
                // nivea check asin - no /dp/ - 
                // await telegram(product?.photo,"@RamTechTelugu",othertext)
            }
        }
        if (constantsData.postTo.whatsapp && username.includes("dealsglobalhub")) {
            whatsapp(product?.photo, whatsappId, text);
        }
        // if (constantsData.postTo.facebook && product?.discount >= 75 && username.includes("dealsglobalhub")) {
        //     console.log("Facebook ID is ", facebookId);
        //     response = await facebook(product, facebookId, text);
        //     if (response?.error?.message?.includes('Session has expired') || response?.error?.message?.includes('An active access token')) {
        //         console.log('Session expired. Refreshing token...');

        //         // Refresh the token
        //         const newToken = await extractFacebookToken(driver);
        //         console.log('New Token:', newToken);
        //         facebookId = newToken;
        //         constants.facebookId = newToken;
        //     }
        //     response = await facebook(product, facebookId, text)
        // }

        if (constantsData.postTo.facebook && product?.discount >= 75 && username.includes("dealsglobalhub")) {
            console.log("Facebook ID is ", facebookId);
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
            
        }
        
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    postDeals
};