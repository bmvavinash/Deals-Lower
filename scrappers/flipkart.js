const flipkartConfig = require('../config/flipkartConfig');
const { By, Key, Builder, Button, until } = require("selenium-webdriver");
const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('flipkart');

const { validatePrice, validateDiscount } = require("../utils/commonUtils");
const { getExtrapeUrl } = require('../affiliate/extrape');
const { determineHierarchy } = require("../utils/categoryHierarchy");

async function scrapeFlipkartProduct(url, text, driver) {
    // driver.get(url);
    try {
        let searchParams=""

        let product = {};
        // console.log(flipkartConfig.price)
        try {product.price = String(await extractAttribute(driver, flipkartConfig.price)); } catch(e) { console.log("Error in price",e);}
        
        // Extract MRP before discount for fallback calculation
        let mrp = null;
        try { mrp = String(await extractAttribute(driver, flipkartConfig.mrp)); } catch(e) { console.log("Error in MRP",e);}
        
        // Try to extract discount with better logging
        try {
            product.discount = String(await extractAttribute(driver, flipkartConfig.discount));
            if (!product.discount || product.discount === 'null' || product.discount === '') {
                // Fallback: Calculate discount from price and MRP
                if (product.price && mrp) {
                    try {
                        const priceNum = parseFloat(product.price.replace(/[^\d.]/g, ''));
                        const mrpNum = parseFloat(mrp.replace(/[^\d.]/g, ''));
                        if (mrpNum > 0 && priceNum < mrpNum) {
                            const discountPercent = Math.round(((mrpNum - priceNum) / mrpNum) * 100);
                            product.discount = `${discountPercent}%`;
                            console.log(`[flipkart] Calculated discount from price/MRP: ${product.discount}`);
                        }
                    } catch (calcError) {
                        console.log("[flipkart] Error calculating discount from price/MRP:", calcError.message);
                    }
                }
                if (!product.discount || product.discount === 'null' || product.discount === '') {
                    console.log("[flipkart] Discount missing or invalid - all selectors failed");
                }
            }
        } catch(e) { 
            console.log("[flipkart] Error in discount extraction:", e.message);
            // Try fallback calculation
            if (product.price && mrp) {
                try {
                    const priceNum = parseFloat(product.price.replace(/[^\d.]/g, ''));
                    const mrpNum = parseFloat(mrp.replace(/[^\d.]/g, ''));
                    if (mrpNum > 0 && priceNum < mrpNum) {
                        const discountPercent = Math.round(((mrpNum - priceNum) / mrpNum) * 100);
                        product.discount = `${discountPercent}%`;
                        console.log(`[flipkart] Calculated discount from price/MRP (fallback): ${product.discount}`);
                    }
                } catch (calcError) {
                    console.log("[flipkart] Error calculating discount:", calcError.message);
                }
            }
        }
        
        try {product.photo = await extractAttribute(driver, flipkartConfig.photo); } catch(e) { console.log("Error in photo",e);}
        try { product.urltext = text } catch (e) { console.log("url Text error") }
        // product.asin = await extractAttribute(driver, flipkartConfig.asin);
        try {

            const parsedUrl = new URL(url);
            searchParams = new URLSearchParams(parsedUrl.search);
        } catch(e) {
            console.log("error in ProductCode in Flipkart ",e);
        }
        
        try {
            prdCode = searchParams.get('pid');
            if (prdCode) {
                product.productCode = prdCode;
            }
         } catch(e) { console.log("Error in productCode",e);}
        try {product.productText = await extractAttribute(driver, flipkartConfig.productText); } catch(e) { console.log("Error in productText",e);}
        try {product.category = {} } catch(e) { console.log("Error in category",e);}
        try {product.category.mainCategory = await extractAttribute(driver, flipkartConfig.category); } catch(e) { console.log("Error in category",e);}
        try {product.category.c1 = await extractAttribute(driver, flipkartConfig.c1); } catch(e) { console.log("Error in category",e);}
        try {product.category.c2 = await extractAttribute(driver, flipkartConfig.c2); } catch(e) { console.log("Error in category",e);}
        try {product.category.c3 = await extractAttribute(driver, flipkartConfig.c3); } catch(e) { console.log("Error in category",e);}
        try {product.category.c4 = await extractAttribute(driver, flipkartConfig.c4); } catch(e) { console.log("Error in category",e);}
        try {product.category.c5 = await extractAttribute(driver, flipkartConfig.c5); } catch(e) { console.log("Error in category",e);}
        try {product.category = await extractAttribute(driver, flipkartConfig.category); } catch(e) { console.log("Error in category",e);}

        product.links = {};
        if(product?.photo != ""){
          // Add INRDeals fallback directly
          product.links.avinashbmvINR = "https://inrdeals.com/avi646476329/" + url;
          
          // Make Extrape URL generation non-blocking with timeout
          try { 
              const extrapePromise = getExtrapeUrl(driver, url, 25000); // 25 second timeout
            product.links.avinashbmv = await Promise.race([
                extrapePromise,
                new Promise((resolve) => setTimeout(() => resolve(""), 25000))
            ]) || "";
            if (!product.links.avinashbmv) {
                console.log("[flipkart] Extrape URL generation timed out or failed - continuing without it");
            }
        } catch (e) { 
            console.log("[flipkart] Link generation error:", e.message);
            product.links.avinashbmv = "";
        }
      }
      else {
        console.log("[flipkart] No Photo hence skipping the link generation")
      }

        // product.brand = await extractAttribute(driver, flipkartConfig.brand);
        // Log product or further processing
        // console.log("Product is ", product);

        const hierarchyInfo = determineHierarchy(product.category, product.title, product.brand);
        product.hierarchicalCategory = hierarchyInfo.hierarchicalCategory;
        product.hierarchicalKey = hierarchyInfo.hierarchicalKey;

        // Log structured warnings for missing critical fields
        const missingFields = [];
        if (!product.price || product.price === '0') missingFields.push('price');
        if (!product.title) missingFields.push('title');
        if (!product.photo && (!product.images || product.images.length === 0)) missingFields.push('photo');
        if (!product.brand) missingFields.push('brand');

        if (missingFields.length > 0) {
          logger.warn(`[flipkart] Scraped product has missing attributes: ${missingFields.join(', ')}`, {
            moduleName: 'flipkart',
            platform: 'flipkart',
            productCode: product.productCode || (url ? url.match(/[?&]pid=([^&]+)/)?.[1] : ''),
            productUrl: url,
            missingFields,
            category: product.category?.mainCategory || product.categoryGroup || 'Unknown',
            actionRequired: 'fix_missing_data'
          });
        }

        return product;
    } catch(e) {
        logger.error("Error in Scrap Flipkart Product", { error: e.message, stack: e.stack, url });
    }
}

async function extractAttribute(driver, attributeConfig) {
    for (let config of attributeConfig) {
        try {
            let element;
            if (config.type === 'xpath') {
                element = await driver.findElement(By.xpath(config.selector));
            } else if (config.type === 'id') {
                element = await driver.findElement(By.id(config.selector));
            } else if (config.type === 'className') {
                element = await driver.findElement(By.className(config.selector));
            } else if (config.type === 'css') {
                element = await driver.findElement(By.css(config.selector));
            }
            if (!element) continue;
            
            const attributeToExtract = config.attribute || "innerHTML";
            let rawValue = await element.getAttribute(attributeToExtract);

            // Use validator directly from utils
            const validatorFn = config.validator || config.validate;
            if (validatorFn) {
                const validationResult = validatorFn(rawValue);
                if (!validationResult.isValid) {
                    console.log("Validation failed for:", config.selector);
                    continue; // Skip to the next selector if validation fails
                }
                return validationResult.value; // Use modified value
            }
            if (config.type === 'id') {
                console.log()
            }

            return rawValue.trim(); // Return raw value if no validator is provided
        } catch (error) {
            if (config.type === 'id') {
                console.log("Error is ", error)
            }
            // console.log("Error finding element or validating:", config.selector, error);
            // Optionally log the error or handle it as needed
        }
    }

    // If all selectors fail or validation fails for all, log and return null or a default value
    console.log("All xpaths failed or validation failed for all xpaths.");
    return null;
}

module.exports = {
    scrapeFlipkartProduct
};

// Other functions...
