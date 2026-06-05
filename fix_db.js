const { productDealsDB } = require('./database/firebaseDB/productDealsDB');
async function fixDB(dbRef, dbName) {
  const snapshot = await dbRef.once('value');
  const products = snapshot.val() || {};
  let fixedCount = 0;
  for (const [key, p] of Object.entries(products)) {
    if (!p.productUrl) continue;
    let expectedType = '';
    if (p.productUrl.includes('amazon.')) expectedType = 'Amazon';
    else if (p.productUrl.includes('flipkart.')) expectedType = 'Flipkart';
    else if (p.productUrl.includes('myntra.')) expectedType = 'Myntra';
    else if (p.productUrl.includes('ajio.')) expectedType = 'Ajio';
    
    if (expectedType && p.storeType !== expectedType) {
      console.log(`[${dbName}] ${key}: storeType ${p.storeType} -> ${expectedType}`);
      p.storeType = expectedType;
      
      // Fix affiliate links
      if (expectedType === 'Amazon' && p.productCode) {
        p.links = p.links || {};
        p.links.avinashbmvINR = `https://www.amazon.in/dp/${p.productCode}?tag=dealshubglo0c-21`;
      } else if (expectedType !== 'Amazon' && p.links && p.links.avinashbmvINR && p.links.avinashbmvINR.includes('amazon.in')) {
        p.links.avinashbmvINR = 'https://inrdeals.com/avi646476329/' + p.productUrl;
      }
      
      await dbRef.child(key).update({
        storeType: p.storeType,
        links: p.links
      });
      fixedCount++;
    }
  }
  console.log(`[${dbName}] Fixed ${fixedCount} products.`);
}

(async () => {
  await fixDB(productDealsDB.productdealsRef, 'productdeals');
  await fixDB(productDealsDB.dealsRef, 'deals');
  process.exit(0);
})();
