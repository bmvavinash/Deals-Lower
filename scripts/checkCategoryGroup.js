/**
 * Quick script to check categoryGroup status in database
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

async function checkCategoryGroup() {
  try {
    const ref = db.ref('productdeals');
    
    // Check for home-kitchen
    console.log('\n🔍 Checking for products with categoryGroup="home-kitchen"...');
    const homeKitchenSnap = await ref.orderByChild('categoryGroup').equalTo('home-kitchen').limitToFirst(10).once('value');
    const homeKitchenProducts = homeKitchenSnap.val() || {};
    console.log(`Found: ${Object.keys(homeKitchenProducts).length} products`);
    
    // Check total products
    const allSnap = await ref.limitToFirst(100).once('value');
    const allProducts = allSnap.val() || {};
    const totalWithCategoryGroup = Object.values(allProducts).filter(p => p && p.categoryGroup).length;
    const totalWithoutCategoryGroup = Object.values(allProducts).filter(p => p && !p.categoryGroup).length;
    
    console.log('\n📊 Sample Analysis (first 100 products):');
    console.log(`  Products with categoryGroup: ${totalWithCategoryGroup}`);
    console.log(`  Products without categoryGroup: ${totalWithoutCategoryGroup}`);
    
    // Check what categoryGroup values exist
    const categoryGroups = {};
    Object.values(allProducts).forEach(p => {
      if (p && p.categoryGroup) {
        categoryGroups[p.categoryGroup] = (categoryGroups[p.categoryGroup] || 0) + 1;
      }
    });
    
    console.log('\n📁 CategoryGroup Values Found (in sample):');
    Object.entries(categoryGroups).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`  "${cat}": ${count} products`);
    });
    
    // Check sample products without categoryGroup
    const withoutCategoryGroup = Object.entries(allProducts).filter(([k, p]) => p && !p.categoryGroup).slice(0, 3);
    if (withoutCategoryGroup.length > 0) {
      console.log('\n⚠️  Sample Products WITHOUT categoryGroup:');
      withoutCategoryGroup.forEach(([key, product]) => {
        console.log(`  ${key}:`);
        console.log(`    Title: ${(product.title || 'N/A').substring(0, 60)}`);
        console.log(`    categoryKey: ${product.categoryKey || 'N/A'}`);
        console.log(`    hierarchicalCategory.mainCategory: ${product.hierarchicalCategory?.mainCategory || 'N/A'}`);
        console.log(`    productCategory: ${product.productCategory || 'N/A'}`);
      });
    }
    
    // Test query for home-kitchen
    if (Object.keys(homeKitchenProducts).length === 0) {
      console.log('\n❌ ISSUE: No products found with categoryGroup="home-kitchen"');
      console.log('   This is why your Firebase query returns empty!');
      console.log('\n💡 SOLUTION: Run the fix script to add categoryGroup to existing products:');
      console.log('   node scripts/fixCategoryGroupInDatabase.js productdeals');
    } else {
      console.log('\n✅ Products found with categoryGroup="home-kitchen"');
      const firstKey = Object.keys(homeKitchenProducts)[0];
      const firstProduct = homeKitchenProducts[firstKey];
      console.log(`\n   Sample Product:`);
      console.log(`     Key: ${firstKey}`);
      console.log(`     Title: ${(firstProduct.title || 'N/A').substring(0, 60)}`);
      console.log(`     categoryGroup: ${firstProduct.categoryGroup}`);
      console.log(`     categoryKey: ${firstProduct.categoryKey || 'N/A'}`);
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

checkCategoryGroup();
