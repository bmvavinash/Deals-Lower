const admin = require("firebase-admin");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const serviceAccount = require("C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json");
const { getStaticCategoryMapping } = require("./utils/staticCategoryMapping");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const db = admin.database();

async function checkRemap() {
    const snap = await db.ref('/productdeals_static').once('value');
    const products = snap.val() || {};
    let count = 0;

    for (const [key, p] of Object.entries(products)) {
        const oldSub = p.staticSubcategory;
        const newMapping = getStaticCategoryMapping(p);
        
        if (oldSub !== newMapping.staticSubcategory) {
            count++;
            console.log(`Title: ${p.title.substring(0, 50)}`);
            console.log(`URL: ${p.productUrl?.split('?')[0]}`);
            console.log(`Old: ${oldSub} -> New: ${newMapping.staticSubcategory}\n`);
            if (count > 20) break;
        }
    }
    process.exit(0);
}
checkRemap().catch(console.error);
