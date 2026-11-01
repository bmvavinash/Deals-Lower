// services/categorySeedManager.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { getModuleLogger } = require('../logger/logger');
const { MASTER_CATEGORY_CATALOG, buildPlatformSearchUrl } = require('../config/masterCategorySeeds');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');

const logger = getModuleLogger('categorySeedManager');

class CategorySeedManager {
  /**
   * Resolves the batch of seed URLs to scrape for a category run.
   * Uses round-robin rotation backed by Firebase RTDB so 100% of subcategories
   * and popular search terms are visited across hourly runs.
   * 
   * @param {string} category - Category key (e.g. 'electronics', 'fashion')
   * @param {string|null} [targetQueryOverride=null] - On-demand single query override
   * @param {number} [rotatingBatchSize=8] - Number of rotating queries per run
   * @returns {Promise<{ category: string, seeds: string[], selectedQueries: string[], nextPointer: number }>}
   */
  async getSeedsForCategory(category, targetQueryOverride = null, rotatingBatchSize = 8) {
    const catConfig = MASTER_CATEGORY_CATALOG[category.toLowerCase()];
    if (!catConfig) {
      throw new Error(`Category "${category}" not found in MASTER_CATEGORY_CATALOG. Valid keys: ${Object.keys(MASTER_CATEGORY_CATALOG).join(', ')}`);
    }

    const { coreQueries, rotatingQueries, supportedStores } = catConfig;

    // 1. If an on-demand query was specified via workflow_dispatch / CLI
    if (targetQueryOverride && typeof targetQueryOverride === 'string' && targetQueryOverride.trim() !== '') {
      const cleanTarget = targetQueryOverride.trim();
      logger.info(`Target query override specified for ${category}: "${cleanTarget}"`);
      
      const seeds = [];
      for (const store of supportedStores) {
        seeds.push(buildPlatformSearchUrl(store, cleanTarget));
      }

      return {
        category,
        seeds,
        selectedQueries: [cleanTarget],
        nextPointer: null,
        isOverride: true
      };
    }

    // 2. Fetch current rotation pointer from Firebase RTDB
    let currentPointer = 0;
    let pointerRef = null;

    try {
      if (productDealsDB && productDealsDB.productdealsRef) {
        pointerRef = productDealsDB.productdealsRef.parent.child(`schedulerState/categoryPointers/${category}`);
        const snap = await pointerRef.once('value');
        const val = snap.val();
        if (typeof val === 'number') {
          currentPointer = val;
        } else if (val && typeof val.pointer === 'number') {
          currentPointer = val.pointer;
        }
      }
    } catch (dbErr) {
      logger.warn(`Could not fetch category pointer for ${category}, defaulting to 0:`, { error: dbErr.message });
      currentPointer = 0;
    }

    // 3. Select queries: 2 Core Queries (always) + rotatingBatchSize queries from pool
    const selectedRotating = [];
    const totalRotating = rotatingQueries.length;

    for (let i = 0; i < rotatingBatchSize; i++) {
      const idx = (currentPointer + i) % totalRotating;
      selectedRotating.push(rotatingQueries[idx]);
    }

    const selectedQueries = Array.from(new Set([...coreQueries, ...selectedRotating]));
    const nextPointer = (currentPointer + rotatingBatchSize) % totalRotating;

    // 4. Update the pointer in Firebase RTDB
    if (pointerRef) {
      try {
        await pointerRef.set({
          pointer: nextPointer,
          lastUpdated: new Date().toISOString(),
          lastQueries: selectedQueries
        });
        logger.info(`Advanced pointer for ${category}: ${currentPointer} -> ${nextPointer} (Total pool: ${totalRotating})`);
      } catch (saveErr) {
        logger.warn(`Failed to save next category pointer for ${category}:`, { error: saveErr.message });
      }
    }

    // 5. Build seed URLs across supported platforms
    const seeds = [];
    for (const query of selectedQueries) {
      for (const store of supportedStores) {
        seeds.push(buildPlatformSearchUrl(store, query));
      }
    }

    logger.info(`Resolved ${seeds.length} seed URLs for ${category} (${selectedQueries.length} queries across ${supportedStores.join(', ')})`, {
      selectedQueries
    });

    return {
      category,
      seeds,
      selectedQueries,
      nextPointer,
      isOverride: false
    };
  }
}

const categorySeedManager = new CategorySeedManager();
module.exports = {
  categorySeedManager,
  CategorySeedManager
};
