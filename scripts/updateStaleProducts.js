process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();
const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const { executionTracker } = require('../services/executionTracker');
const { githubActionLogger } = require('../services/githubActionLogger');
const config = require('../config/config');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');

const logger = getModuleLogger('updateStaleProducts');

/**
 * Efficiently discovers stale products using Firebase RTDB shallow key queries
 * to avoid downloading massive multi-megabyte payloads in cloud runners.
 */
async function getStaleProducts(maxItems = 30, hoursOld = 12) {
  try {
    const DB_Name = config.DATABASE_CONFIG.DB1_NAME || 'lowerdealhub';
    const shallowUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals.json?shallow=true`
      : `https://${DB_Name}-default-rtdb.firebaseio.com/productdeals.json?shallow=true`;
    
    logger.info(`Fetching product deals shallow keys from: ${shallowUrl}`);
    const response = await fetch(shallowUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const keysObj = await response.json();
    if (!keysObj) return [];
    
    const allKeys = Object.keys(keysObj);
    logger.info(`Total products in database: ${allKeys.length}. Sampling for stale records...`);

    const staleThresholdTime = Date.now() - (hoursOld * 60 * 60 * 1000);
    const staleItems = [];

    // Balance recent and pseudo-random keys for broad freshness coverage
    const sampleTarget = Math.min(100, allKeys.length);
    const halfSample = Math.floor(sampleTarget / 2);
    const recentKeys = allKeys.slice(-halfSample);
    const randomKeys = [];
    for (let i = 0; i < halfSample; i++) {
      const idx = Math.floor(Math.random() * (allKeys.length - halfSample));
      randomKeys.push(allKeys[idx]);
    }
    const sampleKeys = Array.from(new Set([...recentKeys, ...randomKeys]));

    // Check records in small concurrent batches
    const chunkSize = 10;
    for (let i = 0; i < sampleKeys.length && staleItems.length < maxItems; i += chunkSize) {
      const chunk = sampleKeys.slice(i, i + chunkSize);
      const promises = chunk.map(async (key) => {
        try {
          const snap = await productDealsDB.productdealsRef.child(key).once('value');
          const product = snap.val();
          if (!product) return null;
          const url = product.productUrl || product.url;
          if (!url) return null;

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
            return { key, url, oldUpdatedAt: product.updatedAt || null };
          }
        } catch (_) {}
        return null;
      });

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res && staleItems.length < maxItems) {
          staleItems.push(res);
        }
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
    
    const sourceType = process.env.TRIGGER_SOURCE || (process.env.GITHUB_ACTIONS ? 'github-actions' : 'cli');
    
    // Start logging across both trackers
    await githubActionLogger.startAction('stale-products-update', { sourceType, isDryRun });
    try {
      await executionTracker.startDbUpdateExecution('updateStaleProducts', sourceType);
    } catch (_) {}
    
    try {
        const staleItems = await getStaleProducts(30, 12);
        logger.info(`Found ${staleItems.length} stale products to process.`);
        
        if (staleItems.length === 0) {
            logger.info("No stale products found to update.");
            await githubActionLogger.completeAction('stale-products-update', { staleUrlsCount: 0 });
            try { await executionTracker.endDbUpdateExecution('completed', { staleUrlsCount: 0 }); } catch (_) {}
            return;
        }
        
        if (isDryRun) {
            console.log("Dry run mode. Would update the following URLs:");
            console.log(staleItems.slice(0, 10).map(i => i.url).join('\n'));
            await githubActionLogger.completeAction('stale-products-update', { staleUrlsCount: staleItems.length, dryRun: true });
            return;
        }
        
        const batchUrls = staleItems.map(item => item.url);
        
        // 1. Run the normal scraper to update prices with productdeals target
        logger.info(`Executing batch scrape for ${batchUrls.length} stale items...`);
        const batchResults = await runBatch(batchUrls, 'website', 'ALL', 'productdeals');
        
        // 2. Allow Firebase a brief moment to settle
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // 3. Check which ones failed to update or are definitively out of stock
        let markedOutOfStock = 0;
        let successfulUpdates = 0;
        const failedItems = [];
        
        for (const item of staleItems) {
            try {
                const snap = await productDealsDB.productdealsRef.child(item.key).once('value');
                const currentData = snap.val();
                
                if (currentData) {
                    if (currentData.updatedAt === item.oldUpdatedAt) {
                        // Scraper completely failed on it -> mark Out of Stock & flag error
                        await productDealsDB.productdealsRef.child(item.key).update({ 
                            isDisplay: false, 
                            outOfStock: true, 
                            errorStatus: 'ScrapeFailed', 
                            updatedAt: new Date().toISOString() 
                        });
                        markedOutOfStock++;
                        failedItems.push({ key: item.key, url: item.url, reason: 'ScrapeFailed / No price detected' });
                        logger.info(`Marked product with ScrapeFailed error: ${item.key}`);
                    } else {
                        successfulUpdates++;
                        if (currentData.outOfStock !== true) { 
                            await productDealsDB.productdealsRef.child(item.key).update({ 
                                isDisplay: true, 
                                outOfStock: false, 
                                errorStatus: null 
                            }); 
                        } else { 
                            await productDealsDB.productdealsRef.child(item.key).update({ 
                                errorStatus: null 
                            }); 
                        }
                    }
                }
            } catch (dbErr) {
                logger.warn(`Failed to check/update out of stock for ${item.key}`, { error: dbErr.message });
                failedItems.push({ key: item.key, url: item.url, reason: dbErr.message });
            }
        }
        
        logger.info(`Stale batch complete: ${successfulUpdates} updated, ${markedOutOfStock} marked out of stock.`);
        
        // 4. Run expired deals cleanup if available
        try {
            const { cleanupExpiredDealsAndBanners } = require('./cleanupExpiredDeals');
            await cleanupExpiredDealsAndBanners();
        } catch (cleanupErr) {
            logger.warn('Failed to run expired deals/banners cleanup (non-fatal):', { error: cleanupErr.message });
        }

        const summary = {
            staleUrlsCount: staleItems.length,
            successfulUpdates,
            markedOutOfStock,
            failed: failedItems.length,
            priceReducedCount: batchResults?.priceReducedCount || 0,
            missedDealsCount: batchResults?.missedDealsCount || 0
        };

        // 5. Log completion and auto-enqueue missed items to commandsQueue for localDaemon!
        await githubActionLogger.completeAction('stale-products-update', summary, failedItems);
        try {
          await executionTracker.endDbUpdateExecution('completed', summary);
        } catch (_) {}

        logger.info('Stale products update finished successfully.');
    } catch (error) {
        logger.error('Stale products update failed:', error);
        await githubActionLogger.failAction('stale-products-update', error);
        try {
          await executionTracker.endDbUpdateExecution('failed', { error: error.message });
        } catch (_) {}
    }
}

if (require.main === module) {
    main().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { getStaleProducts, main };
