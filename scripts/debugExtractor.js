const { initializeDriver, closeDriver } = require('../dataSources/batchProductExtractor');
const { loadConfig, scrapePage } = require('../pageScheduler');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('debugExtractor');

// Memory optimization: Clear Node.js memory before starting
if (global.gc) {
    global.gc();
}

async function debug(url, pageType = 'searchPage') {
    let driver;
    try {
        driver = await initializeDriver();
        await driver.get(url);
        const store = url.includes('flipkart') ? 'flipkart'
            : url.includes('myntra') ? 'myntra'
            : url.includes('ajio') ? 'ajio'
            : 'amazon';
        const config = await loadConfig(`./PageConfig/${store}PageConfig.js`);
        const result = await scrapePage(url, driver, config, pageType);
        console.log('Extracted count:', Array.isArray(result) ? result.length : 0);
        console.dir(result?.slice(0, 3), { depth: null });
    } catch (e) {
        logger.error('Debug extractor failed', { error: e.message, stack: e.stack });
    } finally {
        if (driver) await closeDriver(driver);
    }
}

if (require.main === module) {
    const url = process.argv[2] || 'https://www.flipkart.com/search?q=mobile';
    const pageType = process.argv[3] || 'searchPage';
    debug(url, pageType);
}

module.exports = { debug };



