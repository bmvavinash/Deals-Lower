const puppeteer = require('puppeteer');
const { getModuleLogger } = require('./logger/logger');
const { storeMap } = require('./config/const');
// const { extractText } = require('./helper/helperFunction');
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
    let newPageConfig;
    try {
        const storeKey = Object.keys(storeMap).find(key => url.includes(key.toLowerCase()));
        if (!storeKey) throw new Error("Platform not supported or URL is invalid.");

        // Extract platform configuration
        const { getCode, storeType } = storeMap[storeKey];
        const platformConfig = { getCode, storeType };

        console.log("Platform Config:", platformConfig);
        // Dynamically import the PageConfig based on platform
        const pageConfigModule = `./PageConfig/${storeKey.toLowerCase()}PageConfig.js`;
        platformConfig.pageConfig = require(pageConfigModule);

        const { pageConfig } = platformConfig;
        if (!pageConfig) throw new Error(`PageConfig not found for store: ${storeKey}`);

        // Assign the configuration for the specific page type
        newPageConfig = pageConfig?.[pageType];
        if (!newPageConfig) throw new Error(`PageConfig for '${pageType}' is undefined`);

        console.log("Page Config:", platformConfig?.pageConfig);
        console.log("Page Config for Search Page:", platformConfig?.pageConfig?.searchPage);
        console.log("Config:", platformConfig?.pageConfig?.config);

        // Flipkart-specific or general scraping logic
        const isFlipkart = storeKey.toLowerCase() === 'flipkart';
        if (isFlipkart) {
            return await scrapeFlipkart(driver, newPageConfig, storeKey);  // Isolated function for Flipkart
        } else {
            return await scrapeGeneral(driver, newPageConfig, storeKey);  // General case for other platforms
        }
    } catch (error) {
        logger.error("Critical error in scrapePage", { functionName: 'scrapePage', url, error });
        return null;
        // return null;
    }
}

async function scrapeFlipkart(driver, pageConfig, storeKey) {
    const products = [];
    const { startRow, maxRows, maxCols } = pageConfig.rowColConfig;
    const { selectors } = pageConfig;

    for (let row = startRow; row <= startRow + maxRows - 1; row++) {
        for (let col = 1; col <= maxCols; col++) {
            const productData = await extractFlipkartProduct(driver, selectors, row, col, storeKey);
            if (productData) products.push(productData);
        }
    }
    return products;
}

async function extractFlipkartProduct(driver, selectors, row, col, storeKey) {
    const productData = {};
    for (const [key, selectorConfig] of Object.entries(selectors)) {
        const { type, selector } = selectorConfig;
        try {
            if (key === "productUrl" && type === "xpath") {
                // Special handling for product URLs
                const linkElement = await driver.findElement(By.xpath(selector(row, col)));
                const rawValue = await linkElement.getAttribute("href");
                const baseUrl = "https://www.flipkart.com/";
                productData[key] = rawValue.startsWith("http")
                    ? rawValue
                    : new URL(rawValue, baseUrl).href;
            } else {
                // General data extraction
            const rawValue = await extractDataUsingXPath(driver, selector(row, col), type);
                productData[key] = rawValue || "N/A";
            }
        } catch (error) {
            productData[key] = 'N/A';
        }
    }
    return productData;
}

async function scrapeGeneral(driver, pageConfig, storeKey) {
    const products = [];
    const baseElements = await driver.findElements(By.css(pageConfig.baseSelector));

    for (const element of baseElements) {
        const productData = await extractGeneralProduct(element, pageConfig.selectors, storeKey);
        if (productData) products.push(productData);
    }
    return products;
}

async function extractGeneralProduct(element, selectors, storeKey) {
    const productData = {};
    for (const [key, selectorConfig] of Object.entries(selectors)) {
        const { type, selector } = selectorConfig;
        try {
            if (key === "productUrl" && type === "css") {
                // Special handling for product URLs
                const linkElement = await element.findElement(By.css(selector));
                const rawValue = await linkElement.getAttribute("href");
                const baseUrl = `https://www.${storeKey.toLowerCase()}.com/`; // Update with appropriate base URL
                productData[key] = rawValue.startsWith("http")
                    ? rawValue
                    : new URL(rawValue, baseUrl).href;
            } else {
                // General data extraction
            const rawValue = await extractText(element, type, selector);
                productData[key] = rawValue || "N/A";
            }
        } catch (error) {
            productData[key] = 'N/A';
        }
    }
    return productData;
}

async function extractDataUsingXPath(driver, xpath, type) {
    if (type === 'xpath') {
        return await driver.findElement(By.xpath(xpath)).getText();
    }
    return null;
}

async function extractText(element, type, selector) {
    try {
        if (type === "css") {
            return await element.findElement(By.css(selector)).getText();
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Export the functions for use in other files
module.exports = {
    loadConfig,
    scrapePage
};
