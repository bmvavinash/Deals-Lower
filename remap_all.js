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

async function remapAll() {
    console.log("Fetching all products...");
    const snap = await db.ref('/productdeals_static').once('value');
    const products = snap.val() || {};
    
    let updates = {};
    let count = 0;

    for (const [key, p] of Object.entries(products)) {
        const newMapping = getStaticCategoryMapping(p);
        
        let changed = false;
        if (p.staticCategory !== newMapping.staticCategory) { p.staticCategory = newMapping.staticCategory; changed = true; }
        if (p.staticSubcategory !== newMapping.staticSubcategory) { p.staticSubcategory = newMapping.staticSubcategory; changed = true; }
        if (p.staticStyle !== newMapping.staticStyle) { p.staticStyle = newMapping.staticStyle; changed = true; }
        if (p.type !== newMapping.type && newMapping.type !== undefined) { p.type = newMapping.type; changed = true; }
        if (p.capacity !== newMapping.capacity && newMapping.capacity !== undefined) { p.capacity = newMapping.capacity; changed = true; }
        
        if (changed) {
            count++;
            updates[`/productdeals_static/${key}/staticCategory`] = p.staticCategory;
            updates[`/productdeals_static/${key}/staticSubcategory`] = p.staticSubcategory;
            updates[`/productdeals_static/${key}/staticStyle`] = p.staticStyle;
            if (newMapping.type !== undefined) updates[`/productdeals_static/${key}/type`] = p.type;
            if (newMapping.capacity !== undefined) updates[`/productdeals_static/${key}/capacity`] = p.capacity;
            console.log(`Updated ${p.title.substring(0, 30)}... -> ${p.staticSubcategory} (Type: ${p.type}, Cap: ${p.capacity})`);
        }
    }
    
    if (Object.keys(updates).length > 0) {
        console.log(`Applying ${Object.keys(updates).length} updates for ${count} products...`);
        await db.ref().update(updates);
        console.log("Done!");
    } else {
        console.log("No products needed updating.");
    }
    process.exit(0);
}
remapAll().catch(console.error);
