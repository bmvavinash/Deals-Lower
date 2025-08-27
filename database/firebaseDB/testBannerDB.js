const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('testBannerDB');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
    });
}

const db = admin.database();

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
            return { status: 500, message: 'Error getting test banners by platform', error: error.message };
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

    async clearAllTestBanners() {
        try {
            await this.testBannersRef.remove();
            logger.info('All test banners cleared');
            return { status: 200, message: 'All test banners cleared successfully' };
        } catch (error) {
            logger.error('Error clearing all test banners:', { error: error.message });
            return { status: 500, message: 'Error clearing test banners', error: error.message };
        }
    }

    async updateTestBannerStatus(bannerId, isActive) {
        try {
            await this.testBannersRef.child(bannerId).update({
                isActive: isActive,
                updateTimestamp: new Date().toISOString()
            });
            
            const status = isActive ? 'activated' : 'deactivated';
            logger.info(`Test banner ${status}: ${bannerId}`);
            return { status: 200, message: `Test banner ${status} successfully` };
        } catch (error) {
            logger.error(`Error updating test banner status ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error updating test banner status', error: error.message };
        }
    }
}

// Export singleton instance
const testBannerDB = new TestBannerDB();
module.exports = { testBannerDB };
