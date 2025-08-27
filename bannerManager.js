const { bannerDB } = require('./database/firebaseDB/bannerDB');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('bannerManager');

class BannerManager {
    constructor() {
        this.db = bannerDB;
    }

    // Get all banners with optional filtering
    async getBanners(filters = {}) {
        try {
            let banners;
            
            if (filters.platform) {
                banners = await this.db.getBannersByPlatform(filters.platform);
            } else if (filters.category) {
                banners = await this.db.getBannersByCategory(filters.category);
            } else if (filters.activeOnly) {
                banners = await this.db.getActiveBanners();
            } else {
                banners = await this.db.getAllBanners();
            }
            
            return banners;
        } catch (error) {
            logger.error('Error getting banners:', { error: error.message });
            return { status: 500, message: 'Error getting banners', error: error.message };
        }
    }

    // Delete a single banner
    async deleteBanner(bannerId) {
        try {
            const result = await this.db.deleteBanner(bannerId);
            logger.info(`Banner deleted: ${bannerId}`, { result });
            return result;
        } catch (error) {
            logger.error(`Error deleting banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deleting banner', error: error.message };
        }
    }

    // Delete banners by platform
    async deleteBannersByPlatform(platform) {
        try {
            const result = await this.db.deleteBannersByPlatform(platform);
            logger.info(`Banners deleted for platform: ${platform}`, { result });
            return result;
        } catch (error) {
            logger.error(`Error deleting banners for platform ${platform}:`, { error: error.message });
            return { status: 500, message: 'Error deleting platform banners', error: error.message };
        }
    }

    // Delete banners by category
    async deleteBannersByCategory(category) {
        try {
            const result = await this.db.deleteBannersByCategory(category);
            logger.info(`Banners deleted for category: ${category}`, { result });
            return result;
        } catch (error) {
            logger.error(`Error deleting banners for category ${category}:`, { error: error.message });
            return { status: 500, message: 'Error deleting category banners', error: error.message };
        }
    }

    // Bulk delete banners
    async bulkDeleteBanners(bannerIds) {
        try {
            const result = await this.db.bulkDeleteBanners(bannerIds);
            logger.info(`Bulk deleted ${bannerIds.length} banners`, { result });
            return result;
        } catch (error) {
            logger.error('Error in bulk delete operation:', { error: error.message });
            return { status: 500, message: 'Error in bulk delete operation', error: error.message };
        }
    }

    // Get banner statistics
    async getBannerStats() {
        try {
            const allBanners = await this.db.getAllBanners();
            const activeBanners = await this.db.getActiveBanners();
            
            if (allBanners.status !== 200 || activeBanners.status !== 200) {
                return { status: 500, message: 'Error getting banner statistics' };
            }
            
            const allBannerData = allBanners.data || {};
            const activeBannerData = activeBanners.data || {};
            
            // Count by platform
            const platformStats = {};
            const categoryStats = {};
            
            Object.values(allBannerData).forEach(banner => {
                // Platform stats
                const platform = banner.platform || 'unknown';
                platformStats[platform] = (platformStats[platform] || 0) + 1;
                
                // Category stats
                const category = banner.category || 'unknown';
                categoryStats[category] = (categoryStats[category] || 0) + 1;
            });
            
            const stats = {
                total: Object.keys(allBannerData).length,
                active: Object.keys(activeBannerData).length,
                inactive: Object.keys(allBannerData).length - Object.keys(activeBannerData).length,
                byPlatform: platformStats,
                byCategory: categoryStats
            };
            
            return { status: 200, data: stats };
        } catch (error) {
            logger.error('Error getting banner statistics:', { error: error.message });
            return { status: 500, message: 'Error getting banner statistics', error: error.message };
        }
    }

    // Update banner order
    async updateBannerOrder(bannerId, order) {
        try {
            const result = await this.db.updateBannerOrder(bannerId, order);
            logger.info(`Banner order updated: ${bannerId} -> ${order}`, { result });
            return result;
        } catch (error) {
            logger.error(`Error updating banner order ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error updating banner order', error: error.message };
        }
    }

    // Deactivate banner
    async deactivateBanner(bannerId) {
        try {
            const result = await this.db.deactivateBanner(bannerId);
            logger.info(`Banner deactivated: ${bannerId}`, { result });
            return result;
        } catch (error) {
            logger.error(`Error deactivating banner ${bannerId}:`, { error: error.message });
            return { status: 500, message: 'Error deactivating banner', error: error.message };
        }
    }

    // Get banners for display (active banners sorted by priority)
    async getDisplayBanners(limit = 15) {
        try {
            const activeBanners = await this.db.getActiveBanners();
            
            if (activeBanners.status !== 200) {
                return activeBanners;
            }
            
            const bannerData = activeBanners.data || {};
            const banners = Object.values(bannerData);
            
            // Sort by priority (hero > promotional > seasonal > category)
            banners.sort((a, b) => (a.priority || 4) - (b.priority || 4));
            
            // Limit the number of banners
            const limitedBanners = banners.slice(0, limit);
            
            return {
                status: 200,
                data: limitedBanners,
                total: banners.length,
                limited: limitedBanners.length
            };
        } catch (error) {
            logger.error('Error getting display banners:', { error: error.message });
            return { status: 500, message: 'Error getting display banners', error: error.message };
        }
    }
}

// Create and export a singleton instance
const bannerManager = new BannerManager();

module.exports = {
    bannerManager,
    BannerManager
}; 