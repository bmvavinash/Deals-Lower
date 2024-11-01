const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct } = require("./scrappers/amazon")
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { formatProductInfo } = require("./utils/commonUtils.js");
const { facebook } = require("./socialMedia/facebookPoster.js");


async function postDeals(driver,product) {
    require("chromedriver");
    
    var chrome = require("selenium-webdriver/chrome");
    
    let options = await new chrome.Options();
    let text="";
    let othertext="";
    
    options.debuggerAddress("localhost:9222");
    
    //CHROME
    driver = await chrome.Driver.createSession(options);
    let isPhotoRequired=true
    let telegramId=""
    let whatsappId=""
    let facebookId=""
    const constants = require('./config/constants');
    const config = require('./config/config.js');

    const { postingTypesConfig } = require('./config/constants');
    type = constants.type

    const constantsData = postingTypesConfig[type];

    const dbname= constantsData.DB
    const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
    if(product.discount>75){
        telegramId = config.TELEGRAM_CHANNELS.DEALS_ABOVE_75;
        whatsappId = config.WHATSAPP_GROUPS.DEALS_ABOVE_75;
        facebookId = constants.facebookId
    }
    else{
        telegramId = config.TELEGRAM_CHANNELS.ALL_DEALS;
        whatsappId = config.WHATSAPP_GROUPS.ALL_DEALS;
    }
    

    // text=text+product?.productText + `\n\nhttps://dealshubglobal.com/p/${product?.id}` + " \n#"+product?.storeType + " #"+product?.category

    text = formatProductInfo(product);
    othertext = formatProductInfo(product,"RamTechTelugu-21");
    // console.log("Text in Telegram is ",text)

    if (constantsData.postTo.telegram ) {
        if(product?.photo!=""){
            await telegram(product?.photo,telegramId,text)
            // await telegram(product?.photo,"@RamTechTelugu",othertext)
        }
        else if(!isPhotoRequired){
            await telegram(product?.photo,telegramId,text)
            // https://t.me/RamTechTelugu
            // nivea check asin - no /dp/ - 
            // await telegram(product?.photo,"@RamTechTelugu",othertext)
        }
    }
    if (constantsData.postTo.whatsapp) {
        whatsapp(product?.photo,whatsappId,text)
    }
    if (constantsData.postTo.facebook && product?.discount>=75) {
        facebook(product?.photo,facebookId,text)
    }
}

module.exports = {
    postDeals
};