/**
 * Check full product data structure in database
 */

const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');

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

async function checkProductData() {
  try {
    const ref = db.ref('productdeals');
    
    // Check a few products
    const productKeys = ['1630231', '1630364', '6143128', '7506423', '8174579'];
    
    console.log('\n🔍 Checking product data structure...\n');
    
    for (const key of productKeys) {
      const snapshot = await ref.child(key).once('value');
      const product = snapshot.val();
      
      if (!product) {
        console.log(`❌ Product ${key}: NOT FOUND`);
        continue;
      }
      
      const fields = Object.keys(product);
      const hasEssentialFields = ['title', 'price', 'discountPercentage', 'productCode'].some(f => product[f]);
      
      console.log(`\n📦 Product ${key}:`);
      console.log(`   Total fields: ${fields.length}`);
      console.log(`   Has essential fields: ${hasEssentialFields ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Fields: ${fields.slice(0, 20).join(', ')}${fields.length > 20 ? '...' : ''}`);
      
      if (!hasEssentialFields) {
        console.log(`   ⚠️  Missing essential product data!`);
        console.log(`   Sample data:`, JSON.stringify(product, null, 2).substring(0, 300));
      } else {
        console.log(`   ✅ Has complete product data`);
        console.log(`   Title: ${(product.title || 'N/A').substring(0, 50)}`);
        console.log(`   Price: ${product.price || 'N/A'}`);
        console.log(`   Discount: ${product.discountPercentage || 'N/A'}`);
        console.log(`   categoryGroup: ${product.categoryGroup || 'N/A'}`);
      }
    }
    
    // Also check query results
    console.log('\n\n🔍 Checking query results...\n');
    const querySnapshot = await ref.orderByChild('categoryGroup').equalTo('home-kitchen').limitToFirst(3).once('value');
    const queryResults = querySnapshot.val() || {};
    
    console.log(`Query returned ${Object.keys(queryResults).length} products`);
    
    for (const [key, product] of Object.entries(queryResults)) {
      const fields = Object.keys(product);
      console.log(`\n📦 Query Result - Product ${key}:`);
      console.log(`   Fields returned: ${fields.length}`);
      console.log(`   Fields: ${fields.join(', ')}`);
      
      if (fields.length <= 5) {
        console.log(`   ⚠️  WARNING: Only ${fields.length} fields returned!`);
        console.log(`   Full data:`, JSON.stringify(product, null, 2));
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'PERMISSION_DENIED') {
      console.error('   Firebase permission denied. Check security rules.');
    }
    process.exit(1);
  }
}

checkProductData();
