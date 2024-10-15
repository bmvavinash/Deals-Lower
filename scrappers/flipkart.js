const flipkartConfig = require('../config/flipkartConfig');
const { By, Key, Builder, Button, until } = require("selenium-webdriver");

const { validatePrice, validateDiscount } = require("../utils/commonUtils");

async function scrapeFlipkartProduct(url, text, driver) {
    // driver.get(url);
    let product = {};
    // console.log(flipkartConfig.price)
    product.price = await extractAttribute(driver, flipkartConfig.price);
    product.discount = await extractAttribute(driver, flipkartConfig.discount);
    product.photo = await extractAttribute(driver, flipkartConfig.photo);
    try { product.urltext = text } catch (e) { console.log("url Text error") }
    // product.asin = await extractAttribute(driver, flipkartConfig.asin);

    const parsedUrl = new URL(url);
    const searchParams = new URLSearchParams(parsedUrl.search);

    product.productCode = searchParams.get('pid');

    product.productText = await extractAttribute(driver, flipkartConfig.productText);
    product.category = {}
    product.category.mainCategory = await extractAttribute(driver, flipkartConfig.category);
    product.category.c1 = await extractAttribute(driver, flipkartConfig.c1);
    product.category.c2 = await extractAttribute(driver, flipkartConfig.c2);
    product.category.c3 = await extractAttribute(driver, flipkartConfig.c3);
    product.category.c4 = await extractAttribute(driver, flipkartConfig.c4);
    product.category.c5 = await extractAttribute(driver, flipkartConfig.c5);
    product.category = await extractAttribute(driver, flipkartConfig.category);
    // product.brand = await extractAttribute(driver, flipkartConfig.brand);
    // Log product or further processing
    // console.log("Product is ", product);
    return product;
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
