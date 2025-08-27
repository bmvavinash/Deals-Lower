const { bannerDB } = require('./database/firebaseDB/bannerDB');
const { extractBanners } = require('./dataSources/bannerExtractor');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('testBannerManagement');

async function testBannerManagement() {
    try {
        logger.info('Starting banner management test');
        
        // Test banner extraction with new filtering
        logger.info('Testing banner extraction with product carousel filtering...');
        const result = await extractBanners();
        
        if (result.success) {
            logger.info('Banner extraction completed successfully', {
                extracted: result.extracted,
                stored: result.stored
            });
        } else {
            logger.error('Banner extraction failed', { error: result.error });
        }
        
        // Test banner database operations
        logger.info('Testing banner database operations...');
        
        // Get all banners
        const allBanners = await bannerDB.getAllBanners();
        logger.info('All banners retrieved', {
            status: allBanners.status,
            count: allBanners.data ? Object.keys(allBanners.data).length : 0
        });
        
        // Get active banners
        const activeBanners = await bannerDB.getActiveBanners();
        logger.info('Active banners retrieved', {
            status: activeBanners.status,
            count: activeBanners.data ? Object.keys(activeBanners.data).length : 0
        });
        
        // Get banners by platform
        const amazonBanners = await bannerDB.getBannersByPlatform('amazon');
        logger.info('Amazon banners retrieved', {
            status: amazonBanners.status,
            count: amazonBanners.data ? Object.keys(amazonBanners.data).length : 0
        });
        
        // Test delete functionality
        if (activeBanners.data && Object.keys(activeBanners.data).length > 0) {
            const bannerIds = Object.keys(activeBanners.data);
            const testBannerId = bannerIds[0];
            
            logger.info(`Testing delete functionality with banner: ${testBannerId}`);
            
            // Test individual banner deletion
            const deleteResult = await bannerDB.deleteBanner(testBannerId);
            logger.info('Individual banner deletion result', { result: deleteResult });
            
            // Test bulk deletion (delete first 3 banners if available)
            if (bannerIds.length > 3) {
                const bannersToDelete = bannerIds.slice(1, 4);
                logger.info(`Testing bulk deletion with ${bannersToDelete.length} banners`);
                
                const bulkDeleteResult = await bannerDB.bulkDeleteBanners(bannersToDelete);
                logger.info('Bulk deletion result', { result: bulkDeleteResult });
            }
        }
        
        // Test category-based deletion
        logger.info('Testing category-based deletion...');
        const categoryDeleteResult = await bannerDB.deleteBannersByCategory('category');
        logger.info('Category-based deletion result', { result: categoryDeleteResult });
        
        // Test platform-based deletion
        logger.info('Testing platform-based deletion...');
        const platformDeleteResult = await bannerDB.deleteBannersByPlatform('flipkart');
        logger.info('Platform-based deletion result', { result: platformDeleteResult });
        
        // Final banner count
        const finalBanners = await bannerDB.getAllBanners();
        logger.info('Final banner count', {
            status: finalBanners.status,
            count: finalBanners.data ? Object.keys(finalBanners.data).length : 0
        });
        
    } catch (error) {
        logger.error('Test failed:', { error: error.message, stack: error.stack });
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testBannerManagement()
        .then(() => {
            logger.info('Banner management test completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test failed:', { error: error.message });
            process.exit(1);
        });
}

module.exports = { testBannerManagement }; 