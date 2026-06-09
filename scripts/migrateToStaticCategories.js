const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getStaticCategoryMapping } = require('../utils/staticCategoryMapping');

async function runMigration() {
    console.log('Starting migration to productdeals_static.json...');
    
    // Fetch all existing product deals
    const allProductsRaw = await productDealsDB.getAllProductDeals('productdeals');
    const allProducts = Object.values(allProductsRaw || {});
    console.log(`Fetched ${allProducts.length} products from productdeals.json`);

    if (allProducts.length === 0) {
        console.log('No products to migrate.');
        return;
    }

    // Process all products
    const migratedProducts = allProducts.map(product => {
        // Apply static mapping
        const { staticCategory, staticSubcategory, staticStyle } = getStaticCategoryMapping(product);
        
        // Return enriched product
        return {
            ...product,
            staticCategory,
            staticSubcategory,
            staticStyle
        };
    });

    console.log('Mapping complete. Upserting to productdeals_static.json...');

    // Bulk upsert to the new node in chunks to avoid overwhelming Firebase
    const chunkSize = 100;
    for (let i = 0; i < migratedProducts.length; i += chunkSize) {
        const chunk = migratedProducts.slice(i, i + chunkSize);
        console.log(`Upserting chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(migratedProducts.length / chunkSize)}...`);
        const result = await productDealsDB.bulkUpsertProducts(chunk, 'productdeals_static');
        console.log(`Chunk result: Created ${result.created}, Updated ${result.updated}, Failed ${result.failed}`);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
}

runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
