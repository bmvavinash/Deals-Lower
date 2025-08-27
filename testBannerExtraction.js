const { extractBanners } = require('./dataSources/bannerExtractor');
const { bannerDB } = require('./database/firebaseDB/bannerDB');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('testBannerExtraction');

async function testBannerExtraction() {
    try {
        logger.info('Starting banner extraction test');
        
        // Test banner extraction
        const result = await extractBanners();
        
        if (result.success) {
            logger.info('Banner extraction test completed successfully', {
                extracted: result.extracted,
                stored: result.stored
            });
        } else {
            logger.error('Banner extraction test failed', {
                error: result.error
            });
        }
        
        // Test banner database operations
        logger.info('Testing banner database operations');
        
        const allBanners = await bannerDB.getAllBanners();
        logger.info('All banners retrieved', {
            status: allBanners.status,
            count: allBanners.data ? Object.keys(allBanners.data).length : 0
        });
        
        const activeBanners = await bannerDB.getActiveBanners();
        logger.info('Active banners retrieved', {
            status: activeBanners.status,
            count: activeBanners.data ? Object.keys(activeBanners.data).length : 0
        });
        
    } catch (error) {
        logger.error('Test failed:', { error: error.message, stack: error.stack });
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testBannerExtraction()
        .then(() => {
            logger.info('Test completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test failed:', { error: error.message });
            process.exit(1);
        });
}

module.exports = { testBannerExtraction }; 