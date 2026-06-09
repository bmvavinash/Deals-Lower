const admin = require('firebase-admin');
const constants = require('./config/constants.js');
const config = require('./config/config.js');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
    const dbUrl = DB_Name === 'lowerdealhub' 
        ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
        : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: dbUrl
    });
}
const db = admin.database();

const CATEGORIES = {
    'Electronics': ['Air Conditioners','Geysers','Air Coolers','Refrigerators','Washing Machines','Mobiles','Laptops','Audio','Wearables','Televisions','Cameras'],
    'Fashion': ['Dresses','Kurtas','T-Shirts','Shirts','Jeans','Pants','Shoes','Sandals','Accessories','Innerwear'],
    'Home & Kitchen': ['Kitchen Appliances','Cookware','Furniture','Home Decor'],
    'Beauty & Personal Care': ['Skincare','Haircare','Makeup','Fragrances','Bath & Body'],
    'Books & Stationery': ['Fiction','Non-Fiction','Academic','Stationery'],
    'Sports & Fitness': ['Equipment','Clothing','Footwear','Accessories'],
    'Baby & Kids': ['Toys','Clothing','Footwear','Baby Care']
};

async function checkMissing() {
    let missing = [];
    console.log('Checking categories in DealsDB...');
    for (const c1 of Object.keys(CATEGORIES)) {
        for (const c2 of CATEGORIES[c1]) {
            // Check 'deals' collection
            const snap = await db.ref('deals').orderByChild('categoryLevel2').equalTo(c2).limitToFirst(1).once('value');
            if (!snap.exists()) {
                // Try checking categoryLevel3 or subcategory1 just in case
                const snap2 = await db.ref('deals').orderByChild('subcategory1').equalTo(c2).limitToFirst(1).once('value');
                if (!snap2.exists()) {
                    missing.push({ c1, c2 });
                    console.log(`Missing: ${c1} > ${c2}`);
                }
            }
        }
    }
    console.log('Finished. Missing:', missing);
    return missing;
}

checkMissing().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
