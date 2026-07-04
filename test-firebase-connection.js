const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();
console.log("Querying database...");

db.ref('deals').orderByChild('storeType').equalTo('Amazon').limitToLast(10).once('value')
  .then((snap) => {
    const val = snap.val();
    if (val) {
      console.log("Successfully fetched Amazon products:");
      Object.entries(val).forEach(([key, prod]) => {
         console.log(`- Key: ${key}, title: ${prod.title}, isDeal: ${prod.isDeal}, dealName: ${prod.dealName}, sourceUrl: ${prod.sourceUrl}`);
      });
    } else {
      console.log("No products found!");
    }
    process.exit(0);
  })
  .catch(e => {
    console.error("Firebase error:", e);
    process.exit(1);
  });
