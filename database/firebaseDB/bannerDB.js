const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('bannerDB');

// Normalize and build a consistent key for duplicate detection
// Use URL-based uniqueness: image URL or clickRedirectUrl (whichever is available)
const normalizeValue = (value) => (value || '').toString().trim().toLowerCase();
const normalizeUrl = (url) => {
    if (!url) return '';
    // Remove query parameters and fragments for better matching
    try {
        const urlObj = new URL(url);
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        // If URL parsing fails, return normalized string
        return normalizeValue(url);
    }
};

const buildBannerKey = (banner = {}) => {
    // Primary: Use image URL (banner.url)
    const imageUrl = normalizeUrl(banner.url);
    // Secondary: Use clickRedirectUrl if image URL is not available
    const clickUrl = normalizeUrl(banner.clickRedirectUrl);
    
    // Use image URL as primary key, fallback to clickRedirectUrl
    const primaryUrl = imageUrl || clickUrl;
    
    if (!primaryUrl) {
        // If no URL available, fallback to ID
        return banner.id ? `id:${banner.id}` : null;
    }
    
    // Return normalized URL as the key
    return primaryUrl;
};

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
if (!admin.apps.length) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  if (!serviceAccount) {
    try {
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    } catch (e) {
      console.error(`Firebase credentials file not found at ${constants.pathToFile}/${filePath}.json and no FIREBASE_SERVICE_ACCOUNT_JSON env variable provided.`);
      throw e;
    }
  }
  const databaseURL = `https://${DB_Name}-default-rtdb.firebaseio.com`;
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
        let existingKeys = new Set();
        let productImageKeys = new Set();

        try {
            const existing = await this.getAllBanners();
            if (existing.status === 200 && existing.data) {
                existingKeys = new Set(
                    Object.values(existing.data)
                        .map(buildBannerKey)
                        .filter(Boolean)
                );
            }
            
            // Get product images to filter them out
            const productImagesResult = await this.getProductImages();
            if (productImagesResult.status === 200 && productImagesResult.data) {
                productImageKeys = new Set(
                    Object.values(productImagesResult.data)
                        .map(buildBannerKey)
                        .filter(Boolean)
                );
                logger.info(`Loaded ${productImageKeys.size} product image URLs to filter`);
            }
        } catch (error) {
            logger.warn('Could not pre-load existing banners for dedupe', { error: error.message });
        }

        for (const banner of banners) {
            const bannerKey = buildBannerKey(banner);
            
            // Skip if it's a duplicate
            if (bannerKey && existingKeys.has(bannerKey)) {
                logger.info(`Skipping duplicate banner (production): ${banner.id || banner.url || 'unknown'}`);
                results.push({ id: banner.id, status: 409, message: 'Duplicate banner skipped' });
                continue;
            }
            
            // Skip if it matches a product image
            if (bannerKey && productImageKeys.has(bannerKey)) {
                logger.info(`Skipping product image banner (production): ${banner.id || banner.url || 'unknown'}`);
                results.push({ id: banner.id, status: 410, message: 'Product image banner skipped' });
                continue;
            }

            const result = await this.storeBanner(banner);
            results.push({ id: banner.id, ...result });

            if (bannerKey) {
                existingKeys.add(bannerKey);
            }
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

    async getProductImages() {
        try {
            const snapshot = await this.bannersRef.orderByChild('isProductImage').equalTo(true).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting product images:', { error: error.message });
            return { status: 500, message: 'Error getting product images', error: error.message };
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
        let existingKeys = new Set();
        let productImageKeys = new Set();

        try {
            const existing = await this.getAllTestBanners();
            if (existing.status === 200 && existing.data) {
                existingKeys = new Set(
                    Object.values(existing.data)
                        .map(buildBannerKey)
                        .filter(Boolean)
                );
            }
            
            // Get product images to filter them out
            const productImagesResult = await this.getProductImages();
            if (productImagesResult.status === 200 && productImagesResult.data) {
                productImageKeys = new Set(
                    Object.values(productImagesResult.data)
                        .map(buildBannerKey)
                        .filter(Boolean)
                );
                logger.info(`Loaded ${productImageKeys.size} product image URLs to filter from test banners`);
            }
        } catch (error) {
            logger.warn('Could not pre-load test banners for dedupe', { error: error.message });
        }

        for (const banner of banners) {
            const bannerKey = buildBannerKey(banner);
            
            // Skip if it's a duplicate
            if (bannerKey && existingKeys.has(bannerKey)) {
                logger.info(`Skipping duplicate test banner: ${banner.id || banner.url || 'unknown'}`);
                results.push({ id: banner.id, status: 409, message: 'Duplicate test banner skipped' });
                continue;
            }
            
            // Skip if it matches a product image
            if (bannerKey && productImageKeys.has(bannerKey)) {
                logger.info(`Skipping product image test banner: ${banner.id || banner.url || 'unknown'}`);
                results.push({ id: banner.id, status: 410, message: 'Product image test banner skipped' });
                continue;
            }

            const result = await this.storeTestBanner(banner);
            results.push({ id: banner.id, ...result });

            if (bannerKey) {
                existingKeys.add(bannerKey);
            }
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

    async getActiveTestBanners() {
        try {
            const snapshot = await this.testBannersRef.orderByChild('isActive').equalTo(true).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting active test banners:', { error: error.message });
            return { status: 500, message: 'Error getting active test banners', error: error.message };
        }
    }

    async deactivateOldTestBanners(activeBannerIds) {
        try {
            // Get all test banners
            const allBannersResult = await this.getAllTestBanners();
            
            if (allBannersResult.status !== 200) {
                return allBannersResult;
            }
            
            const allBanners = allBannersResult.data;
            let deactivatedCount = 0;
            
            // Deactivate banners that are not in the active list
            for (const [bannerId, bannerData] of Object.entries(allBanners)) {
                if (bannerData.isActive && !activeBannerIds.includes(bannerId)) {
                    await this.deactivateTestBanner(bannerId);
                    deactivatedCount++;
                }
            }
            
            logger.info(`Deactivated ${deactivatedCount} old test banners`);
            return { status: 200, message: `Deactivated ${deactivatedCount} test banners` };
            
        } catch (error) {
            logger.error('Error deactivating old test banners:', { error: error.message });
            return { status: 500, message: 'Error deactivating old test banners', error: error.message };
        }
    }

    async deactivateTestBanner(bannerId) {
        try {
            const bannerRef = this.testBannersRef.child(bannerId);
            await bannerRef.update({
                isActive: false,
                updateTimestamp: new Date().toISOString()
            });
            
            logger.info(`Test banner deactivated: ${bannerId}`);
            return { status: 200, message: 'Test banner deactivated successfully' };
        } catch (error) {
            logger.error(`Error deactivating test banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deactivating test banner', error: error.message };
        }
    }

    async bulkDeleteTestBanners(bannerIds) {
        try {
            let deletedCount = 0;

            for (const bannerId of bannerIds) {
                try {
                    const deleteResult = await this.deleteTestBanner(bannerId);
                    if (deleteResult.status === 200) {
                        deletedCount++;
                    }
                } catch (error) {
                    logger.error(`Error deleting test banner ${bannerId}:`, { error: error.message });
                }
            }

            logger.info(`Bulk deleted ${deletedCount} test banners`);
            return { status: 200, message: `Bulk deleted ${deletedCount} test banners`, deleted: deletedCount };
        } catch (error) {
            logger.error('Error in bulk delete operation for test banners:', { error: error.message });
            return { status: 500, message: 'Error in bulk delete operation for test banners', error: error.message };
        }
    }

    async removeDuplicateTestBanners() {
        try {
            const allResult = await this.getAllTestBanners();
            if (allResult.status !== 200) {
                return allResult;
            }

            const banners = allResult.data || {};
            const seenKeys = new Map();
            const duplicates = [];

            for (const [bannerId, bannerData] of Object.entries(banners)) {
                const key = buildBannerKey(bannerData);
                if (!key) continue;

                if (seenKeys.has(key)) {
                    duplicates.push(bannerId);
                } else {
                    seenKeys.set(key, bannerId);
                }
            }

            if (duplicates.length === 0) {
                return { status: 200, message: 'No duplicate test banners found', removed: 0, duplicates: [] };
            }

            const deleteResult = await this.bulkDeleteTestBanners(duplicates);
            return {
                status: 200,
                message: `Removed ${deleteResult.deleted || 0} duplicate test banners`,
                removed: deleteResult.deleted || 0,
                duplicates
            };
        } catch (error) {
            logger.error('Error removing duplicate test banners:', { error: error.message });
            return { status: 500, message: 'Error removing duplicate test banners', error: error.message };
        }
    }

    async getTestBannersByPlatform(platform) {
        try {
            const snapshot = await this.testBannersRef.orderByChild('platform').equalTo(platform).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error(`Error getting test banners for platform ${platform}:`, { error: error.message });
            return { status: 500, message: 'Error getting platform test banners', error: error.message };
        }
    }

    async getProductImages() {
        try {
            const snapshot = await this.testBannersRef.orderByChild('isProductImage').equalTo(true).once('value');
            
            if (snapshot.exists()) {
                return { status: 200, data: snapshot.val() };
            } else {
                return { status: 200, data: {} };
            }
        } catch (error) {
            logger.error('Error getting product images from test banners:', { error: error.message });
            return { status: 500, message: 'Error getting product images', error: error.message };
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
