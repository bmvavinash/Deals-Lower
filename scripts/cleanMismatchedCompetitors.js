process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { areSpecsMatching } = require('../utils/specMatcher');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('cleanMismatchedCompetitors');

async function runCleanup() {
  logger.info("Starting competitor matching cleanup process...");
  
  const collections = ['deals', 'productdeals'];
  let totalChecked = 0;
  let totalDelinked = 0;
  
  for (const collection of collections) {
    logger.info(`Fetching products from collection: '${collection}'...`);
    const targetRef = collection === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
    
    const snapshot = await targetRef.once('value');
    const allProducts = snapshot.val() || {};
    const productKeys = Object.keys(allProducts);
    logger.info(`Retrieved ${productKeys.length} products from '${collection}'`);
    
    const updates = {};
    
    for (const key of productKeys) {
      const product = allProducts[key];
      if (!product || !product.competitorMatches) continue;
      
      totalChecked++;
      
      const compMatches = { ...product.competitorMatches };
      const platforms = Object.keys(compMatches);
      
      // If only self-match or empty, clear it
      if (platforms.length <= 1) {
        updates[`${key}/competitorMatches`] = null;
        totalDelinked++;
        continue;
      }
      
      let hasChange = false;
      
      // Compare this product with each matched competitor product in compMatches
      for (const platform of platforms) {
        const match = compMatches[platform];
        if (!match || match.key === key) continue; // skip self
        
        // Fetch competitor product details from the fetched memory map
        const competitor = allProducts[match.key];
        
        if (!competitor) {
          // Competitor product doesn't exist anymore in the DB, remove the stale link
          delete compMatches[platform];
          hasChange = true;
          logger.info(`[${collection}] Removing stale link to missing competitor ${match.key} from product ${key}`);
          continue;
        }
        
        // Run strict spec match check
        const categoryGroup = product.categoryGroup || competitor.categoryGroup || '';
        const isMatch = areSpecsMatching(product, competitor, categoryGroup);
        
        if (!isMatch) {
          // Spec mismatch! De-link them.
          delete compMatches[platform];
          hasChange = true;
          logger.warn(`[${collection}] SPEC MISMATCH between ${key} ("${product.title}") and competitor ${match.key} ("${competitor.title}"). De-linking.`);
        }
      }
      
      if (hasChange) {
        const remainingPlatforms = Object.keys(compMatches);
        if (remainingPlatforms.length <= 1) {
          // If 1 or 0 competitor matches left, clear competitorMatches entirely
          updates[`${key}/competitorMatches`] = null;
        } else {
          updates[`${key}/competitorMatches`] = compMatches;
        }
        totalDelinked++;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      logger.info(`Applying ${Object.keys(updates).length} updates/de-links to collection '${collection}'...`);
      await targetRef.update(updates);
    }
  }
  
  logger.info(`Cleanup completed. Checked ${totalChecked} matched products. De-linked/cleaned up ${totalDelinked} records.`);
  process.exit(0);
}

runCleanup().catch(err => {
  logger.error("Critical error during cleanup:", err);
  process.exit(1);
});
