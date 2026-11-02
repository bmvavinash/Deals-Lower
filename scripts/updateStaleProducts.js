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
 * Checks whether an active Sale is currently live via dealsConfig, active banners, or environment flag.
 */
async function checkIsSaleLive() {
  if (process.env.IS_SALE_LIVE === 'true') return true;
  try {
    const dealsConfigSnap = await productDealsDB.productdealsRef.parent.child('dealsConfig/liveDealActive').once('value');
    if (dealsConfigSnap.val() === true) return true;

    const bannersSnap = await productDealsDB.productdealsRef.parent.child('banners').once('value');
    const banners = bannersSnap.val();
    if (banners && Object.values(banners).some(b => b && b.isActive)) return true;
  } catch (_) {}
  return false;
}

/**
 * Prioritized Cycled Sequence for Stale Product Discovery:
 * - Priority 1: > 1 year old (or missing / invalid updatedAt)
 * - Priority 2: > 6 months old (6m to 1y)
 * - Priority 3: > 1 month old (1m to 6m)
 * - Priority 4: > 1 week old (7d to 1m)
 * - Priority 5: > 1 day old (24h to 7d)
 * - Priority 6: > 2 hours old (2h to 24h) [or > 1 hour if Sale is Live]
 */
async function getStaleProducts(maxItems = 12) {
  try {
    const isSaleLive = await checkIsSaleLive();
    logger.info(`Stale product cycle check: isSaleLive=${isSaleLive}`);

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
    logger.info(`Total products in database: ${allKeys.length}. Sampling across historical, mid, and recent eras...`);

    // Sample across the key space: oldest/historical (first slice), mid range, and newest (last slice)
    const sampleSize = Math.min(150, allKeys.length);
    const sliceCount = Math.floor(sampleSize / 3);
    const oldestKeys = allKeys.slice(0, sliceCount);
    const newestKeys = allKeys.slice(-sliceCount);
    const middleKeys = [];
    const midStart = sliceCount;
    const midEnd = Math.max(sliceCount, allKeys.length - sliceCount);
    for (let i = 0; i < sliceCount; i++) {
      const idx = midStart + Math.floor(Math.random() * (midEnd - midStart));
      if (allKeys[idx]) middleKeys.push(allKeys[idx]);
    }
    const sampleKeys = Array.from(new Set([...oldestKeys, ...middleKeys, ...newestKeys]));

    const now = Date.now();
    const H1 = 1 * 3600 * 1000;
    const H2 = 2 * 3600 * 1000;
    const D1 = 24 * 3600 * 1000;
    const D7 = 7 * D1;
    const M1 = 30 * D1;
    const M6 = 180 * D1;
    const Y1 = 365 * D1;

    const evaluatedCandidates = [];
    const chunkSize = 15;

    for (let i = 0; i < sampleKeys.length; i += chunkSize) {
      const chunk = sampleKeys.slice(i, i + chunkSize);
      const promises = chunk.map(async (key) => {
        try {
          const snap = await productDealsDB.productdealsRef.child(key).once('value');
          const product = snap.val();
          if (!product) return null;
          const url = product.productUrl || product.url;
          if (!url) return null;

          let priorityTier = 999;
          let ageDiff = Infinity;
          let tierLabel = '';

          if (!product.updatedAt) {
            priorityTier = 1;
            tierLabel = '>1yr / Missing updatedAt';
          } else {
            const updateTime = new Date(product.updatedAt).getTime();
            if (isNaN(updateTime)) {
              priorityTier = 1;
              tierLabel = '>1yr / Invalid updatedAt';
            } else {
              ageDiff = now - updateTime;
              if (ageDiff >= Y1) {
                priorityTier = 1;
                tierLabel = '> 1 Year';
              } else if (ageDiff >= M6) {
                priorityTier = 2;
                tierLabel = '> 6 Months';
              } else if (ageDiff >= M1) {
                priorityTier = 3;
                tierLabel = '> 1 Month';
              } else if (ageDiff >= D7) {
                priorityTier = 4;
                tierLabel = '> 1 Week';
              } else if (ageDiff >= D1) {
                priorityTier = 5;
                tierLabel = '> 1 Day';
              } else if (ageDiff >= (isSaleLive ? H1 : H2)) {
                priorityTier = 6;
                tierLabel = isSaleLive ? '> 1 Hour (Live Sale)' : '> 2 Hours';
              }
            }
          }

          if (priorityTier <= 6) {
            return {
              key,
              url,
              oldUpdatedAt: product.updatedAt || null,
              priorityTier,
              ageDiff,
              tierLabel
            };
          }
        } catch (_) {}
        return null;
      });

      const chunkResults = await Promise.all(promises);
      for (const res of chunkResults) {
        if (res) evaluatedCandidates.push(res);
      }
    }

    // Sort strictly by priorityTier ASC (Priority 1 first, then 2, 3...), and by ageDiff DESC within tier
    evaluatedCandidates.sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      return b.ageDiff - a.ageDiff;
    });

    const selectedStaleItems = evaluatedCandidates.slice(0, maxItems);
    
    // Log tier distribution
    const tierCounts = {};
    for (const item of selectedStaleItems) {
      tierCounts[item.tierLabel] = (tierCounts[item.tierLabel] || 0) + 1;
    }
    logger.info(`Selected ${selectedStaleItems.length} stale items by priority cycle:`, tierCounts);

    return selectedStaleItems;
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
        const staleItems = await getStaleProducts(12);
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
                        // Scraper completely failed on it -> hide from display & flag error, keep outOfStock untouched per user rule
                        await productDealsDB.productdealsRef.child(item.key).update({ 
                            isDisplay: false, 
                            errorStatus: 'ScrapeFailed', 
                            updatedAt: new Date().toISOString() 
                        });
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

module.exports = { getStaleProducts, main, checkIsSaleLive };
