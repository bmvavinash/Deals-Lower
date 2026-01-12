/**
 * Script to update all products in the database
 * Ensures all products have the latest data structure and affiliate links
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getProductDetails } = require('../scheduler');
const { firebaseget } = require('../database/firebaseget');
const { getModuleLogger } = require('../logger/logger');
const cacheService = require('../services/cacheService');

const logger = getModuleLogger('updateAllProducts');

const BATCH_SIZE = 10; // Process 10 products at a time
const MAX_CONCURRENT = 2; // Max concurrent browser instances

async function updateAllProducts() {
    let driver = null;
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    try {
        logger.info('🚀 Starting update all products process');
        
        // Initialize driver
        const options = new chrome.Options();
        options.addArguments('--headless');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');
        
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();
        
        logger.info('✅ Driver initialized');
        
        // Get all products from database
        const snapshot = await productDealsDB.productdealsRef.once('value');
        const products = snapshot.val() || {};
        const productList = Object.entries(products);
        
        logger.info(`📦 Found ${productList.length} products to check`);
        
        // Get existing data
        const { data, len } = await firebaseget();
        const { data: todayData } = await firebaseget(true);
        
        // Process in batches
        for (let i = 0; i < productList.length; i += BATCH_SIZE) {
            const batch = productList.slice(i, i + BATCH_SIZE);
            logger.info(`📊 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, productList.length)} of ${productList.length})`);
            
            // Process batch with concurrency limit
            const batchPromises = [];
            for (let j = 0; j < Math.min(MAX_CONCURRENT, batch.length); j++) {
                const [productCode, product] = batch[j];
                batchPromises.push(
                    updateProduct(driver, productCode, product, data, todayData, len)
                        .then(result => {
                            if (result === 'updated') updatedCount++;
                            else if (result === 'skipped') skippedCount++;
                            else if (result === 'error') errorCount++;
                        })
                        .catch(error => {
                            logger.error(`Error updating product ${productCode}`, { error: error.message });
                            errorCount++;
                        })
                );
            }
            
            await Promise.all(batchPromises);
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        logger.info('✅ Update process completed', {
            total: productList.length,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount
        });
        
        // Clear cache after update
        cacheService.clear();
        logger.info('🗑️ Cache cleared');
        
    } catch (error) {
        logger.error('❌ Fatal error in update process', { error: error.message, stack: error.stack });
        throw error;
    } finally {
        if (driver) {
            try {
                await driver.quit();
                logger.info('🔒 Driver closed');
            } catch (e) {
                logger.warn('Error closing driver', { error: e.message });
            }
        }
    }
}

async function updateProduct(driver, productCode, product, data, todayData, len) {
    try {
        // Skip if product URL is missing
        if (!product.productUrl) {
            logger.warn(`Skipping ${productCode}: No product URL`);
            return 'skipped';
        }
        
        // Check if product was updated recently (within last hour)
        const updatedAt = product.updatedAt || product.updateTimestamp || product.updatedatetime;
        if (updatedAt) {
            const updateTime = new Date(updatedAt).getTime();
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (updateTime > oneHourAgo) {
                logger.debug(`Skipping ${productCode}: Updated recently`);
                return 'skipped';
            }
        }
        
        logger.info(`🔄 Updating product: ${productCode}`);
        
        // Re-extract product details
        const result = await getProductDetails(
            driver,
            product.productUrl,
            product.title || product.productText || '',
            len,
            '',
            data,
            todayData,
            true,
            'db_update',
            false,
            ''
        );
        
        if (result === 'PRODUCT_CREATED' || result === 'PRODUCT_UPDATED') {
            logger.info(`✅ Updated product: ${productCode}`);
            return 'updated';
        } else {
            logger.warn(`⚠️ Product update returned: ${result} for ${productCode}`);
            return 'skipped';
        }
        
    } catch (error) {
        logger.error(`❌ Error updating product ${productCode}`, { error: error.message });
        return 'error';
    }
}

// Run if called directly
if (require.main === module) {
    updateAllProducts()
        .then(() => {
            logger.info('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            logger.error('❌ Script failed', { error: error.message });
            process.exit(1);
        });
}

module.exports = { updateAllProducts };















