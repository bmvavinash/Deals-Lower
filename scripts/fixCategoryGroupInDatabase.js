/**
 * Script to fix categoryGroup for existing products in database
 * This script will:
 * 1. Fetch all products from productdeals database
 * 2. Extract/derive correct categoryGroup from categoryKey or hierarchicalCategory
 * 3. Update products with correct categoryGroup value
 */

const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('fixCategoryGroup');

// Initialize Firebase Admin
const dbname = constants.postingTypesConfig[constants.type].DB;
const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const DB_Region = config.DATABASE_CONFIG[`${dbname}_REGION`] || 'asia-southeast1';

console.log(`Initializing Firebase with DB: ${DB_Name}, Token File: ${filePath}`);
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${DB_Name}-default-rtdb.${DB_Region}.firebasedatabase.app`
  });
  console.log(`Firebase initialized successfully for ${DB_Name}`);
} else {
  console.log(`Firebase already initialized for ${DB_Name}`);
}

const db = admin.database();

/**
 * Normalize category name to categoryGroup format
 * Examples: "Home & Kitchen" -> "home-kitchen", "Beauty & Personal Care" -> "beauty-personal-care"
 */
function normalizeCategoryGroup(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') return '';
  
  return categoryName.toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/&/g, '')              // Remove ampersands
    .replace(/[^a-z0-9-]/g, '')     // Remove special chars except hyphens
    .replace(/-+/g, '-')            // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

/**
 * Map display names to standard categoryGroup values
 */
function mapToStandardCategoryGroup(catName) {
  if (!catName) return '';
  const normalized = normalizeCategoryGroup(catName);
  
  // Map common variations to standard categoryGroup values
  const categoryMappings = {
    // Home & Kitchen variations
    'home-garden': 'home-kitchen',
    'home-kitchen': 'home-kitchen',
    'homeandgarden': 'home-kitchen',
    'homeandkitchen': 'home-kitchen',
    // Beauty & Personal Care variations
    'beauty-personal-care': 'beauty-personal-care',
    'beautypersonalcare': 'beauty-personal-care',
    'beauty': 'beauty-personal-care',
    'personal-care': 'beauty-personal-care',
    // Sports & Fitness variations
    'sports-fitness': 'sports-fitness',
    'sportsfitness': 'sports-fitness',
    'sports': 'sports-fitness',
    'fitness': 'sports-fitness',
    // Books & Stationery variations
    'books-stationery': 'books-stationery',
    'booksstationery': 'books-stationery',
    'books': 'books-stationery',
    'stationery': 'books-stationery',
    // Baby & Kids variations
    'baby-kids': 'baby-kids',
    'babykids': 'baby-kids',
    'baby': 'baby-kids',
    'kids': 'baby-kids',
    // Tools & Hardware variations
    'tools-hardware': 'tools-hardware',
    'toolshardware': 'tools-hardware',
    'tools': 'tools-hardware',
    'hardware': 'tools-hardware',
    // Music & Entertainment variations
    'music-entertainment': 'music-entertainment',
    'musicentertainment': 'music-entertainment',
    'music': 'music-entertainment',
    'entertainment': 'music-entertainment',
    // Pet Supplies variations
    'pet-supplies': 'pet-supplies',
    'petsupplies': 'pet-supplies',
    'pet': 'pet-supplies',
    // Standard categories (no change needed)
    'electronics': 'electronics',
    'fashion': 'fashion',
    'automotive': 'automotive',
    'grocery': 'grocery'
  };
  
  return categoryMappings[normalized] || normalized;
}

/**
 * Extract categoryGroup from product data
 */
function extractCategoryGroup(product) {
  // 1. If categoryGroup exists and looks correct, use it
  if (product.categoryGroup && typeof product.categoryGroup === 'string') {
    const normalized = product.categoryGroup.toLowerCase().trim();
    if (normalized && (normalized.includes('-') || ['electronics', 'fashion', 'grocery', 'automotive'].includes(normalized))) {
      return normalized;
    }
  }
  
  // 2. Extract from categoryKey (format: platform_category)
  if (product.categoryKey && typeof product.categoryKey === 'string' && product.categoryKey.includes('_')) {
    const categoryFromKey = product.categoryKey.split('_').pop() || '';
    if (categoryFromKey) {
      return categoryFromKey.toLowerCase().trim();
    }
  }
  
  // 3. Normalize from hierarchicalCategory.mainCategory
  if (product.hierarchicalCategory?.mainCategory) {
    return mapToStandardCategoryGroup(product.hierarchicalCategory.mainCategory);
  }
  
  // 4. Normalize from productCategory or categoryLevel1
  if (product.productCategory) {
    return mapToStandardCategoryGroup(product.productCategory);
  }
  
  if (product.categoryLevel1) {
    return mapToStandardCategoryGroup(product.categoryLevel1);
  }
  
  // 5. Fallback to category.mainCategory
  if (product.category?.mainCategory) {
    return mapToStandardCategoryGroup(product.category.mainCategory);
  }
  
  return '';
}

/**
 * Fix categoryGroup for all products
 */
async function fixCategoryGroupInDatabase(targetDb = 'productdeals', dryRun = false) {
  try {
    const targetRef = db.ref(targetDb);
    const snapshot = await targetRef.once('value');
    const products = snapshot.val() || {};
    
    const totalProducts = Object.keys(products).length;
    let fixedCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;
    const updates = {};
    const invalidProducts = [];
    
    console.log(`\n📦 Processing ${totalProducts} products from ${targetDb} database...`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE (will update database)'}\n`);
    
    for (const [productKey, product] of Object.entries(products)) {
      if (!product) continue;
      
      const currentCategoryGroup = product.categoryGroup || '';
      const extractedCategoryGroup = extractCategoryGroup(product);
      
      // Check if categoryGroup needs fixing
      if (!extractedCategoryGroup) {
        invalidCount++;
        invalidProducts.push({
          key: productKey,
          productCode: product.productCode || productKey,
          title: product.title || 'N/A',
          categoryKey: product.categoryKey || 'N/A',
          mainCategory: product.hierarchicalCategory?.mainCategory || product.productCategory || 'N/A'
        });
        continue;
      }
      
      // Check if update is needed
      if (currentCategoryGroup === extractedCategoryGroup) {
        skippedCount++;
        continue;
      }
      
      // Prepare update - ONLY update categoryGroup if product has existing data
      // Skip products that have less than 5 fields (incomplete records)
      const existingFields = Object.keys(product).length;
      const hasMinimalData = existingFields >= 5 || product.title || product.price || product.productCode;
      
      if (!hasMinimalData) {
        // Skip incomplete products - they should be re-extracted or deleted
        invalidCount++;
        invalidProducts.push({
          key: productKey,
          productCode: product.productCode || productKey,
          title: product.title || 'N/A',
          categoryKey: product.categoryKey || 'N/A',
          mainCategory: product.hierarchicalCategory?.mainCategory || product.productCategory || 'N/A',
          reason: `Incomplete data (only ${existingFields} fields)`
        });
        continue;
      }
      
      fixedCount++;
      if (!dryRun) {
        // Use proper merge path to preserve all existing data
        // Update only the categoryGroup field at the specific path
        const updatePath = `${productKey}/categoryGroup`;
        updates[updatePath] = extractedCategoryGroup;
        // Also update timestamps
        updates[`${productKey}/updateTimestamp`] = new Date().toISOString();
        updates[`${productKey}/updatedatetime`] = new Date().getTime();
      }
      
      // Log every 100 products
      if (fixedCount % 100 === 0) {
        console.log(`  Processed ${fixedCount + skippedCount + invalidCount}/${totalProducts} products...`);
      }
    }
    
    // Apply updates
    if (!dryRun && Object.keys(updates).length > 0) {
      console.log(`\n💾 Updating ${Object.keys(updates).length} products in database...`);
      
      // Update in batches of 500 (Firebase limit)
      const updateKeys = Object.keys(updates);
      const batchSize = 500;
      
      // Group updates by product key for batching
      const updatesByProduct = {};
      Object.entries(updates).forEach(([path, value]) => {
        const productKey = path.split('/')[0];
        if (!updatesByProduct[productKey]) {
          updatesByProduct[productKey] = {};
        }
        const fieldPath = path.split('/').slice(1).join('/');
        if (fieldPath) {
          updatesByProduct[productKey][fieldPath] = value;
        } else {
          updatesByProduct[productKey] = value;
        }
      });
      
      const productKeys = Object.keys(updatesByProduct);
      for (let i = 0; i < productKeys.length; i += batchSize) {
        const batch = productKeys.slice(i, i + batchSize);
        const batchUpdates = {};
        batch.forEach(key => {
          batchUpdates[key] = updatesByProduct[key];
        });
        
        await targetRef.update(batchUpdates);
        console.log(`  ✅ Updated batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)`);
      }
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Products: ${totalProducts}`);
    console.log(`✅ Fixed: ${fixedCount} (will be ${dryRun ? 'updated' : 'updated'})`);
    console.log(`⏭️  Skipped (already correct): ${skippedCount}`);
    console.log(`❌ Invalid (cannot determine categoryGroup): ${invalidCount}`);
    console.log('='.repeat(80));
    
    if (invalidProducts.length > 0 && invalidProducts.length <= 20) {
      console.log('\n⚠️  Invalid Products (first 20):');
      invalidProducts.slice(0, 20).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.productCode} - ${item.title.substring(0, 50)}`);
        console.log(`     CategoryKey: ${item.categoryKey}, MainCategory: ${item.mainCategory}`);
      });
    } else if (invalidProducts.length > 20) {
      console.log(`\n⚠️  ${invalidProducts.length} products have invalid categoryGroup (showing first 20 above)`);
    }
    
    // Category distribution
    if (!dryRun && fixedCount > 0) {
      const categoryDistribution = {};
      Object.values(updates).forEach(update => {
        const catGroup = update.categoryGroup;
        categoryDistribution[catGroup] = (categoryDistribution[catGroup] || 0) + 1;
      });
      
      console.log('\n📁 Category Group Distribution:');
      Object.entries(categoryDistribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          console.log(`  ${category}: ${count} products`);
        });
    }
    
    return {
      total: totalProducts,
      fixed: fixedCount,
      skipped: skippedCount,
      invalid: invalidCount,
      invalidProducts: invalidProducts.slice(0, 50) // Return first 50 invalid products
    };
    
  } catch (error) {
    logger.error('Error fixing categoryGroup', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const targetDb = args[0] || 'productdeals';
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  console.log('\n🔧 CategoryGroup Fix Script');
  console.log('='.repeat(80));
  console.log(`Target Database: ${targetDb}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log('='.repeat(80));
  
  fixCategoryGroupInDatabase(targetDb, dryRun)
    .then(result => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Fatal error in script', { error: error.message, stack: error.stack });
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { fixCategoryGroupInDatabase, extractCategoryGroup, normalizeCategoryGroup, mapToStandardCategoryGroup };
