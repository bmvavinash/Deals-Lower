const amazonConfig = require("../config/amazonConfig");
const flipkartConfig = require("../config/flipkartConfig");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
// const { getExtrapeUrl } = require("../affiliate/extrapeUrlGenerator");
const { By, Key, Builder, Button, until } = require("selenium-webdriver");
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode, decodeHtmlEntities } = require("../utils/commonUtils");
// const { getExtrapeUrl } = require("../affiliate/extrape"); // Replaced with amazonLinkGenerator
const ajioConfig = require("../config/ajioConfig");
const myntraConfig = require("../config/myntraConfig");
const { decode } = require('html-entities');
const { getModuleLogger } = require("../logger/logger");
const { determineHierarchy } = require("../utils/categoryHierarchy");

const logger = getModuleLogger('amazon');

async function scrapeProduct(url, platform, driver, text = "", keyExist = false, username, generateLink = false, shortUrl = "") {
  // Load the appropriate config
  const config = platform === "amazon" ? amazonConfig : platform === "flipkart" ? flipkartConfig : platform === "ajio" ? ajioConfig : platform === "myntra" ? myntraConfig : null;
  if (!config) {
    logger.error(`Config for ${platform} is missing`);
    return {};
  }

  let product = {};
  try {
    logger.info(`[${platform}] Starting product scraping for URL: ${url}`);
    
    // Extract basic product information with proper error handling
    try { 
      const brandValue = await extractAttribute(driver, config?.brand);
      product.brand = brandValue ? String(brandValue) : "";
    } catch (e) { logger.error(`[${platform}] brand error:`, { error: e.message, stack: e.stack }); product.brand = ""; }
    try { 
      const titleValue = await extractAttribute(driver, config?.title);
      product.title = titleValue ? String(titleValue) : "";
    } catch (e) { logger.error(`[${platform}] title error:`, { error: e.message, stack: e.stack }); product.title = ""; }
    try { 
      const priceValue = await extractAttribute(driver, config.price);
      product.price = priceValue ? String(priceValue) : "";
    } catch (e) { logger.error(`[${platform}] price error:`, { error: e.message, stack: e.stack }); product.price = ""; }
    try { 
      const discountValue = await extractAttribute(driver, config.discount);
      const rawDiscount = discountValue ? String(discountValue) : "";
      const trimmedDiscount = rawDiscount.replace(/\s+/g, ' ').trim();
      product.discount = trimmedDiscount;

      // Determine numeric value after stripping non-digits
      const numericString = trimmedDiscount.replace(/[^\d.-]/g, '');
      const discountNumeric = numericString === "" ? NaN : parseFloat(numericString);

      if (trimmedDiscount === "" || isNaN(discountNumeric)) {
        // Explicitly log when discount is missing, empty, or not numeric
        logger.error(`[${platform}] Discount missing or invalid`, { code: 'DISCOUNT_MISSING', discountRaw: rawDiscount, url: url });
      } else if (discountNumeric > 100) {
        logger.warn(`[${platform}] High discount value detected`, { 
          code: 'DISCOUNT_HIGH',
          discount: trimmedDiscount, 
            numericValue: discountNumeric,
            url: url 
          });
        }
    } catch (e) { logger.error(`[${platform}] discount error`, { code: 'DISCOUNT_ERROR', error: e.message, stack: e.stack, url }); product.discount = ""; }
    try { 
      const mrpValue = await extractAttribute(driver, config?.mrp);
      product.mrp = mrpValue ? String(mrpValue) : "";
    } catch (e) { logger.error(`[${platform}] mrp error:`, { error: e.message, stack: e.stack }); product.mrp = ""; }
    try { 
      const ratingValue = await extractAttribute(driver, config?.rating);
      product.rating = ratingValue ? String(ratingValue) : "";
    } catch (e) { logger.error(`[${platform}] rating error:`, { error: e.message, stack: e.stack }); product.rating = ""; }
    try { 
      const ratingsCountValue = await extractAttribute(driver, config?.ratingsCount);
      product.ratingsCount = ratingsCountValue ? String(ratingsCountValue) : "";
    } catch (e) { logger.error(`[${platform}] ratingsCount error:`, { error: e.message, stack: e.stack }); product.ratingsCount = ""; }
    try { 
      const reviewsCountValue = await extractAttribute(driver, config?.reviewsCount);
      product.reviewsCount = reviewsCountValue ? String(reviewsCountValue) : "";
    } catch (e) { logger.error(`[${platform}] reviewsCount error:`, { error: e.message, stack: e.stack }); product.reviewsCount = ""; }
    try { 
      const colorValue = await extractAttribute(driver, config?.color);
      product.color = colorValue ? String(colorValue) : "";
    } catch (e) { logger.error(`[${platform}] color error:`, { error: e.message, stack: e.stack }); product.color = ""; }
    
    // Platform-specific attributes
    // Flipkart-specific: flipkartAssure
    if (platform === "flipkart") {
      try { 
        const flipkartAssureValue = await extractAttribute(driver, config?.flipkartAssure);
        product.flipkartAssure = flipkartAssureValue ? String(flipkartAssureValue) : "";
      } catch (e) { logger.error(`[${platform}] flipkartAssure error:`, { error: e.message, stack: e.stack }); product.flipkartAssure = ""; }
    }
    
    // Amazon-specific: asin
    if (platform === "amazon") {
      try { 
        const asinValue = await extractAttribute(driver, config?.asin);
        product.asin = asinValue ? String(asinValue) : "";
      } catch (e) { logger.error(`[${platform}] asin error:`, { error: e.message, stack: e.stack }); product.asin = ""; }
      
      // Amazon-specific: deal progress
      try { 
        const dealProgressValue = await extractAttribute(driver, config?.dealProgress);
        product.dealProgress = dealProgressValue ? String(dealProgressValue) : "";
      } catch (e) { logger.error(`[${platform}] dealProgress error:`, { error: e.message, stack: e.stack }); product.dealProgress = ""; }
    } else {
      product.asin = "";
      product.dealProgress = "";
    }
    
    // Common attributes for all platforms
    try { 
      const extraOffersValue = await extractAttribute(driver, config?.extraOffers);
      product.extraOffers = extraOffersValue ? String(extraOffersValue) : "";
    } catch (e) { logger.error(`[${platform}] extraOffers error:`, { error: e.message, stack: e.stack }); product.extraOffers = ""; }
    try { 
      const sizeFitValue = await extractAttribute(driver, config?.sizeFit);
      product.sizeFit = sizeFitValue ? String(sizeFitValue) : "";
    } catch (e) { logger.error(`[${platform}] sizeFit error:`, { error: e.message, stack: e.stack }); product.sizeFit = ""; }
    try { 
      const materialCareValue = await extractAttribute(driver, config?.materialCare);
      product.materialCare = materialCareValue ? String(materialCareValue) : "";
    } catch (e) { logger.error(`[${platform}] materialCare error:`, { error: e.message, stack: e.stack }); product.materialCare = ""; }
    try { 
      const sellerValue = await extractAttribute(driver, config?.seller);
      product.seller = sellerValue ? String(sellerValue) : "";
    } catch (e) { logger.error(`[${platform}] seller error:`, { error: e.message, stack: e.stack }); product.seller = ""; }
    
    // Timer extraction with platform-specific handling
    try {
      if (platform === "flipkart" && Array.isArray(config.timer)) {
        // Extract all timer spans and join them
        let timerElements = await driver.findElements(By.css('.mSzn2o .E2lCdq span:not(.DWia7o)'));
        let timerParts = [];
        for (let el of timerElements) {
          let text = (await el.getText()).trim();
          if (text) timerParts.push(text);
        }
        product.timer = timerParts.length > 0 ? timerParts.join(' ') : "";
        logger.debug(`[${platform}] Timer extracted: ${product.timer}`);
      } else {
        const timerValue = await extractAttribute(driver, config?.timer);
        product.timer = timerValue ? String(timerValue) : "";
      }
    } catch (e) { logger.error(`[${platform}] timer error:`, { error: e.message, stack: e.stack }); product.timer = ""; }

    // Product code extraction based on platform
    if (platform === "amazon") {
      product.productCode = getAsin(url) || "";
    } else if (platform === "flipkart") {
      try {
        product.productCode = getFlipkartProductId(url) || "";
      } catch (e) { logger.error(`[${platform}] productCode error:`, { error: e.message, stack: e.stack }); product.productCode = ""; }
    } else if (platform === "ajio") {
      product.productCode = getAjioCode(url);
    } else if (platform === "myntra") {
      product.productCode = getMyntraCode(url);
    }
    logger.debug(`[${platform}] Product code extracted: ${product.productCode}`);

    // Myntra special image handling (background-image style)
    if (platform === "myntra") {
      try { 
        const imageElement = await extractAttribute(driver, config?.photo);
        if (imageElement) {
          try { 
            const match = imageElement.match(/url\(['"]?(.*?)['"]?\)/);
            product.photo = match ? match[1] : ""; 
          } catch (e) { logger.error(`[${platform}] Image Extract Error:`, { error: e.message, stack: e.stack }); product.photo = ""; }
        } else {
          product.photo = "";
        }
      } catch (e) { logger.error(`[${platform}] photo error:`, { error: e.message, stack: e.stack }); product.photo = ""; }
    } else {
      try { 
        const photoValue = await extractAttribute(driver, config?.photo);
        product.photo = photoValue ? String(photoValue) : "";
      } catch (e) { logger.error(`[${platform}] photo error:`, { error: e.message, stack: e.stack }); product.photo = ""; }
    }

    try { product.urltext = await safeExtract(driver, config?.productText); } catch (e) { logger.error(`[${platform}] urltext error:`, { error: e.message, stack: e.stack }); product.urltext = ""; }
    product.productText = text || "";
    
    // Extract multiple elements with error handling
    try { product.images = await extractMultiple(driver, config?.images); } catch (e) { logger.error(`[${platform}] images error:`, { error: e.message, stack: e.stack }); product.images = []; }
    try { product.sizes = await extractMultiple(driver, config?.sizes); } catch (e) { logger.error(`[${platform}] sizes error:`, { error: e.message, stack: e.stack }); product.sizes = []; }
    try { product.specifications = await extractMultiple(driver, config?.specifications); } catch (e) { logger.error(`[${platform}] specifications error:`, { error: e.message, stack: e.stack }); product.specifications = {}; }
    
    // Amazon-specific: productTable
    if (platform === "amazon") {
      try { product.productTable = await extractMultiple(driver, config?.productTable); } catch (e) { logger.error(`[${platform}] productTable error:`, { error: e.message, stack: e.stack }); product.productTable = {}; }
    } else {
      product.productTable = {};
    }
    
    // Common attributes for all platforms
    try { product.promoInfo = await extractMultiple(driver, config?.promoInfo); } catch (e) { logger.error(`[${platform}] promoInfo error:`, { error: e.message, stack: e.stack }); product.promoInfo = []; }
    try { product.coupon = await extractMultiple(driver, config?.coupon); } catch (e) { logger.error(`[${platform}] coupon error:`, { error: e.message, stack: e.stack }); product.coupon = []; }
    
    // Description extraction with fallback logic
    try {
      let desc = await extractMultiple(driver, config?.description);
      if (!desc || (Array.isArray(desc) && desc.length === 0)) {
        // Fallback: try old logic (single string extraction)
        let fallbackDesc = await extractAttribute(driver, config?.description);
        product.description = fallbackDesc ? [fallbackDesc] : [];
        logger.warn(`[${platform}] Fallback to old description extraction logic.`);
      } else {
        product.description = desc;
      }
    } catch (e) {
      logger.error(`[${platform}] description error:`, { error: e.message, stack: e.stack });
      product.description = [];
    }

    // Category extraction (only if keyExist is false)
    if (!keyExist) {
      product.category = {};
      if (platform === "flipkart") {
        try { product.category.mainCategory = await safeExtract(driver, config?.category, true); } catch (e) { logger.error(`[${platform}] mainCategory error:`, { error: e.message, stack: e.stack }); product.category.mainCategory = ""; }
      } else {
        try { product.category.mainCategory = await safeExtract(driver, config?.category?.mainCategory, true); } catch (e) { logger.error(`[${platform}] mainCategory error:`, { error: e.message, stack: e.stack }); product.category.mainCategory = ""; }
      }
      try { product.category.c1 = await safeExtract(driver, config?.category?.c1, true); } catch (e) { logger.error(`[${platform}] category.c1 error:`, { error: e.message, stack: e.stack }); product.category.c1 = ""; }
      try { product.category.c2 = await safeExtract(driver, config?.category?.c2, true); } catch (e) { logger.error(`[${platform}] category.c2 error:`, { error: e.message, stack: e.stack }); product.category.c2 = ""; }
      try { product.category.c3 = await safeExtract(driver, config?.category?.c3, true); } catch (e) { logger.error(`[${platform}] category.c3 error:`, { error: e.message, stack: e.stack }); product.category.c3 = ""; }
      try { product.category.c4 = await safeExtract(driver, config?.category?.c4, true); } catch (e) { logger.error(`[${platform}] category.c4 error:`, { error: e.message, stack: e.stack }); product.category.c4 = ""; }
      try { product.category.c5 = await safeExtract(driver, config?.category?.c5, true); } catch (e) { logger.error(`[${platform}] category.c5 error:`, { error: e.message, stack: e.stack }); product.category.c5 = ""; }
      try { product.category.c6 = await safeExtract(driver, config?.category?.c6, true); } catch (e) { logger.error(`[${platform}] category.c6 error:`, { error: e.message, stack: e.stack }); product.category.c6 = ""; }

      // Detailed description extraction (only for Amazon)
      if (platform === "amazon") {
        product.description = {};
        try { product.description.d1 = await safeExtract(driver, config?.description?.d1); } catch (e) { logger.error(`[${platform}] description.d1 error:`, { error: e.message, stack: e.stack }); product.description.d1 = ""; }
        try { product.description.d2 = await safeExtract(driver, config?.description?.d2); } catch (e) { logger.error(`[${platform}] description.d2 error:`, { error: e.message, stack: e.stack }); product.description.d2 = ""; }
        try { product.description.d3 = await safeExtract(driver, config?.description?.d3); } catch (e) { logger.error(`[${platform}] description.d3 error:`, { error: e.message, stack: e.stack }); product.description.d3 = ""; }
        try { product.description.d4 = await safeExtract(driver, config?.description?.d4); } catch (e) { logger.error(`[${platform}] description.d4 error:`, { error: e.message, stack: e.stack }); product.description.d4 = ""; }
        try { product.description.d5 = await safeExtract(driver, config?.description?.d5); } catch (e) { logger.error(`[${platform}] description.d5 error:`, { error: e.message, stack: e.stack }); product.description.d5 = ""; }
        try { product.description.d6 = await safeExtract(driver, config?.description?.d6); } catch (e) { logger.error(`[${platform}] description.d6 error:`, { error: e.message, stack: e.stack }); product.description.d6 = ""; }
        try { product.description.d7 = await safeExtract(driver, config?.description?.d7); } catch (e) { logger.error(`[${platform}] description.d7 error:`, { error: e.message, stack: e.stack }); product.description.d7 = ""; }
        try { product.description.d8 = await safeExtract(driver, config?.description?.d8); } catch (e) { logger.error(`[${platform}] description.d8 error:`, { error: e.message, stack: e.stack }); product.description.d8 = ""; }
        try { product.description.d9 = await safeExtract(driver, config?.description?.d9); } catch (e) { logger.error(`[${platform}] description.d9 error:`, { error: e.message, stack: e.stack }); product.description.d9 = ""; }
      }
    }

    // Robust offers extraction: try all selectors in config.offers in order, return first non-empty
    let offersExtracted = false;
    if (platform === "myntra" && Array.isArray(config.offers)) {
      try {
        // Always extract all offers for Myntra using extractCssOffers
        logger.info(`[${platform}] Extracting Myntra offers...`);
        const offers = await extractCssOffers(driver, config.offers);
        product.offers = Array.isArray(offers) ? offers : [];
        logger.info(`[${platform}] Myntra offers extracted: ${product.offers.length}`);
        // Do NOT set offersExtracted or overwrite product.offers for Myntra
      } catch (e) {
        logger.error(`[${platform}] Error extracting Myntra offers:`, { error: e.message, stack: e.stack });
        product.offers = [];
      }
    } else if (Array.isArray(config.offers)) {
      for (const offerConfig of config.offers) {
        try {
          let offers = [];
          if (offerConfig.type === 'css-bankoffers') {
            offers = await extractBankOffers(driver, [offerConfig]);
          } else if (offerConfig.type === 'css-offers') {
            offers = await extractCssOffers(driver, [offerConfig]);
          }
          if (offers && offers.length > 0) {
            product.offers = offers;
            offersExtracted = true;
            logger.info(`[${platform}] Offers extracted successfully: ${offers.length} offers`);
            break;
          }
        } catch (e) { logger.error(`[${platform}] offers error:`, { error: e.message, stack: e.stack }); }
      }
      if (!offersExtracted) product.offers = [];
    }

    // Robust description extraction: try all selectors in config.description in order, return first non-empty
    let descExtracted = false;
    if (Array.isArray(config.description)) {
      for (const descConfig of config.description) {
        try {
          const desc = await extractMultiple(driver, [descConfig]);
          if (desc && desc.length > 0) {
            product.description = desc;
            descExtracted = true;
            break;
          }
        } catch (e) { logger.error(`[${platform}] description error:`, { error: e.message, stack: e.stack }); }
      }
    }
    if (!descExtracted) product.description = [];

    try {
      if (platform === "amazon" && config.coupon) {
        product.coupon = await extractMultiple(driver, config.coupon) || [];
      }
    } catch (e) { logger.error(`[${platform}] coupon error:`, { error: e.message, stack: e.stack }); product.coupon = []; }

    // --- URL Generation: always generate product.links ---
    if (!product.links) product.links = {};
        try {
          if (username?.includes("dealsglobalhub")) {
            if (platform === "amazon") {
              try {
                const amazonLink = await amazonLinkGenerator(driver);
                if (amazonLink === "") {
                  // Check if this is due to excluded product
                  try {
                    const excludedProductAlert = await driver.findElement(By.css(".amzn-ss-asin-alert-text-content"));
                    if (excludedProductAlert) {
                      logger.warn(`[${platform}] Product is excluded from Amazon Associates Program`);
                      product.links.avinashbmv = "";
                      product.links.avinashbmvINR = "";
                      product.isExcluded = true; // Add flag to indicate excluded product
                    } else {
                      // Link generation failed but not excluded - use fallback with productCode
                      if (product.productCode) {
                        const fallbackLink = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
                        product.links.avinashbmv = "";
                        product.links.avinashbmvINR = fallbackLink;
                        logger.info(`[${platform}] Using fallback Amazon URL with productCode: ${product.productCode}`);
                      } else {
                        product.links.avinashbmv = "";
                        product.links.avinashbmvINR = "";
                      }
                    }
                  } catch (excludedCheckError) {
                    // No excluded product alert, use fallback with productCode if available
                    if (product.productCode) {
                      const fallbackLink = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
                      product.links.avinashbmv = "";
                      product.links.avinashbmvINR = fallbackLink;
                      logger.info(`[${platform}] Using fallback Amazon URL with productCode: ${product.productCode}`);
                    } else {
                      product.links.avinashbmv = "";
                      product.links.avinashbmvINR = "";
                    }
                  }
                } else {
                  product.links.avinashbmv = amazonLink || "";
                  product.links.avinashbmvINR = "";
                }
              } catch (e) { 
                logger.error(`[${platform}] Amazon link generation error:`, { error: e.message, stack: e.stack });
                // On error, try fallback with productCode
                if (product.productCode) {
                  const fallbackLink = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
                  product.links.avinashbmv = "";
                  product.links.avinashbmvINR = fallbackLink;
                  logger.info(`[${platform}] Using fallback Amazon URL after error: ${product.productCode}`);
                }
              }
            } else {
              try {
                // Non-Amazon products: store inrdeals.com link in avinashbmvINR
                product.links.avinashbmvINR = "https://inrdeals.com/avi646476329/" + url;
                if (generateLink) {
                  // Generate shortlink using extrape for non-Amazon
                  const { getExtrapeUrl } = require("../affiliate/extrape");
                  product.links.avinashbmv = await getExtrapeUrl(driver, url) || "";
                } else {
                  product.links.avinashbmv = shortUrl || "";
                }
              } catch (e) { logger.error(`[${platform}] Non-Amazon link generation error:`, { error: e.message, stack: e.stack }); }
            }
          } else {
            // For non-dealsglobalhub users, use username-based storage
            if (username) {
              product.links[username] = shortUrl || "";
            }
            try { 
              if (platform === "amazon") {
                // For Amazon: set avinashbmvINR to clean affiliate URL
                if (product.productCode) {
                  product.links.avinashbmvINR = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
                }
                const amazonLink = await amazonLinkGenerator(driver);
                if (amazonLink) {
                  product.links.avinashbmv = amazonLink;
                } else {
                  product.links.avinashbmv = "";
                }
                logger.info(`[${platform}] Set Amazon affiliate URL for non-dealsglobalhub user: ${product.productCode}`);
              } else {
                // For non-Amazon: set avinashbmvINR to inrdeals.com URL
                product.links.avinashbmvINR = "https://inrdeals.com/avi646476329/" + url;
                // Make Extrape URL generation non-blocking with timeout
                const { getExtrapeUrl } = require("../affiliate/extrape");
                try {
                  const extrapePromise = getExtrapeUrl(driver, url, 25000); // 25 second timeout
                  product.links.avinashbmv = await Promise.race([
                    extrapePromise,
                    new Promise((resolve) => setTimeout(() => resolve(""), 25000))
                  ]) || "";
                  if (!product.links.avinashbmv) {
                    logger.warn(`[${platform}] Extrape URL generation timed out or failed - continuing without it`);
                  }
                } catch (extrapeError) {
                  logger.warn(`[${platform}] Extrape URL generation error:`, { error: extrapeError.message });
                  product.links.avinashbmv = "";
                }
              }
            } catch (e) { 
              logger.error(`[${platform}] Link generation error:`, { error: e.message, stack: e.stack });
              // Fallback for Amazon on error
              if (platform === "amazon" && product.productCode) {
                const fallbackLink = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
                product.links.avinashbmv = "";
                product.links.avinashbmvINR = fallbackLink;
                logger.info(`[${platform}] Using fallback Amazon URL after error: ${product.productCode}`);
              } else if (platform !== "amazon") {
                // For non-Amazon: set inrdeals.com URL
                product.links.avinashbmvINR = "https://inrdeals.com/avi646476329/" + url;
              }
            }
          }
    } catch (e) { logger.error(`[${platform}] Error in link generation:`, { error: e.message, stack: e.stack }); }

    logger.info(`[${platform}] Product scraping completed successfully`, { 
      productCode: product.productCode, 
      title: product.title?.substring(0, 50) + '...',
      price: product.price,
      offersCount: product.offers?.length || 0
    });

    const hierarchyInfo = determineHierarchy(product.category, product.title, product.brand);
    product.hierarchicalCategory = hierarchyInfo.hierarchicalCategory;
    product.hierarchicalKey = hierarchyInfo.hierarchicalKey;

    return product;
  } catch (e) { logger.error(`[${platform}] Error in scrap Product:`, { error: e.message, stack: e.stack, url }); }
}

async function extractAttribute(driver, attributeConfig) {
  let lastConfig = null; // Track only the final failed config if all fail

  try {
    for (let config of attributeConfig) {
      try {
        let element;
        // console.log("selector is ",config.selector)
        if (config.type === "xpath") {
          element = await driver.findElement(By.xpath(config.selector));
        } else if (config.type === "id") {
          element = await driver.findElement(By.id(config.selector));
        } else if (config.type === "className") {
          element = await driver.findElement(By.className(config.selector));
        } else if (config.type === "css") {
          element = await driver.findElement(By.css(config.selector));
        }
        // let element = await driver.findElement(By[type](selector)); // check later #todo
        const attributeToExtract = config.attribute || "innerHTML";
        let rawValue = await element.getAttribute(attributeToExtract);

        // Use validator directly from utils
        const validatorFn = config.validator || config.validate;
        if (validatorFn) {
          const validationResult = validatorFn(rawValue);
          if (!validationResult.isValid) {
            lastConfig = config; // Update lastConfig for the failed config
            // if(config.) //#ToDo for logging only for last config Path
            // console.log("Validation failed for:", config?.selector, config?.links);
            continue; // Skip to the next selector if validation fails
          }
          return validationResult.value; // Use modified value
        }
        // if (config.type === "id") {
        //   console.log();
        // }

        return rawValue.trim(); // Return raw value if no validator is provided
      } catch (error) {
        lastConfig = config; // Update lastConfig for the failed config
        // if (config.type === "id") {
        //   console.log("Error is ", error);
        // }
        // console.log("Error finding element or validating:", config.selector, error);
        // Optionally log the error or handle it as needed
      }
    }
  }
  catch (e) {
    // console.log("Error in attribute config ", e)
  }

  // Log information only for the last config after the loop
  // if (lastConfig) {
  // console.log("Validation failed for the last config:", lastConfig?.selector, config?.links);
  // } else {
  // console.log("All xpaths failed or validation failed for all xpaths."); // #ToDo Need to remove
  // }
  return ""; // Return empty string instead of null
}

async function safeExtract(driver, configPath, removeAllSpaces = false) {
  try {
    const val = await extractAttribute(driver, configPath);
    const decoded = decodeHtmlEntities(val || "");

    let cleaned = decoded.replace(/\s+/g, ' ').trim(); // normalize spaces

    if (removeAllSpaces) {
      cleaned = cleaned.replace(/\s+/g, ''); // remove all spaces
    }

    return cleaned;
  } catch (e) {
    console.log(`${configPath} error`);
    return "";
  }
}

async function extractMultiple(driver, config) {
  if (!Array.isArray(config)) {
    logger.warn("extractMultiple: config is not iterable", { config });
    // Fallback: If config is for description, try old logic (single string extraction)
    if (config && (config.type === 'css' || config.type === 'xpath')) {
      try {
        let val = await extractAttribute(driver, [config]);
        if (val) return [val];
      } catch (e) {
        logger.error('extractMultiple fallback error:', { error: e.message, stack: e.stack });
      }
    }
    return (config && config.type === 'css-table') ? {} : [];
  }
  for (let c of config) {
    try {
      if (c.multiple && c.attribute) {
        // For images
        let elements = await driver.findElements(By.css(c.selector));
        logger.debug(`[extractMultiple] Images selector: ${c.selector}, Found: ${elements.length}`);
        let values = [];
        if (c.type === 'css-background-image') {
          // Special handling: extract only the URL from background-image style
          for (let el of elements) {
            let style = await el.getAttribute(c.attribute);
            if (style) {
              // Extract URL from: background-image: url("...");
              let match = style.match(/background-image:\s*url\(["']?(.*?)["']?\)/i);
              if (match && match[1]) values.push(match[1]);
            }
          }
        } else {
          for (let el of elements) {
            let val = await el.getAttribute(c.attribute);
            if (val) values.push(val);
          }
        }
        logger.debug(`[extractMultiple] Images extracted: ${values.length}`);
        if (values.length > 0) return values;
      } else if (c.type === "css-list") {
        // For description
        let elements = await driver.findElements(By.css(c.selector));
        let values = [];
        for (let el of elements) {
          let text = (await el.getText()).trim();
          if (text) values.push(text);
        }
        if (values.length > 0) return values;
      } else if (c.type === "css-table") {
        // For productTable
        let rows = await driver.findElements(By.css(c.selector));
        let table = {};
        for (let row of rows) {
          try {
            let keyEl = await row.findElement(By.css(c.keySelector));
            let valueEl = await row.findElement(By.css(c.valueSelector));
            let key = (await keyEl.getText()).trim();
            let value = (await valueEl.getText()).trim();
            if (key && value) table[key] = value;
          } catch (e) {}
        }
        if (Object.keys(table).length > 0) return table;
      } else if (c.type === "css") {
        // For single text content
        let elements = await driver.findElements(By.css(c.selector));
        for (let el of elements) {
          let text = (await el.getText()).trim();
          if (text) return [text];
        }
      }
    } catch (e) {
      // Log and continue
      logger.error('extractMultiple error:', { error: e.message, stack: e.stack, selector: c.selector });
    }
  }
  return (config && config[0] && config[0].type === 'css-table') ? {} : [];
}

async function extractBankOffers(driver, offersConfig) {
  for (let config of offersConfig) {
    if (config.type === "css-bankoffers") {
      let offerCards = await driver.findElements(By.css(config.selector));
      logger.info(`Found ${offerCards.length} offer cards with selector: ${config.selector}`);
      let offers = [];
      for (let card of offerCards) {
        let offerType = "";
        let offerContent = "";
        try {
          let h6 = await card.findElement(By.css(config.offerTypeSelector));
          offerType = (await h6.getText()).trim();
          logger.debug(`Offer type found: "${offerType}"`);
        } catch (e) {
          // logger.error(`Error finding offer type:`, { error: e.message, stack: e.stack });
        }
        try {
          let contentFull = await card.findElement(By.css(config.offerContentSelectorFull));
          logger.debug(`Found content element with selector: ${config.offerContentSelectorFull}`);
          offerContent = (await contentFull.getText()).trim();
          logger.debug(`Offer content (full) found: "${offerContent}"`);
          if (!offerContent) {
            // Try innerText if getText() returns empty
            offerContent = (await contentFull.getAttribute('innerText')).trim();
            logger.debug(`Offer content (innerText) found: "${offerContent}"`);
          }
        } catch (e) {
          // logger.error(`Error finding full content:`, { error: e.message, stack: e.stack });
          try {
            let contentCut = await card.findElement(By.css(config.offerContentSelectorCut));
            offerContent = (await contentCut.getText()).trim();
            logger.debug(`Offer content (cut) found: "${offerContent}"`);
          } catch (e2) {
            // logger.error(`Error finding cut content:`, { error: e2.message, stack: e2.stack });
            // Try alternative approach - get all text from the content area
            try {
              let contentArea = await card.findElement(By.css(".offers-items-content"));
              offerContent = (await contentArea.getText()).trim();
              logger.debug(`Offer content (area) found: "${offerContent}"`);
            } catch (e3) {
              // logger.error(`Error finding content area:`, { error: e3.message, stack: e3.stack });
            }
          }
        }
        if (offerType && offerContent) {
          // Classify as EMI or non-EMI
          let isEmi = /emi/i.test(offerType) || /emi/i.test(offerContent);
          offers.push({
            type: offerType,
            content: offerContent,
            emi: isEmi ? 'emi' : 'non-emi'
            
          });
        } else if (offerType || offerContent) {
          // Push partial offers if at least one is present
          logger.warn('Partial offer extracted:', { offerType, offerContent });
          offers.push({
            type: offerType || '',
            content: offerContent || '',
            emi: (/emi/i.test((offerType || '') + (offerContent || ''))) ? 'emi' : 'non-emi'
          });
        } else {
          // Log if both are missing
          let cardHtml = await card.getAttribute('outerHTML');
          logger.warn('Empty offer card HTML:', { cardHtml: cardHtml.substring(0, 200) + '...' });
          logger.warn('Empty offer card:', { offerType, offerContent });
        }
      }
      if (offers.length > 0) {
        return offers;
      } else {
        logger.warn(`[extractBankOffers] No offers extracted from ${offerCards.length} offer cards`);
      }
    }
  }
  logger.warn(`[extractBankOffers] No offers found with any configuration`);
  return [];
}

// Add this function for css-offers extraction (Flipkart, Ajio, Myntra, etc.)
async function extractCssOffers(driver, offersConfig) {
  let allOffers = [];
  for (let config of offersConfig) {
    if (config.type === 'css-offers') {
      let offerLis = await driver.findElements(By.css(config.selector));
      logger.debug(`[extractCssOffers] Selector: ${config.selector}, Found: ${offerLis.length}`);
      for (let li of offerLis) {
        try {
          let outerHTML = await li.getAttribute('outerHTML');
          logger.debug(`[extractCssOffers] Offer element outerHTML:`, { outerHTML: outerHTML.substring(0, 200) + '...' });
          let label = '';
          let content = '';
          let type = 'other';
          if (config.labelSelector) {
            try {
              let labelEl = await li.findElement(By.css(config.labelSelector));
              label = (await labelEl.getText()).trim();
            } catch (e) { logger.error('[extractCssOffers] labelSelector error:', { error: e.message, stack: e.stack }); }
          }
          if (config.contentSelector) {
            let contentEls = await li.findElements(By.css(config.contentSelector));
            if (contentEls.length > 1) {
              content = (await contentEls[1].getText()).trim();
            } else if (contentEls.length === 1) {
              content = (await contentEls[0].getText()).trim();
            } else {
              content = (await li.getText()).replace(label, '').trim();
            }
          } else {
            content = (await li.getText()).replace(label, '').trim();
          }
          if (/bank offer/i.test(label)) type = 'bank';
          else if (/emi/i.test(label + content)) type = 'emi';
          else if (/special price/i.test(label)) type = 'special';
          allOffers.push({ type, label, content });
        } catch (e) { logger.error('[extractCssOffers] offer element error:', { error: e.message, stack: e.stack }); }
      }
    }
  }
  if (allOffers.length > 0) {
    return allOffers;
  } else {
    logger.warn(`[extractCssOffers] No offers extracted from any configuration`);
  }
  return allOffers;
}


module.exports = {
  scrapeProduct,
  extractAttribute,
  safeExtract
};

// Other functions...
