const { getAllProductDeals } = require('./database/firebaseDB/productDealsDB');

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
    console.log('Fetching deals from DB...');
    const deals = await getAllProductDeals('deals');
    const products = Object.values(deals || {});
    
    let stats = {};
    for (const c1 of Object.keys(CATEGORIES)) {
        stats[c1] = {};
        for (const c2 of CATEGORIES[c1]) {
            stats[c1][c2] = 0;
        }
    }
    
    for (const p of products) {
        if (p.category && p.category.c1 && p.category.c2) {
            if (stats[p.category.c1] && stats[p.category.c1][p.category.c2] !== undefined) {
                stats[p.category.c1][p.category.c2]++;
            }
        }
    }
    
    console.log('Missing subcategories:');
    let missing = [];
    for (const c1 of Object.keys(stats)) {
        for (const c2 of Object.keys(stats[c1])) {
            if (stats[c1][c2] === 0) {
                missing.push({ c1, c2 });
                console.log(`- ${c1} > ${c2}`);
            }
        }
    }
    return missing;
}
checkMissing().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
