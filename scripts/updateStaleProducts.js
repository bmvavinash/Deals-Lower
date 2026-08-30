process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const { executionTracker } = require('../services/executionTracker');
const config = require('../config/config');

const logger = getModuleLogger('updateStaleProducts');

async function getStaleProducts(daysOld = 7) {
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
    
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - daysOld);
    const staleThresholdTime = staleThreshold.getTime();
    
    const staleUrls = [];
    
    for (const [key, product] of Object.entries(data)) {
        const productUrl = product.productUrl || product.url;
        if (!productUrl) continue;
        
        // Check if updatedAt exists and is older than threshold
        let isStale = false;
        if (!product.updatedAt) {
            isStale = true;
        } else {
            // parse updatedAt which might be "19-May-2026 12:00:00" or ISO string or timestamp
            // For safety, let's parse it
            const updateTime = new Date(product.updatedAt).getTime();
            if (isNaN(updateTime) || updateTime < staleThresholdTime) {
                isStale = true;
            }
        }
        
        if (isStale) {
            staleUrls.push(productUrl);
        }
    }
    
    return staleUrls;
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
        const staleUrls = await getStaleProducts(7);
        logger.info(`Found ${staleUrls.length} stale products to update.`);
        
        if (staleUrls.length === 0) {
            console.log("No stale products found.");
            await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: 0, message: 'No stale products found.' });
            return;
        }
        
        if (isDryRun) {
            console.log("Dry run mode. Would update the following URLs:");
            console.log(staleUrls.slice(0, 10).join('\n'));
            if (staleUrls.length > 10) console.log(`...and ${staleUrls.length - 10} more.`);
            await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: staleUrls.length, message: 'Dry run completed.' });
            return;
        }
        
        // Process in smaller batches to avoid overwhelming the system
        const batchSize = 100;
        let processedCount = 0;
        for (let i = 0; i < staleUrls.length; i += batchSize) {
            const batchUrls = staleUrls.slice(i, i + batchSize);
            logger.info(`Processing batch ${i/batchSize + 1} of ${Math.ceil(staleUrls.length/batchSize)}...`);
            try {
                await runBatch(batchUrls, 'website', 'ALL', 'productdeals');
                processedCount += batchUrls.length;
            } catch (error) {
                logger.error(`Error processing batch ${i/batchSize + 1}:`, { error: error.message });
            }
        }
        
        logger.info('Stale products update complete.');
        
        // Run expired deals and banners database cleanup
        try {
            const { cleanupExpiredDealsAndBanners } = require('./cleanupExpiredDeals');
            await cleanupExpiredDealsAndBanners();
        } catch (cleanupErr) {
            logger.error('Failed to run expired deals/banners cleanup:', cleanupErr);
        }

        await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: staleUrls.length, processedCount });
    } catch (error) {
        logger.error('Stale products update failed:', error);
        await executionTracker.endDbUpdateExecution('failed', { error: error.message });
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { getStaleProducts };
