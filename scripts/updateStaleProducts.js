process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const { executionTracker } = require('../services/executionTracker');
const config = require('../config/config');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');

const logger = getModuleLogger('updateStaleProducts');

async function getStaleProducts(hoursOld = 12) {
  try {
    const DB_Name = config.DATABASE_CONFIG.DB1_NAME || 'lowerdealhub';
    const apiUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals.json`
      : `https://${DB_Name}-default-rtdb.firebaseio.com/productdeals.json`;
    
    logger.info(`Fetching product deals from: ${apiUrl}`);
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    if (!data) return [];
    
    const staleThresholdTime = Date.now() - (hoursOld * 60 * 60 * 1000);
    
    const staleItems = [];
    
    for (const [key, product] of Object.entries(data)) {
        if (!product.url) continue;
        
        let isStale = false;
        if (!product.updatedAt) {
            isStale = true;
        } else {
            const updateTime = new Date(product.updatedAt).getTime();
            if (isNaN(updateTime) || updateTime < staleThresholdTime) {
                isStale = true;
            }
        }
        
        if (isStale) {
            staleItems.push({ key, url: product.url, oldUpdatedAt: product.updatedAt });
        }
    }
    
    return staleItems;
  } catch (error) {
    logger.error('Error fetching stale products:', { error: error.message });
    return [];
  }
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    logger.info('Starting stale products updater...', { isDryRun });
    
    const sourceType = process.env.TRIGGER_SOURCE || 'cli';
    await executionTracker.startDbUpdateExecution('updateStaleProducts', sourceType);
    
    try {
        const staleItems = await getStaleProducts(12);
        logger.info(`Found ${staleItems.length} stale products to update.`);
        
        if (staleItems.length === 0) {
            console.log("No stale products found.");
            await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: 0, message: 'No stale products found.' });
            return;
        }
        
        if (isDryRun) {
            console.log("Dry run mode. Would update the following URLs:");
            console.log(staleItems.slice(0, 10).map(i => i.url).join('\n'));
            await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: staleItems.length, message: 'Dry run completed.' });
            return;
        }
        
        const batchSize = 100;
        let processedCount = 0;
        
        for (let i = 0; i < staleItems.length; i += batchSize) {
            const batch = staleItems.slice(i, i + batchSize);
            const batchUrls = batch.map(item => item.url);
            logger.info(`Processing batch ${i/batchSize + 1} of ${Math.ceil(staleItems.length/batchSize)}...`);
            
            try {
                // 1. Run the normal scraper to update prices
                await runBatch(batchUrls, 'website', 'ALL', 'productdeals');
                
                // 2. Give Firebase a moment to settle
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 3. Check which ones FAILED to update (i.e. out of stock/page dead)
                let markedOutOfStock = 0;
                for (const item of batch) {
                    try {
                        const snap = await productDealsDB.productdealsRef.child(item.key).once('value');
                        const currentData = snap.val();
                        
                        if (currentData) {
                            // If the updatedAt is exactly the same, the scraper completely failed on it
                            if (currentData.updatedAt === item.oldUpdatedAt) {
                                await productDealsDB.productdealsRef.child(item.key).update({
                                    isDisplay: false,
                                    // User requested to leave outOfStock untouched unless we definitively know it's OOS
                                    errorStatus: 'ScrapeFailed',
                                    updatedAt: new Date().toISOString() // Touch it so it isn't stale tomorrow
                                });
                                markedOutOfStock++;
                                logger.info(`Marked product with ScrapeFailed error: ${item.key}`);
                            } else {
                                // Scraper successfully updated it! Make sure isDisplay is true and clear errors
                                if (currentData.outOfStock !== true) { await productDealsDB.productdealsRef.child(item.key).update({ isDisplay: true, outOfStock: false, errorStatus: null }); } else { await productDealsDB.productdealsRef.child(item.key).update({ errorStatus: null }); }
                            }
                        }
                    } catch (dbErr) {
                        logger.warn(`Failed to check/update out of stock for ${item.key}`, { error: dbErr.message });
                    }
                }
                
                logger.info(`Batch complete. Marked ${markedOutOfStock} items as out of stock.`);
                processedCount += batchUrls.length;
            } catch (error) {
                logger.error(`Error processing batch ${i/batchSize + 1}:`, { error: error.message });
            }
        }
        
        logger.info('Stale products update complete.');
        await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: staleItems.length, processedCount });
    } catch (error) {
        logger.error('Stale products update failed:', error);
        await executionTracker.endDbUpdateExecution('failed', { error: error.message });
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { getStaleProducts, main };
