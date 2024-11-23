const puppeteer = require('puppeteer');
const { getModuleLogger } = require('./logger/logger');
const { storeMap } = require('./config/const');
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
        
        const { config } = platformConfig;
        // const pageType = url.includes('search') ? 'searchPage' : 'productPage';
        const pageType = 'searchPage' ;
        const pageConfig = config[pageType];
        
        console.log("Page Config:", platformConfig?.pageConfig);
        console.log("Page Config for Search Page:", platformConfig?.pageConfig?.searchPage);
        console.log("Config:", platformConfig?.pageConfig?.config);

        if (!pageConfig) {
            logger.error("No valid page type configuration found", { functionName: 'scrapePage', url, pageType });
            return null;
        }

        const data = {};
        const baseElements = await driver.findElements(pageConfig.baseSelector || '');

        for (const element of baseElements) {
            for (const [key, selectorConfig] of Object.entries(pageConfig.selectors)) {
                try {
                    const extractedData = await element.findElement(selectorConfig.type, selectorConfig.selector).getText();

                    if (selectorConfig.validator && !selectorConfig.validator(extractedData)) {
                        logger.warn(`Validation failed for ${key}`, { functionName: 'scrapePage', value: extractedData });
                        continue;
                    }

                    data[key] = extractedData;
                } catch (error) {
                    logger.error(`Error extracting ${key}`, { functionName: 'scrapePage', error, url });
                }
            }
        }

        return data;
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
