const { productDealsDB } = require('./database/firebaseDB/productDealsDB');

async function testDateQuery() {
  const ref = productDealsDB.dealsRef;
  const snapshot = await ref.orderByChild('date').equalTo('2026-05-17').once('value');
  const val = snapshot.val();
  if (!val) {
    console.log("No data returned for 2026-05-17");
  } else {
    const keys = Object.keys(val);
    console.log(`Found ${keys.length} items`);
    // Print first item
    if (keys.length > 0) {
      console.log(val[keys[0]]);
    }
  }
  process.exit(0);
}

testDateQuery();
