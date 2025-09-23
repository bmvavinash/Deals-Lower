const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('bannerDB');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const DB_Region = config.DATABASE_CONFIG[`${dbname}_REGION`] || 'asia-southeast1';

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const databaseURL = `https://${DB_Name}-default-rtdb.${DB_Region}.firebasedatabase.app`;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  });
}

const db = admin.database();

class BannerDB {
    constructor() {
        this.bannersRef = db.ref('banners');
    }

    async storeBanner(bannerData) {
        try {
            const bannerRef = this.bannersRef.child(bannerData.id);
            
            // Check if banner already exists
            const snapshot = await bannerRef.once('value');
            
            if (snapshot.exists()) {
                // Update existing banner
                const existingData = snapshot.val();
                const updatedData = {
                    ...existingData,
                    ...bannerData,
                    updateTimestamp: new Date().toISOString()
                };
                
                await bannerRef.update(updatedData);
                logger.info(`Banner updated: ${bannerData.id}`);
                return { status: 200, message: 'Banner updated successfully' };
            } else {
                // Create new banner
                await bannerRef.set(bannerData);
                logger.info(`Banner created: ${bannerData.id}`);
                return { status: 201, message: 'Banner created successfully' };
            }
        } catch (error) {
            logger.error(`Error storing banner ${bannerData.id}:`, { error: error.message });
            return { status: 500, message: 'Error storing banner', error: error.message };
        }
    }

    async storeMultipleBanners(banners) {
        const results = [];
        
        for (const banner of banners) {
            const result = await this.storeBanner(banner);
            results.push({ id: banner.id, ...result });
        }
        
        return results;
    }

    async getBanner(bannerId) {
        try {
            const snapshot = await this.bannersRef.child(bannerId).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 404, message: 'Banner not found' };
            }
        } catch (error) {
            logger.error(`Error getting banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error getting banner', error: error.message };
        }
    }

    async getAllBanners() {
        try {
            const snapshot = await this.bannersRef.once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting all banners:', { error: error.message });
            return { status: 500, message: 'Error getting banners', error: error.message };
        }
    }

    async getActiveBanners() {
        try {
            const snapshot = await this.bannersRef.orderByChild('isActive').equalTo(true).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting active banners:', { error: error.message });
            return { status: 500, message: 'Error getting active banners', error: error.message };
        }
    }

    async activateBanner(bannerId) {
        try {
            const bannerRef = this.bannersRef.child(bannerId);
            await bannerRef.update({
                isActive: true,
                updateTimestamp: new Date().toISOString()
            });
            
            logger.info(`Banner activated: ${bannerId}`);
            return { status: 200, message: 'Banner activated successfully' };
        } catch (error) {
            logger.error(`Error activating banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error activating banner', error: error.message };
        }
    }

    async deactivateBanner(bannerId) {
        try {
            const bannerRef = this.bannersRef.child(bannerId);
            await bannerRef.update({
                isActive: false,
                updateTimestamp: new Date().toISOString()
            });
            
            logger.info(`Banner deactivated: ${bannerId}`);
            return { status: 200, message: 'Banner deactivated successfully' };
        } catch (error) {
            logger.error(`Error deactivating banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deactivating banner', error: error.message };
        }
    }

    async deactivateOldBanners(activeBannerIds) {
        try {
            // Get all banners
            const allBannersResult = await this.getAllBanners();
            
            if (allBannersResult.status !== 200) {
                return allBannersResult;
            }
            
            const allBanners = allBannersResult.data;
            let deactivatedCount = 0;
            
            // Deactivate banners that are not in the active list
            for (const [bannerId, bannerData] of Object.entries(allBanners)) {
                if (bannerData.isActive && !activeBannerIds.includes(bannerId)) {
                    await this.deactivateBanner(bannerId);
                    deactivatedCount++;
                }
            }
            
            logger.info(`Deactivated ${deactivatedCount} old banners`);
            return { status: 200, message: `Deactivated ${deactivatedCount} banners` };
            
        } catch (error) {
            logger.error('Error deactivating old banners:', { error: error.message });
            return { status: 500, message: 'Error deactivating old banners', error: error.message };
        }
    }

    async deleteBanner(bannerId) {
        try {
            await this.bannersRef.child(bannerId).remove();
            logger.info(`Banner deleted: ${bannerId}`);
            return { status: 200, message: 'Banner deleted successfully' };
        } catch (error) {
            logger.error(`Error deleting banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deleting banner', error: error.message };
        }
    }

    async getBannersByPlatform(platform) {
        try {
            const snapshot = await this.bannersRef.orderByChild('platform').equalTo(platform).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error(`Error getting banners for platform ${platform}:`, { error: error.message });
            return { status: 500, message: 'Error getting platform banners', error: error.message };
        }
    }

    async updateBannerOrder(bannerId, order) {
        try {
            await this.bannersRef.child(bannerId).update({
                order: order,
                updateTimestamp: new Date().toISOString()
            });
            
            logger.info(`Banner order updated: ${bannerId} -> ${order}`);
            return { status: 200, message: 'Banner order updated successfully' };
        } catch (error) {
            logger.error(`Error updating banner order ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error updating banner order', error: error.message };
        }
    }

    async deleteBanner(bannerId) {
        try {
            await this.bannersRef.child(bannerId).remove();
            logger.info(`Banner deleted: ${bannerId}`);
            return { status: 200, message: 'Banner deleted successfully' };
        } catch (error) {
            logger.error(`Error deleting banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deleting banner', error: error.message };
        }
    }

    async deleteBannersByPlatform(platform) {
        try {
            const snapshot = await this.bannersRef.orderByChild('platform').equalTo(platform).once('value');
            
            if (snapshot.exists()) {
                const banners = snapshot.val();
                const bannerIds = Object.keys(banners);
                
                for (const bannerId of bannerIds) {
                    await this.bannersRef.child(bannerId).remove();
                }
                
                logger.info(`Deleted ${bannerIds.length} banners for platform: ${platform}`);
                return { status: 200, message: `Deleted ${bannerIds.length} banners for platform ${platform}` };
    } else {
                return { status: 404, message: `No banners found for platform ${platform}` };
            }
        } catch (error) {
            logger.error(`Error deleting banners for platform ${platform}:`, { error: error.message });
            return { status: 500, message: 'Error deleting platform banners', error: error.message };
        }
    }

    async deleteBannersByCategory(category) {
        try {
            const snapshot = await this.bannersRef.orderByChild('category').equalTo(category).once('value');
            
            if (snapshot.exists()) {
                const banners = snapshot.val();
                const bannerIds = Object.keys(banners);
                
                for (const bannerId of bannerIds) {
                    await this.bannersRef.child(bannerId).remove();
                }
                
                logger.info(`Deleted ${bannerIds.length} banners for category: ${category}`);
                return { status: 200, message: `Deleted ${bannerIds.length} banners for category ${category}` };
            } else {
                return { status: 404, message: `No banners found for category ${category}` };
    }
  } catch (error) {
            logger.error(`Error deleting banners for category ${category}:`, { error: error.message });
            return { status: 500, message: 'Error deleting category banners', error: error.message };
        }
    }

    async bulkDeleteBanners(bannerIds) {
        try {
            let deletedCount = 0;
            
            for (const bannerId of bannerIds) {
                try {
                    await this.bannersRef.child(bannerId).remove();
                    deletedCount++;
  } catch (error) {
                    logger.error(`Error deleting banner ${bannerId}:`, { error: error.message });
                }
            }
            
            logger.info(`Bulk deleted ${deletedCount} banners`);
            return { status: 200, message: `Bulk deleted ${deletedCount} banners` };
  } catch (error) {
            logger.error('Error in bulk delete operation:', { error: error.message });
            return { status: 500, message: 'Error in bulk delete operation', error: error.message };
        }
    }
}

// Create and export a singleton instance
const bannerDB = new BannerDB();

// Test BannerDB class for testing purposes
class TestBannerDB {
    constructor() {
        this.testBannersRef = db.ref('test-banners');
    }

    async storeTestBanner(bannerData) {
        try {
            const bannerRef = this.testBannersRef.child(bannerData.id);
            
            // Check if banner already exists
            const snapshot = await bannerRef.once('value');
            
            if (snapshot.exists()) {
                // Update existing banner
                const existingData = snapshot.val();
                const updatedData = {
                    ...existingData,
                    ...bannerData,
                    updateTimestamp: new Date().toISOString()
                };
                
                await bannerRef.update(updatedData);
                logger.info(`Test banner updated: ${bannerData.id}`);
                return { status: 200, message: 'Test banner updated successfully' };
            } else {
                // Create new banner
                await bannerRef.set(bannerData);
                logger.info(`Test banner created: ${bannerData.id}`);
                return { status: 201, message: 'Test banner created successfully' };
            }
        } catch (error) {
            logger.error(`Error storing test banner ${bannerData.id}:`, { error: error.message });
            return { status: 500, message: 'Error storing test banner', error: error.message };
        }
    }

    async storeMultipleTestBanners(banners) {
        const results = [];
        
        for (const banner of banners) {
            const result = await this.storeTestBanner(banner);
            results.push({ id: banner.id, ...result });
        }
        
        return results;
    }

    async getTestBanner(bannerId) {
        try {
            const snapshot = await this.testBannersRef.child(bannerId).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 404, message: 'Test banner not found' };
            }
        } catch (error) {
            logger.error(`Error getting test banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error getting test banner', error: error.message };
        }
    }

    async getAllTestBanners() {
        try {
            const snapshot = await this.testBannersRef.once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting all test banners:', { error: error.message });
            return { status: 500, message: 'Error getting test banners', error: error.message };
        }
    }

    async deleteTestBanner(bannerId) {
        try {
            await this.testBannersRef.child(bannerId).remove();
            logger.info(`Test banner deleted: ${bannerId}`);
            return { status: 200, message: 'Test banner deleted successfully' };
        } catch (error) {
            logger.error(`Error deleting test banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deleting test banner', error: error.message };
        }
    }

    async deleteAllTestBanners() {
        try {
            await this.testBannersRef.remove();
            logger.info('All test banners deleted');
            return { status: 200, message: 'All test banners deleted successfully' };
        } catch (error) {
            logger.error('Error deleting all test banners:', { error: error.message });
            return { status: 500, message: 'Error deleting all test banners', error: error.message };
        }
    }
}

// Create and export a singleton instance
const testBannerDB = new TestBannerDB();

module.exports = {
    bannerDB,
    BannerDB,
    testBannerDB,
    TestBannerDB
};
