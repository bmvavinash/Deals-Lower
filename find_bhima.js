const { productDealsDB } = require('./database/firebaseDB/productDealsDB');

async function testDateQuery() {
  const ref = productDealsDB.productdealsRef;
  const snapshot = await ref.orderByChild('date').equalTo('2026-05-17').once('value');
  const val = snapshot.val();
  if (!val) {
    console.log("No data returned for productdeals 2026-05-17");
  } else {
    let bhimaCount = 0;
    const keys = Object.keys(val);
    for (const key of keys) {
      const item = val[key];
      if (JSON.stringify(item).includes('BHIMA')) {
        console.log("Found BHIMA item in productdeals:", item.shortText || item.urltext || item.productText || 'No text found');
        bhimaCount++;
      }
    }
    console.log(`Found ${keys.length} items total in productdeals on this date. ${bhimaCount} of them mention BHIMA.`);
  }
  process.exit(0);
}

testDateQuery();
