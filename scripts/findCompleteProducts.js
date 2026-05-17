/**
 * Find products with complete data to understand the structure
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

async function findCompleteProducts() {
  try {
    const ref = db.ref('productdeals');
    
    // Get a sample of products with title (complete products)
    const snapshot = await ref.orderByChild('title').limitToFirst(5).once('value');
    const products = snapshot.val() || {};
    
    console.log('\n📦 Sample Complete Products:\n');
    
    for (const [key, product] of Object.entries(products)) {
      if (product && product.title) {
        console.log(`Product Key: ${key}`);
        console.log(`  Title: ${(product.title || '').substring(0, 60)}`);
        console.log(`  Price: ${product.price || 'N/A'}`);
        console.log(`  Discount: ${product.discountPercentage || product.discount || 'N/A'}`);
        console.log(`  categoryGroup: ${product.categoryGroup || 'N/A'}`);
        console.log(`  Total Fields: ${Object.keys(product).length}`);
        console.log(`  Fields: ${Object.keys(product).slice(0, 15).join(', ')}...\n`);
      }
    }
    
    // Also check if there are products in 'deals' collection
    const dealsRef = db.ref('deals');
    const dealsSnapshot = await dealsRef.orderByChild('title').limitToFirst(2).once('value');
    const dealsProducts = dealsSnapshot.val() || {};
    
    if (Object.keys(dealsProducts).length > 0) {
      console.log('\n📦 Sample Products from "deals" collection:\n');
      for (const [key, product] of Object.entries(dealsProducts)) {
        if (product && product.title) {
          console.log(`Product Key: ${key}`);
          console.log(`  Title: ${(product.title || '').substring(0, 60)}`);
          console.log(`  categoryGroup: ${product.categoryGroup || 'N/A'}`);
          console.log(`  Total Fields: ${Object.keys(product).length}\n`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findCompleteProducts();
