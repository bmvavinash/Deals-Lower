const { Builder, By } = require('selenium-webdriver');
const { scrapePage } = require('../pageScheduler');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testAllPlatforms');

async function testAllPlatforms() {
    const driver = await new Builder().forBrowser('chrome').build();
    
    const summary = {}; // platform => { count, missingFields: Set }

    try {
        const testUrls = {
            amazon: 'https://www.amazon.in/s?k=laptop',
            flipkart: 'https://www.flipkart.com/search?q=laptop',
            myntra: 'https://www.myntra.com/dresses',
            ajio: 'https://www.ajio.com/search/?text=men+watches'
        };

        for (const [platform, url] of Object.entries(testUrls)) {
            logger.info(`Testing ${platform} platform...`);
            
            try {
                await driver.get(url);
                await driver.sleep(3000); // Wait for page to load
                
                const products = await scrapePage(url, driver, {}, 'searchPage');
                
                // aggregate summary
                const requiredFields = [
                    'brand','title','shortText','urltext','price','mrp','discount','rating','ratingsCount','reviewsCount','productUrl','photo','images','productCode','storeType'
                ];
                const missingFields = new Set();
                if (products && products.length) {
                    const sample = products[0];
                    for (const field of requiredFields) {
                        if (sample[field] == null || sample[field] === '' || sample[field] === '') {
                            missingFields.add(field);
                        }
                    }
                } else {
                    requiredFields.forEach(f => missingFields.add(f));
                }
                summary[platform] = { count: products.length, missingFields: Array.from(missingFields) };

                logger.info(`${platform} results:`, {
                    platform,
                    url,
                    productsFound: products.length,
                    sampleProduct: products[0] ? 'Product found' : 'No products found'
                });
                
                // Log first few products for verification with safe formatting
                if (products.length > 0) {
                    const sample = products[0];
                    logger.info(`Sample ${platform} product fields:`, Object.keys(sample));
                    logger.info(`Sample ${platform} product brand: ${sample.brand || ''}`);
                    logger.info(`Sample ${platform} product title: ${sample.title || ''}`);
                    logger.info(`Sample ${platform} product price: ${sample.price || ''}`);
                }
                
            } catch (error) {
                logger.error(`Error testing ${platform}:`, error.message);
                summary[platform] = summary[platform] || { count: 0, missingFields: [] };
            }
            
            await driver.sleep(2000); // Wait between platforms
        }

        // Final summary log
        const finalSummary = Object.entries(summary).map(([platform, info]) => ({
            platform,
            extracted: info.count,
            missingFields: info.missingFields
        }));
        logger.info('Extraction Summary', finalSummary);
        
    } catch (error) {
        logger.error('Test failed:', error.message);
    } finally {
        await driver.quit();
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testAllPlatforms().catch(console.error);
}

module.exports = { testAllPlatforms };
