process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getStaticCategoryMapping } = require('../utils/staticCategoryMapping');

// URL for the source node
const FB_URL = 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app';
const SOURCE_NODE = '/productdeals.json';

async function fetchProductsViaRest() {
    return new Promise((resolve, reject) => {
        console.log(`Fetching all products via REST API from ${SOURCE_NODE}...`);
        https.get(`${FB_URL}${SOURCE_NODE}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runMigration() {
    console.log('Starting ultra-fast REST + SDK migration to productdeals_static.json...');
    
    try {
        const productsRaw = await fetchProductsViaRest();
        if (!productsRaw) {
            console.log('No products found.');
            return;
        }

        const allProducts = Object.entries(productsRaw);
        console.log(`Successfully fetched ${allProducts.length} products!`);

        // Process all products into a new object tree
        const migratedObject = {};
        allProducts.forEach(([key, product]) => {
            if (!product) return;
            const { staticCategory, staticSubcategory, staticStyle } = getStaticCategoryMapping(product);
            migratedObject[key] = {
                ...product,
                staticCategory,
                staticSubcategory,
                staticStyle
            };
        });

        console.log('Mapping complete. Beginning chunked bulk upload to Firebase using Admin SDK update()...');
        
        const CHUNK_SIZE = 500;
        const keys = Object.keys(migratedObject);
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
            const chunkKeys = keys.slice(i, i + CHUNK_SIZE);
            const chunkData = {};
            chunkKeys.forEach(k => { chunkData[k] = migratedObject[k]; });
            
            console.log(`Uploading chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(keys.length / CHUNK_SIZE)}...`);
            await productDealsDB.staticRef.update(chunkData);
        }

        console.log('Migration completed successfully in chunked updates!');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

runMigration();
