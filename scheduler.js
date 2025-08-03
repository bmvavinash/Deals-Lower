const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct, scrapeProduct } = require("./scrappers/amazon");
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { postDeals } = require("./postdeals");
const { firebase } = require("googleapis/build/src/apis/firebase");
const { firebaseget } = require("./database/firebaseget");
const { firebasepost } = require("./database/firebasepost");


const constants = require('./config/constants.js');
const config = require('./config/config.js');

require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const firebasePut = require("./database/firebaseput.js");
const { shortenProductText, getAsin, getformattedDate, getFlipkartProductId, getAjioCode, getMyntraCode } = require("./utils/commonUtils.js");
const updateProduct = require("./database/firebaseDB/firebaseUpdate.js");
const { productStatus, storeMap } = require("./config/const.js");
const { getModuleLogger } = require("./logger/logger.js");
const fs = require("fs").promises;


const logger = getModuleLogger('scheduler');

// let lastFetchTime = Date.now();
// const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
// let productCounter = 0;
// const PRODUCT_LIMIT = 30;

async function getProductDetails(driver, link, text = "", len = 0, access_token = "", data = {}, todayData = {}, postProduct=true, username, generateLink=false,shortUrl="") {

  let postflag = false;
  let postStatus = "";
  let productCode, product, keyExist = false;
  try {

    const date = new Date();
    if (len == 0 || data == {}) {
      data, len = await firebaseget();
    }

    const currentTime = Date.now();
    if (todayData == {}) {
    // if (todayData == {} || (currentTime - lastFetchTime > FETCH_INTERVAL) || productCounter >= PRODUCT_LIMIT) {
    // if (todayData == {} || productCounter >= PRODUCT_LIMIT) {
      logger.info("Fetching today's data on product counter", { functionName: 'getProductDetails' });
      todayData, len = await firebaseget(true);
      // lastFetchTime = currentTime;
      // productCounter = 0;
    }
    const todayDate = getformattedDate();
    // await driver.get(link);
    // link = await driver.getCurrentUrl();
    const storeKey = Object.keys(storeMap).find(key => link.includes(key));
    if (!storeKey) {
      logger.info("Store not supported", { functionName: 'getProductDetails' });
      return productStatus.PRODUCT_ERROR;
    }

    // Retrieve store-specific code and type from storeMap
    const { getCode, storeType } = storeMap[storeKey];
    productCode = getCode(link);

    // Check if product was updated today or exists in all deals
    if (todayData.hasOwnProperty(productCode)) {
      if(!constants.updateTodayDeals) {
        logger.info("Updated Product today hence skipping the flow !" , { functionName: 'getProductDetails' });
        return productStatus.PRODUCT_POSTED_TODAY;
      }
    }
    if (data.hasOwnProperty(productCode)) {
      logger.info("Product Key exists!" , { functionName: 'getProductDetails' });
      keyExist = true;
    } else {
      logger.info("Product Key does not exist." , { functionName: 'getProductDetails' });
    }

    // Scrape product details and set store type
    product = await scrapeProduct(link, storeKey, driver, text, keyExist, username, generateLink, shortUrl);
    product.storeType = storeType;
    product.date = String(todayDate);
    product.updatedatetime = Date.now();
    if (!keyExist) {
      product.id = len;
      product.idlen = len;
      product.idlength = len;
      product.datetime = Date.now();
    }
    product.isDeal = false
    product.isOffer = false
    product.isDisplay = postProduct;
    product.productType = "Affiliate";
    product.shortText = shortenProductText(product?.urltext);
    if(product?.category?.mainCategory === "") {
      product.category.mainCategory = product?.category?.c1;
    }


    let env = constants.env

    // console.log("Product is ", product);

  //   if (
  //     product?.price > 0 && 
  //     (
  //         (product.storeType !== "Amazon" && 
  //             (product?.links?.avinashbmv || product?.links?.avinashbmvINR)) || 
  //         (product.storeType === "Amazon" && 
  //             (product?.links?.avinashbmv && product?.productCode))
  //     )
  // ) {

  if (
    product?.price > 0 &&
    (
        (
            product.storeType !== "Amazon" &&
            (
                (
                    username === "dealsglobalhub" &&
                    (product?.links?.avinashbmv || product?.links?.avinashbmvINR)
                ) ||
                (
                    username !== "dealsglobalhub" &&
                    (link || shortUrl)
                )
            )
        ) ||
        (
            product.storeType === "Amazon" &&
            (product?.links?.avinashbmv && product?.productCode)
        )
    )
) {
    // if (product?.price > 0 && (product.storeType != "Amazon" (product?.links?.avinashbmv != "" || product?.links?.avinashbmvINR != "")) ) {
      // postflag = await firebasepost(product, access_token, env);
      postflag = await updateProduct(product?.productCode || product?.id, product, access_token, env);
      console.log("Postflag is ", postflag)
      // postflag = await firebasePut(product, access_token, env);
      if (postflag.status == 201) {
        // id+=1;
        len += 1;
        postStatus = productStatus.PRODUCT_CREATED;
        // i--;
      } else if (postflag.status == 200) {
        postStatus = productStatus.PRODUCT_UPDATED_SUCCESSFULLY;
      } else if (postflag.status == 301) {
        if(!constants.updateTodayDeals) {
          postflag = false;
          postStatus = productStatus.PRODUCT_POSTED_TODAY;
        } else {
          postStatus = productStatus.PRODUCT_UPDATED_TODAY;
        }
      } else {
        access_token = await getAccessToken(env);
        console.log("Regenerating access token");
        postflag = await firebasepost(product, access_token, env);
        if (postflag) {
          // id+=1;
          len += 1;
        } else {
          // console.log("Need to skip channel deals");
        }
      }
      // if (postflag && postProduct && !constants.updateTodayDeals) {
      if (postflag && postProduct) {
        postDeals(driver, product, link, shortUrl, username);
      }
      else {
        // console.log("Post Flag is false ",product?.links?.avinashbmv)
        logger.info(`\nPost Flag is ${postflag} or postProduct is ${postProduct} is  false for ${link} `, { functionName: 'getProductDetails' })
      }
    }
    else {
      logger.warn(`\nFirebase Post Invalid details: ${link}`, { functionName: 'getProductDetails' })

    }

    // productCounter++;
    return postStatus;
    // return postflag
  }
  catch (e) {
    logger.info("error in scheduler: ", e)
    return productStatus.PRODUCT_ERROR
  }
  // finally {
  // }
}

function sanitizeFirebaseKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = {};
  for (let key in obj) {
    // Replace all invalid Firebase key characters
    const safeKey = key.replace(/[.#$/[\]]/g, '_');
    sanitized[safeKey] = sanitizeFirebaseKeys(obj[key]);
  }
  return sanitized;
}

module.exports = {
  getProductDetails,
};
