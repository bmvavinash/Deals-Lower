/**
 * SAFE version of categoryGroup fix that preserves ALL existing product data
 * This version reads each product, merges categoryGroup, and saves the complete product back
 */

const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');
const { extractCategoryGroup, mapToStandardCategoryGroup } = require('./fixCategoryGroupInDatabase');

const logger = getModuleLogger('fixCategoryGroupSafely');

const dbname = constants.postingTypesConfig[constants.type].DB;
const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
  });
}

const db = admin.database();

async function fixCategoryGroupSafely(targetDb = 'productdeals', dryRun = false) {
  try {
    const targetRef = db.ref(targetDb);
    const snapshot = await targetRef.once('value');
    const products = snapshot.val() || {};
    
    const totalProducts = Object.keys(products).length;
    let fixedCount = 0;
    let skippedCount = 0;
    let incompleteCount = 0;
    const updates = {};
    
    console.log(`\n📦 Processing ${totalProducts} products from ${targetDb} database...`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE (will update database)'}\n`);
    
    for (const [productKey, product] of Object.entries(products)) {
      if (!product) continue;
      
      // Skip products that are incomplete (less than 5 fields and missing essential fields)
      const fields = Object.keys(product);
      const hasEssentialFields = product.title || product.price || product.productCode;
      const isIncomplete = fields.length <= 5 && !hasEssentialFields;
      
      if (isIncomplete) {
        incompleteCount++;
        if (incompleteCount <= 10) {
          console.log(`  ⚠️  Skipping incomplete product: ${productKey} (only ${fields.length} fields)`);
        }
        continue;
      }
      
      const currentCategoryGroup = product.categoryGroup || '';
      const extractedCategoryGroup = extractCategoryGroup(product);
      
      // Check if update is needed
      if (!extractedCategoryGroup || currentCategoryGroup === extractedCategoryGroup) {
        skippedCount++;
        continue;
      }
      
      // Prepare SAFE update - preserve ALL existing product data
      fixedCount++;
      if (!dryRun) {
        // Merge categoryGroup with existing product data - preserve everything
        updates[productKey] = {
          ...product, // Preserve ALL existing fields
          categoryGroup: extractedCategoryGroup, // Update categoryGroup
          updateTimestamp: new Date().toISOString(),
          updatedatetime: new Date().getTime()
        };
      }
      
      // Log every 100 products
      if (fixedCount % 100 === 0) {
        console.log(`  Processed ${fixedCount + skippedCount + incompleteCount}/${totalProducts} products...`);
      }
    }
    
    // Apply updates in batches
    if (!dryRun && Object.keys(updates).length > 0) {
      console.log(`\n💾 Updating ${Object.keys(updates).length} products in database...`);
      
      const updateKeys = Object.keys(updates);
      const batchSize = 500;
      
      for (let i = 0; i < updateKeys.length; i += batchSize) {
        const batch = updateKeys.slice(i, i + batchSize);
        const batchUpdates = {};
        batch.forEach(key => {
          batchUpdates[key] = updates[key];
        });
        
        await targetRef.update(batchUpdates);
        console.log(`  ✅ Updated batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)`);
      }
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Products: ${totalProducts}`);
    console.log(`✅ Fixed (categoryGroup updated): ${fixedCount}`);
    console.log(`⏭️  Skipped (already correct): ${skippedCount}`);
    console.log(`⚠️  Incomplete (skipped): ${incompleteCount}`);
    console.log('='.repeat(80));
    
    if (incompleteCount > 0) {
      console.log(`\n⚠️  Warning: ${incompleteCount} incomplete products were skipped.`);
      console.log(`   These products need to be re-extracted via bulk updates.`);
    }
    
    return {
      total: totalProducts,
      fixed: fixedCount,
      skipped: skippedCount,
      incomplete: incompleteCount
    };
    
  } catch (error) {
    logger.error('Error fixing categoryGroup safely', { error: error.message, stack: error.stack });
    throw error;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetDb = args[0] || 'productdeals';
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  console.log('\n🔧 SAFE CategoryGroup Fix Script');
  console.log('='.repeat(80));
  console.log(`Target Database: ${targetDb}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log('='.repeat(80));
  
  fixCategoryGroupSafely(targetDb, dryRun)
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

module.exports = { fixCategoryGroupSafely };
