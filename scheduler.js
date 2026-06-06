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
const missingDataRecoveryService = require("./services/missingDataRecoveryService");
const { executionTracker } = require("./services/executionTracker");


const logger = getModuleLogger('scheduler');

// let lastFetchTime = Date.now();
// const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
// let productCounter = 0;
// const PRODUCT_LIMIT = 30;

async function getProductDetails(driver, link, text = "", len = 0, access_token = "", data = {}, todayData = {}, postProduct=true, username, generateLink=false,shortUrl="", categoryOverride = null) {

  let postflag = false;
  let postStatus = "";
  let productCode, product, keyExist = false;
  try {

    const date = new Date();
    // Remove multiple firebaseget() calls - data should be passed from caller
    // if (len == 0 || data == {}) {
    //   data, len = await firebaseget();
    // }

    const currentTime = Date.now();
    // Remove multiple firebaseget() calls - todayData should be passed from caller
    // if (todayData == {}) {
    //   logger.info("Fetching today's data on product counter", { functionName: 'getProductDetails' });
    //   todayData, len = await firebaseget(true);
    // }
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
    
    if (product && categoryOverride) {
      if (!product.category) product.category = {};
      product.category = { ...product.category, ...categoryOverride };
      
      // Apply category override attributes to top-level product object
      product.categoryLevel1 = categoryOverride.categoryLevel1 || product.categoryLevel1 || '';
      product.categoryLevel2 = categoryOverride.categoryLevel2 || product.categoryLevel2 || '';
      product.categoryLevel3 = categoryOverride.categoryLevel3 || product.categoryLevel3 || '';
      product.subcategory1 = categoryOverride.subcategory1 || product.subcategory1 || '';
      product.subcategory2 = categoryOverride.subcategory2 || product.subcategory2 || '';
      product.productCategory = categoryOverride.productCategory || product.productCategory || '';
      product.productSubcategory = categoryOverride.productSubcategory || product.productSubcategory || '';
      product.productStyle = categoryOverride.productStyle || product.productStyle || '';
      product.categoryGroup = categoryOverride.categoryGroup || product.categoryGroup || '';
      
      if (!product.hierarchicalCategory) product.hierarchicalCategory = {};
      product.hierarchicalCategory.mainCategory = categoryOverride.mainCategory || product.hierarchicalCategory.mainCategory || '';
      product.hierarchicalCategory.subcategory = categoryOverride.subcategory || product.hierarchicalCategory.subcategory || '';
      product.hierarchicalCategory.style = categoryOverride.style || product.hierarchicalCategory.style || '';
      product.hierarchicalCategory.hierarchicalKey = categoryOverride.hierarchicalKey || product.hierarchicalCategory.hierarchicalKey || '';
      
      logger.info('Applied categoryOverride from queue/parameters to product details', { productCode: product.productCode || productCode, categoryGroup: product.categoryGroup });
    }
    
    // Check if product is excluded from Amazon Associates Program
    if (product.isExcluded) {
      logger.warn(`Product is excluded from Amazon Associates Program: ${link}`, { functionName: 'getProductDetails' });
      return productStatus.PRODUCT_EXCLUDED;
    }
    
    // Ensure productUrl is set to the resolved URL if not already set
    if (!product.productUrl) {
      product.productUrl = link;
    }
    
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
    // Mark source type for downstream consumers
    product.sourceType = (username ? 'telegram' : 'website');
    product.shortText = shortenProductText(product?.urltext);
    
    // Handle out-of-stock products
    if (product.stockStatus && product.stockStatus.includes("OUT OF STOCK")) {
        product.isOutOfStock = true;
        product.price = product.price || "0"; // Set price to 0 if not available
        logger.info(`[${product.storeType}] Out-of-stock product detected: ${product.title?.substring(0, 50)}...`, { functionName: 'getProductDetails' });
    } else {
        product.isOutOfStock = false;
    }
    
    if(product?.category?.mainCategory === "") {
      product.category.mainCategory = product?.category?.c1;
    }

    // Check for missing critical data and attempt recovery
    if (missingDataRecoveryService.isMissingCriticalData(product)) {
      logger.info('Product missing critical data, attempting recovery', {
        productCode: product.productCode || product.id,
        missingFields: {
          title: !product.title,
          brand: !product.brand,
          price: !product.price,
          photo: !product.photo
        }
      });
      
      try {
        product = await missingDataRecoveryService.recoverMissingData(product, driver);
        
        if (product.dataRecovered) {
          logger.info('Successfully recovered missing data', {
            productCode: product.productCode || product.id,
            recoverySource: product.recoverySource
          });
        }
      } catch (error) {
        logger.error('Failed to recover missing data', {
          productCode: product.productCode || product.id,
          error: error.message
        });
      }
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

  // Generate fallback affiliate link for Amazon if both links are empty
  if (product.storeType === "Amazon" && product?.productCode) {
    if (!product.links) product.links = {};
    
    // If both avinashbmv and avinashbmvINR are empty, generate fallback
    const hasAvinashbmv = product.links.avinashbmv && product.links.avinashbmv.trim() !== "";
    const hasAvinashbmvINR = product.links.avinashbmvINR && product.links.avinashbmvINR.trim() !== "";
    
    if (!hasAvinashbmv && !hasAvinashbmvINR) {
      // Create fallback affiliate link using productCode
      const fallbackLink = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
      product.links.avinashbmv = "";
      product.links.avinashbmvINR = fallbackLink;
      logger.info(`Generated fallback Amazon affiliate link for ${product.productCode} (both links were empty) - assigned to avinashbmvINR`, { 
        functionName: 'getProductDetails',
        productCode: product.productCode
      });
    }
  }

  const hasImage = product?.photo || (Array.isArray(product?.images) && product.images.length > 0) || (typeof product?.images === 'string' && product.images.length > 0);
  const hasValidPriceOrStock = product?.price > 0 || (product?.stockStatus && product?.stockStatus.includes("OUT OF STOCK"));

  if (
    hasValidPriceOrStock &&
    hasImage &&
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
            (product?.productCode && (product?.links?.avinashbmv || product?.productUrl))
        )
    )
) {
    // if (product?.price > 0 && (product.storeType != "Amazon" (product?.links?.avinashbmv != "" || product?.links?.avinashbmvINR != "")) ) {
      // postflag = await firebasepost(product, access_token, env);
      // Telegram flow -> deals node
      postflag = await updateProduct(
        product?.productCode || product?.id,
        product,
        access_token,
        env,
        'deals'
      );
      console.log("Postflag is ", postflag)
      // postflag = await firebasePut(product, access_token, env);
      if (postflag.status == 201) {
        // Increment count locally instead of calling firebaseget()
        len += 1;
        postStatus = productStatus.PRODUCT_CREATED;
        // Track Telegram execution if from Telegram
        if (product.sourceType === 'telegram' && product.storeType) {
          try {
            await executionTracker.updateTelegramProductProgress(product.storeType, 'created', product.productCode);
          } catch (trackErr) {
            logger.warn('Telegram progress tracking failed', { error: trackErr?.message });
          }
        }
        // i--;
      } else if (postflag.status == 200) {
        postStatus = productStatus.PRODUCT_UPDATED_SUCCESSFULLY;
        // Track Telegram execution if from Telegram
        if (product.sourceType === 'telegram' && product.storeType) {
          try {
            await executionTracker.updateTelegramProductProgress(product.storeType, 'updated', product.productCode);
          } catch (trackErr) {
            logger.warn('Telegram progress tracking failed', { error: trackErr?.message });
          }
        }
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
          // Increment count locally instead of calling firebaseget()
          len += 1;
        } else {
          // console.log("Need to skip channel deals");
        }
      }
      // if (postflag && postProduct && !constants.updateTodayDeals) {
      if (postflag && postProduct) {
        try {
          await postDeals(driver, product, link, shortUrl, username);
        } catch (postErr) {
          logger.warn('postDeals failed (product already saved)', { error: postErr?.message, link });
        }
      }
      else {
        // console.log("Post Flag is false ",product?.links?.avinashbmv)
        logger.info(`\nPost Flag is ${postflag} or postProduct is ${postProduct} is  false for ${link} `, { functionName: 'getProductDetails' })
      }
    }
    else {
      logger.error(`\n[VALIDATION FAILED] Product blocked from DB insertion: ${link}`, { 
        functionName: 'getProductDetails',
        productUrl: link,
        searchUrl: shortUrl || link,
        productCode: product?.productCode,
        storeType: product?.storeType,
        price: product?.price,
        hasPrice: !!(product?.price > 0),
        hasImage: !!hasImage,
        hasAffiliateLink: !!(product?.links?.avinashbmv),
        hasAffiliateLinkINR: !!(product?.links?.avinashbmvINR),
        hasProductUrl: !!product?.productUrl,
        username: username,
        validationReason: !hasValidPriceOrStock 
          ? 'Missing price or invalid stock status' 
          : !hasImage 
            ? 'Missing product image (photo/images)'
            : product.storeType === "Amazon" 
              ? (!product?.productCode ? 'Missing productCode' : (!product?.links?.avinashbmv && !product?.productUrl ? 'Missing affiliate link and productUrl' : 'Other Amazon validation issue'))
              : product.storeType !== "Amazon"
                ? (username === "dealsglobalhub" ? (!product?.links?.avinashbmv && !product?.links?.avinashbmvINR ? 'Missing affiliate links' : 'Other non-Amazon validation issue') : (!link && !shortUrl ? 'Missing link or shortUrl' : 'Other validation issue'))
                : 'Unknown validation failure'
      });

      // Validation failed, so it's an error
      postStatus = productStatus.PRODUCT_ERROR;
    }

    // productCounter++;
    return postStatus;
    // return postflag
  }
  catch (e) {
    logger.info("error in scheduler: ", e)
    // Track Telegram execution error if from Telegram
    if (product && product.sourceType === 'telegram' && product.storeType) {
      try {
        await executionTracker.updateTelegramProductProgress(product.storeType, 'failed', product.productCode);
      } catch (trackErr) {
        logger.warn('Telegram failure tracking failed', { error: trackErr?.message });
      }
    }
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
