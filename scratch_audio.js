const admin = require("firebase-admin");
const serviceAccount = require("C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const db = admin.database();

async function checkAudio() {
    const snap = await db.ref('/productdeals_static').orderByChild('staticSubcategory').equalTo('Audio').once('value');
    const products = snap.val() || {};
    let count = 0;
    const weirdProducts = [];
    for (const [id, p] of Object.entries(products)) {
        count++;
        // Check if title has audio keywords
        const title = p.title.toLowerCase();
        if (!title.includes('headphone') && !title.includes('earphone') && !title.includes('speaker') && !title.includes('soundbar') && !title.includes('earbuds') && !title.includes('tws')) {
            weirdProducts.push(p.title);
        }
    }
    console.log(`Total Audio products: ${count}`);
    console.log(`Products without audio keywords (${weirdProducts.length}):`);
    console.log(weirdProducts.slice(0, 20));
    process.exit(0);
}
checkAudio();
