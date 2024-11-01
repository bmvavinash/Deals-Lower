const flipkartConfig = require('../config/flipkartConfig');
const { By, Key, Builder, Button, until } = require("selenium-webdriver");

const { validatePrice, validateDiscount } = require("../utils/commonUtils");
const { getExtrapeUrl } = require('../affiliate/extrape');

async function scrapeFlipkartProduct(url, text, driver) {
    // driver.get(url);
    try {
        let searchParams=""

        let product = {};
        // console.log(flipkartConfig.price)
        try {product.price = String(await extractAttribute(driver, flipkartConfig.price)); } catch(e) { console.log("Error in price",e);}
        try {product.discount = String(await extractAttribute(driver, flipkartConfig.discount)); } catch(e) { console.log("Error in discount",e);}
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
            product.productCode = prdCode.substr(0, 10);

            // asin = url.substr(start, 10);

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

        try { product.links.avinashbmv = await getExtrapeUrl(driver,url) || ""; } catch (e) { console.log("link generation error") }
      }
      else {
        console.log("No Photo hence skipping the link generation")
      }

        // product.brand = await extractAttribute(driver, flipkartConfig.brand);
        // Log product or further processing
        // console.log("Product is ", product);
        return product;
    } catch(e) {
        console.log("Error in Scrap Flipkart Product ",e);
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
            }
            const attributeToExtract = config.attribute || "innerHTML";
            let rawValue = await element.getAttribute(attributeToExtract);

            // Use validator directly from utils
            if (config.validator) {
                const validationResult = config.validator(rawValue);
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
