const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();
console.log("Testing connection...");

const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), 10000);
});

Promise.race([
    db.ref('deals').limitToLast(5).once('value'),
    timeoutPromise
])
  .then((snap) => {
    console.log("Read successful! Data:", snap.val() ? Object.keys(snap.val()).length : 0);
    process.exit(0);
  })
  .catch(e => {
    console.error("Firebase error:", e);
    process.exit(1);
  });
