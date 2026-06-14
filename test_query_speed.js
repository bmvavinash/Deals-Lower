process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { productDealsDB } = require('./database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('./database/firebaseDB/notificationTrackingDB');

async function run() {
  console.log("Fetching deals to get sample product codes...");
  const snapshot = await productDealsDB.productdealsRef.orderByChild('datetime').limitToLast(100).once('value');
  const deals = snapshot.val() || {};
  const productCodes = Object.keys(deals);
  console.log(`Found ${productCodes.length} product codes.`);

  console.log("\nMethod 1: 100 individual queries in parallel...");
  const start1 = Date.now();
  try {
    const results1 = await Promise.all(
      productCodes.map(code => notificationTrackingDB.getNotificationStatus(code))
    );
    console.log(`Method 1 took: ${Date.now() - start1}ms (fetched ${results1.filter(Boolean).length} status records)`);
  } catch (err) {
    console.error("Method 1 failed:", err);
  }

  console.log("\nMethod 2: Single query for entire node...");
  const start2 = Date.now();
  try {
    const snapshot2 = await notificationTrackingDB.ref.once('value');
    const allNotifications = snapshot2.val() || {};
    const results2 = productCodes.map(code => {
      const safeKey = String(code).replace(/[.#$/\[\]]/g, '_');
      return allNotifications[safeKey] || null;
    });
    console.log(`Method 2 took: ${Date.now() - start2}ms (matched ${results2.filter(Boolean).length} status records)`);
  } catch (err) {
    console.error("Method 2 failed:", err);
  }

  process.exit(0);
}

run();
