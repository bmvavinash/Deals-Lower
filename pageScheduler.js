const puppeteer = require('puppeteer');
const { getModuleLogger } = require('./logger/logger');
const { storeMap } = require('./config/const');
const { extractText } = require('./helper/helperFunction');
const { By } = require('selenium-webdriver');
const fs = require('fs').promises;
const logger = getModuleLogger('pageScheduler');

// Load configuration for a specific platform
async function loadConfigJson(configPath) {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
}

async function loadConfig(configPath) {
    return require(configPath); // Use require to load a JavaScript module
}

async function scrapePage(url, driver, config, pageType) {
    const products = [];
    try {
        // Dynamically determine the platform configuration
        const storeKey = Object.keys(storeMap).find((key) => url.includes(key.toLowerCase()));
        if (!storeKey) {
            throw new Error("Platform not supported or URL is invalid.");
        }

        const { getCode, storeType } = storeMap[storeKey];
        const platformConfig = { getCode, storeType };

        console.log("Platform Config:", platformConfig);
        // Dynamically import the PageConfig based on platform
        const pageConfigModule = `./PageConfig/${storeKey.toLowerCase()}PageConfig.js`;
        platformConfig.pageConfig = require(pageConfigModule); // Use dynamic import for ES modules


        // Use platformConfig as required

        const { pageConfig } = platformConfig;

        console.log("Platform Config:", platformConfig);
        console.log("Config Object:", pageConfig);  
        // const pageType = url.includes('search') ? 'searchPage' : 'productPage';
        const pageType = 'searchPage';
        const newpageConfig = pageConfig?.[pageType] ?? {};
        if (!newpageConfig) {
            throw new Error(`PageConfig for '${pageType}' is undefined`);
        }

        console.log("Page Config:", platformConfig?.pageConfig);
        console.log("Page Config for Search Page:", platformConfig?.pageConfig?.searchPage);
        console.log("Config:", platformConfig?.pageConfig?.config);

        if (!newpageConfig) {
            logger.error("No valid page type configuration found", { functionName: 'scrapePage', url, pageType });
            return null;
        }

        const baseElements = await driver.findElements(By.css(newpageConfig.baseSelector));

        for (const element of baseElements) {
            const productData = {};
        let isValidProduct = true; // Track validity of the product

            for (const [key, selectorConfig] of Object.entries(newpageConfig.selectors)) {
                const { type, selector, validate } = selectorConfig;

            try {
                // Extract raw value
                let rawValue;
                if (key === "productUrl" && type === "css") {
                    // Special case for URLs
                    const linkElement = await element.findElement(By[type](selector));
                    rawValue = await linkElement.getAttribute("href");

                    // Normalize URL
                    const baseUrl = "https://www.myntra.com/";
                    productData[key] = rawValue.startsWith("http")
                        ? rawValue
                        : new URL(rawValue, baseUrl).href;
                } else {
                    // General extraction
                    rawValue = await extractText(element, type, selector);
                }

                // Validate raw value if a validator exists
                if (validate) {
                    const validationResult = validate(rawValue);
                    if (!validationResult.isValid) {
                        // If validation fails, mark the product as invalid and log
                        console.warn(`Validation failed for ${key}:`, rawValue);
                        isValidProduct = false;
                        productData[key] = validationResult.cleanedValue || rawValue; // Keep raw or partially cleaned value
                    } else {
                        productData[key] = validationResult.value; // Use validated value
                    }
                } else {
                    productData[key] = rawValue; // No validation
                }
            } catch (error) {
                // Handle extraction errors
                console.error(`Error extracting ${key}:`, error.message);
                productData[key] = "N/A"; // Default value for errors
                isValidProduct = false; // Mark product invalid
            }
        }

        // Only include valid products in the final array
        if (isValidProduct) {
            products.push(productData);
        }
    }
    return products;
    } catch (error) {
        logger.error("Critical error in scrapePage", { functionName: 'scrapePage', error, url });
        // return null;
    }
}

// Export the functions for use in other files
module.exports = {
    loadConfig,
    scrapePage
};
