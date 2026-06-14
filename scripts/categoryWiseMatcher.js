const { getModuleLogger } = require('../logger/logger');
const { firebaseget } = require('../database/firebaseget');
const updateProduct = require('../database/firebaseDB/firebaseUpdate');
const { getAccessToken } = require('../database/getAccessToken');
const constants = require('../config/constants');
const config = require('../config/config');
const { areSpecsMatching } = require('../utils/specMatcher');


const logger = getModuleLogger('category-matcher');

/**
 * Normalizes a string for matching
 */
function normalizeStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts the main category from a product
 */
function extractCategory(product) {
  if (product.categoryGroup) return product.categoryGroup;
  if (product.hierarchicalCategory && product.hierarchicalCategory.mainCategory) {
    return product.hierarchicalCategory.mainCategory;
  }
  if (product.category && product.category.mainCategory) {
    return product.category.mainCategory;
  }
  return 'Unknown';
}

/**
 * Generates a matching key for a product.
 * Prioritizes model number. If missing, uses brand + first 3 words of title.
 */
function generateMatchingKey(product) {
  if (product.model && product.model.trim() !== '') {
    return `model_${normalizeStr(product.model)}`;
  }
  
  // Fallback to brand + title prefix (mainly for fashion/clothing)
  const brand = normalizeStr(product.brand || '');
  const titleWords = (product.title || '').split(/\s+/).slice(0, 3).join('');
  const titlePrefix = normalizeStr(titleWords);
  
  if (brand || titlePrefix) {
    return `fuzzy_${brand}_${titlePrefix}`;
  }
  
  return null;
}

/**
 * Main matching logic
 */
async function runCategoryWiseMatching() {
  logger.info('Starting Category-Wise DB Matching process...');
  try {
    // 1. Fetch matching config
    logger.info('Fetching category matching rules...');
    const accessToken = await getAccessToken(constants.env);
    const DB_Name = config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
    const baseUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    const configUrl = `${baseUrl}/config/categoryMatchingRules.json?access_token=${accessToken}`;
    
    const configRes = await fetch(configUrl);
    const matchingRules = await configRes.json();
    
    if (!matchingRules || Object.keys(matchingRules).length === 0) {
      logger.info('No category matching rules found in DB. Exiting.');
      return;
    }
    
    logger.info('Matching Rules found:', matchingRules);

    // 2. Fetch all products (shallow) from DB to get keys safely
    logger.info('Fetching product keys (shallow) from DB...');
    const keysUrl = `${baseUrl}/deals.json?access_token=${accessToken}&shallow=true`;
    const keysRes = await fetch(keysUrl);
    const keysData = await keysRes.json() || {};
    const allKeys = Object.keys(keysData);
    logger.info(`Found ${allKeys.length} total keys in DB.`);

    // Take the 300 most recent keys to match
    const recentKeys = allKeys.slice(-300);
    logger.info(`Fetching details for the ${recentKeys.length} most recent products...`);

    const productsData = {};
    const batchSize = 30;
    for (let i = 0; i < recentKeys.length; i += batchSize) {
      const batchKeys = recentKeys.slice(i, i + batchSize);
      const batchPromises = batchKeys.map(async (key) => {
        try {
          const prodUrl = `${baseUrl}/deals/${key}.json?access_token=${accessToken}`;
          const res = await fetch(prodUrl);
          const data = await res.json();
          if (data) {
            productsData[key] = data;
          }
        } catch (err) {
          logger.warn(`Failed to fetch product details for ${key}: ${err.message}`);
        }
      });
      await Promise.all(batchPromises);
    }
    const productKeys = Object.keys(productsData);
    logger.info(`Successfully fetched details for ${productKeys.length} products.`);


    // 3. Group products
    // Structure: category -> matchingKey -> { platform1: productKey1, platform2: productKey2 }
    const groupedProducts = {};
    const eligibleProductsMap = new Map(); // Store product data for easy access later

    for (const key of productKeys) {
      const product = productsData[key];
      if (!product) continue;
      
      const category = extractCategory(product);
      
      // Case insensitive match against rules
      const ruleKey = Object.keys(matchingRules).find(k => k.toLowerCase() === category.toLowerCase());
      if (!ruleKey) continue;
      
      const platform = (product.storeType || '').toLowerCase();
      // Basic normalization to match config (e.g. 'Amazon' -> 'amazon')
      const allowedPlatforms = matchingRules[ruleKey].map(p => p.toLowerCase());
      
      if (!allowedPlatforms.includes(platform)) continue;
      
      const matchingKey = generateMatchingKey(product);
      if (!matchingKey) continue;
      
      if (!groupedProducts[ruleKey]) groupedProducts[ruleKey] = {};
      if (!groupedProducts[ruleKey][matchingKey]) groupedProducts[ruleKey][matchingKey] = {};
      
      // If a platform already has a product for this key, keep the first one (or could merge)
      if (!groupedProducts[ruleKey][matchingKey][platform]) {
        groupedProducts[ruleKey][matchingKey][platform] = key;
        eligibleProductsMap.set(key, product);
      }
    }

    // 4. Determine matches and update
    let updatedCount = 0;
    
    for (const category in groupedProducts) {
      for (const matchingKey in groupedProducts[category]) {
        const platformMap = groupedProducts[category][matchingKey];
        const platformsPresent = Object.keys(platformMap);
        
        // If we found the product on more than 1 platform, it's a match candidate!
        if (platformsPresent.length > 1) {
          // Verify that all platforms actually match specifications with the first one
          const firstPlat = platformsPresent[0];
          const firstProdKey = platformMap[firstPlat];
          const firstProd = eligibleProductsMap.get(firstProdKey);
          
          const validPlatforms = [firstPlat];
          for (let idx = 1; idx < platformsPresent.length; idx++) {
            const currentPlat = platformsPresent[idx];
            const currentProdKey = platformMap[currentPlat];
            const currentProd = eligibleProductsMap.get(currentProdKey);
            
            if (areSpecsMatching(firstProd, currentProd, category)) {
              validPlatforms.push(currentPlat);
            } else {
              logger.warn(`Spec mismatch in category ${category} [${matchingKey}] between ${firstPlat} (${firstProd.title}) and ${currentPlat} (${currentProd.title}). Skipping link.`);
            }
          }

          if (validPlatforms.length > 1) {
            logger.info(`Match verified in ${category} [${matchingKey}] across platforms: ${validPlatforms.join(', ')}`);
            
            // Construct the competitorMatches object
            const competitorMatches = {};
            for (const plat of validPlatforms) {
              // Capitalize platform name for consistency (e.g., 'amazon' -> 'Amazon')
              const formattedPlat = plat.charAt(0).toUpperCase() + plat.slice(1);
              const compProd = eligibleProductsMap.get(platformMap[plat]);
              competitorMatches[formattedPlat] = {
                key: platformMap[plat],
                price: compProd.price || 0,
                link: compProd.links?.avinashbmv || compProd.links?.avinashbmvINR || compProd.productUrl || ''
              };
            }
            
            // Apply to all products in this group
            for (const plat of validPlatforms) {
              const productKey = platformMap[plat];
              const product = eligibleProductsMap.get(productKey);
              
              // Only update if competitorMatches changed
              if (JSON.stringify(product.competitorMatches) !== JSON.stringify(competitorMatches)) {
                product.competitorMatches = competitorMatches;
                
                // Save to Firebase
                logger.debug(`Updating product ${productKey} with new competitor matches`);
                try {
                  await updateProduct(productKey, product, accessToken, constants.env, 'deals');
                  updatedCount++;
                } catch (updateErr) {
                  logger.error(`Failed to update product ${productKey}:`, updateErr.message);
                }
              }
            }
          }
        }
      }
    }
    
    logger.info(`Category-Wise DB Matching complete. Updated ${updatedCount} products.`);
    
  } catch (error) {
    logger.error('Error during Category-Wise DB Matching:', { error: error.message, stack: error.stack });
  }
}

// Allow running standalone
if (require.main === module) {
  runCategoryWiseMatching().then(() => {
    logger.info('Process finished.');
    process.exit(0);
  });
}

module.exports = {
  runCategoryWiseMatching
};
