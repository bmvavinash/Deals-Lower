/**
 * Script to identify and handle incomplete products (only have categoryGroup, timestamps)
 * Options:
 * 1. Delete incomplete products
 * 2. Mark them for re-extraction
 * 3. Check if full data exists in 'deals' collection and restore
 */

const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('restoreIncompleteProducts');

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

async function restoreIncompleteProducts(targetDb = 'productdeals', action = 'check') {
  try {
    const targetRef = db.ref(targetDb);
    const dealsRef = db.ref('deals'); // Check if full data exists in deals
    
    const snapshot = await targetRef.once('value');
    const products = snapshot.val() || {};
    
    const incompleteProducts = [];
    const completeProducts = [];
    
    console.log(`\n🔍 Analyzing products in ${targetDb}...\n`);
    
    for (const [productKey, product] of Object.entries(products)) {
      if (!product) continue;
      
      const fields = Object.keys(product);
      const hasEssentialFields = product.title && product.price && product.productCode;
      const isIncomplete = fields.length <= 5 && !hasEssentialFields;
      
      if (isIncomplete) {
        incompleteProducts.push({
          key: productKey,
          productCode: product.productCode || productKey,
          fields: fields,
          fieldCount: fields.length,
          categoryGroup: product.categoryGroup || 'N/A'
        });
      } else {
        completeProducts.push(productKey);
      }
    }
    
    console.log(`Total Products: ${Object.keys(products).length}`);
    console.log(`✅ Complete Products: ${completeProducts.length}`);
    console.log(`❌ Incomplete Products: ${incompleteProducts.length}\n`);
    
    if (incompleteProducts.length === 0) {
      console.log('✅ No incomplete products found!');
      process.exit(0);
    }
    
    // Check if incomplete products exist in 'deals' collection with full data
    console.log(`\n🔍 Checking if incomplete products exist in 'deals' collection...\n`);
    
    const dealsSnapshot = await dealsRef.once('value');
    const dealsProducts = dealsSnapshot.val() || {};
    const restoreableProducts = [];
    
    for (const incomplete of incompleteProducts.slice(0, 100)) { // Check first 100
      const productKey = incomplete.key;
      const fullProduct = dealsProducts[productKey];
      
      if (fullProduct && fullProduct.title && fullProduct.price) {
        restoreableProducts.push({
          key: productKey,
          incomplete: incomplete,
          full: fullProduct
        });
      }
    }
    
    console.log(`Found ${restoreableProducts.length} products that can be restored from 'deals' collection\n`);
    
    if (action === 'delete') {
      console.log('\n🗑️  Deleting incomplete products...');
      console.log(`   Total incomplete products to delete: ${incompleteProducts.length}`);
      
      // Delete in batches of 500 (Firebase limit)
      const batchSize = 500;
      let deletedCount = 0;
      
      for (let i = 0; i < incompleteProducts.length; i += batchSize) {
        const batch = incompleteProducts.slice(i, i + batchSize);
        const deletions = {};
        batch.forEach(item => {
          deletions[item.key] = null; // Set to null to delete
        });
        
        await targetRef.update(deletions);
        deletedCount += batch.length;
        console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} products) - Total: ${deletedCount}/${incompleteProducts.length}`);
      }
      
      console.log(`\n✅ Successfully deleted ${deletedCount} incomplete products`);
      
    } else if (action === 'restore' && restoreableProducts.length > 0) {
      console.log('\n💾 Restoring products from "deals" collection...');
      
      const restores = {};
      for (const item of restoreableProducts) {
        // Merge existing categoryGroup with full product data
        restores[item.key] = {
          ...item.full,
          categoryGroup: item.incomplete.categoryGroup || item.full.categoryGroup,
          updateTimestamp: new Date().toISOString(),
          updatedatetime: new Date().getTime()
        };
      }
      
      await targetRef.update(restores);
      console.log(`✅ Restored ${restoreableProducts.length} products`);
      
    } else {
      console.log('\n📊 Incomplete Products Summary (first 20):');
      incompleteProducts.slice(0, 20).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.key} - ${item.fieldCount} fields - categoryGroup: ${item.categoryGroup}`);
      });
      
      if (restoreableProducts.length > 0) {
        console.log(`\n💡 ${restoreableProducts.length} products can be restored from 'deals' collection`);
        console.log(`   Run with action='restore' to restore them`);
      }
      
      console.log(`\n💡 To delete incomplete products, run with action='delete'`);
    }
    
    return {
      total: Object.keys(products).length,
      complete: completeProducts.length,
      incomplete: incompleteProducts.length,
      restoreable: restoreableProducts.length
    };
    
  } catch (error) {
    logger.error('Error restoring incomplete products', { error: error.message, stack: error.stack });
    throw error;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetDb = args[0] || 'productdeals';
  const action = args[1] || 'check'; // check, restore, delete
  
  console.log('\n🔧 Restore Incomplete Products Script');
  console.log('='.repeat(80));
  console.log(`Target Database: ${targetDb}`);
  console.log(`Action: ${action}`);
  console.log('='.repeat(80));
  
  restoreIncompleteProducts(targetDb, action)
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

module.exports = { restoreIncompleteProducts };
