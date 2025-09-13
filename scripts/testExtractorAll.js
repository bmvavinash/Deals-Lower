const { initializeDriver, closeDriver, extractAndStoreFromUrl } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testExtractorAll');

const SEEDS = [
    // Amazon samples
    'https://www.amazon.in/s?k=mobile+phones',
    'https://www.amazon.in/bestsellers',
    // Flipkart samples
    'https://www.flipkart.com/search?q=mobile',
    // Myntra samples
    'https://www.myntra.com/men-tshirts',
    // Ajio samples
    'https://www.ajio.com/men-tshirts/c/830216'
];

async function main() {
    let driver;
    try {
        driver = await initializeDriver();
        for (const url of SEEDS) {
            logger.info('Testing extraction for', { url });
            await driver.get(url);
            const res = await extractAndStoreFromUrl(driver, url, 'website', '');
            console.log('Result:', url, res);
        }
    } catch (e) {
        logger.error('testExtractorAll failed', { error: e.message, stack: e.stack });
        process.exit(1);
    } finally {
        if (driver) await closeDriver(driver);
    }
}

if (require.main === module) main();

module.exports = { main };



