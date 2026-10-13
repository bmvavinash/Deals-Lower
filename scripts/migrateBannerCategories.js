const { bannerDB, testBannerDB } = require('../database/firebaseDB/bannerDB');
const { classifyBanner } = require('../utils/bannerCategorizer');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('migrateBannerCategories');

async function migrateDatabase(dbInstance, dbLabel) {
    console.log(`\n========================================`);
    console.log(`Starting migration for ${dbLabel}...`);
    console.log(`========================================`);
    
    const res = await (dbInstance.getAllBanners ? dbInstance.getAllBanners() : dbInstance.getAllTestBanners());
    if (res.status !== 200 || !res.data) {
        console.log(`No banners found in ${dbLabel}`);
        return;
    }

    const banners = Object.entries(res.data);
    console.log(`Total banners in ${dbLabel}: ${banners.length}`);
    let updatedCount = 0;

    for (const [id, banner] of banners) {
        const classified = classifyBanner(banner);
        
        const oldCat = banner.category;
        const oldSub = banner.subcategory;
        const oldTitle = banner.title;

        // Preserve previous bannerType or use current category
        const bannerType = banner.bannerType || (['hero', 'seasonal', 'promotional', 'category'].includes(oldCat) ? oldCat : 'hero');

        banner.category = classified.category;
        banner.subcategory = classified.subcategory;
        banner.bannerType = bannerType;
        if (classified.title && classified.title !== oldTitle) {
            banner.title = classified.title;
        }
        banner.updateTimestamp = new Date().toISOString();

        await (dbInstance.storeBanner ? dbInstance.storeBanner(banner) : dbInstance.storeTestBanner(banner));
        updatedCount++;

        console.log(`[UPDATED] ${id}`);
        console.log(`   Title:       "${oldTitle}" -> "${banner.title}"`);
        console.log(`   Category:    "${oldCat}" -> "${banner.category}"`);
        console.log(`   Subcategory: "${oldSub}" -> "${banner.subcategory}"`);
    }

    console.log(`\nFinished ${dbLabel}! Successfully updated ${updatedCount} banners.`);
}

async function run() {
    try {
        await migrateDatabase(bannerDB, 'Production Database (bannerDB)');
        if (testBannerDB) {
            await migrateDatabase(testBannerDB, 'Test Database (testBannerDB)');
        }
        console.log('\nAll databases migrated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
