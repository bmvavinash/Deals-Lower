const admin = require("firebase-admin");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const serviceAccount = require("C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const db = admin.database();

async function run() {
    const snap = await db.ref('/productdeals_static').orderByChild('staticSubcategory').equalTo('Others').limitToFirst(5).once('value');
    console.log(JSON.stringify(snap.val(), null, 2));
    process.exit(0);
}
run().catch(console.error);
