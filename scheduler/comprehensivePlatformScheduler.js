/**
 * Comprehensive Platform Scheduler
 * 
 * This scheduler handles all 10 main categories across all platforms:
 * 1. Electronics
 * 2. Fashion
 * 3. Home & Kitchen
 * 4. Sports & Fitness
 * 5. Beauty & Personal Care
 * 6. Automotive
 * 7. Baby & Kids
 * 8. Grocery
 * 9. Tools & Hardware
 * 10. Music & Entertainment
 * 11. Pet Supplies
 */

const { getModuleLogger } = require('../logger/logger');
const { getAllFlipkartCategoryUrls } = require('../config/flipkartCategoryConfig');
const { getAllAjioCategoryUrls } = require('../config/ajioCategoryConfig');
const { getAllMyntraCategoryUrls } = require('../config/myntraCategoryConfig');
const { getPlatformCategoryUrls } = require('../config/comprehensiveCategoryHierarchy');

const logger = getModuleLogger('comprehensivePlatformScheduler');

class ComprehensivePlatformScheduler {
    constructor() {
        this.isRunning = false;
        this.jobs = new Map();
        this.platforms = ['amazon', 'flipkart', 'ajio', 'myntra'];
        this.categories = [
            'electronics',
            'fashion', 
            'home_kitchen',
            'sports_fitness',
            'beauty_personal_care',
            'automotive',
            'baby_kids',
            'grocery',
            'tools_hardware',
            'music_entertainment',
            'pet_supplies'
        ];
    }

    /**
     * Get all category URLs for a specific platform
     * @param {string} platform - Platform name
     * @returns {Array} Array of category URLs
     */
    getPlatformUrls(platform) {
        switch (platform) {
            case 'amazon':
                return getPlatformCategoryUrls('amazon');
            case 'flipkart':
                return getAllFlipkartCategoryUrls();
            case 'ajio':
                return getAllAjioCategoryUrls();
            case 'myntra':
                return getAllMyntraCategoryUrls();
            default:
                logger.warn(`Unknown platform: ${platform}`);
                return [];
        }
    }

    /**
     * Get all URLs for all platforms
     * @returns {Object} Object with platform as key and URLs array as value
     */
    getAllPlatformUrls() {
        const allUrls = {};
        
        for (const platform of this.platforms) {
            allUrls[platform] = this.getPlatformUrls(platform);
            logger.info(`Generated ${allUrls[platform].length} URLs for ${platform}`);
        }
        
        return allUrls;
    }

    /**
     * Get category-specific URLs for a platform
     * @param {string} platform - Platform name
     * @param {string} category - Category key
     * @returns {Array} Array of category URLs
     */
    getCategoryUrls(platform, category) {
        switch (platform) {
            case 'amazon':
                return getPlatformCategoryUrls('amazon').filter(url => 
                    this.isUrlForCategory(url, category)
                );
            case 'flipkart':
                const flipkartUrls = getAllFlipkartCategoryUrls();
                return flipkartUrls.filter(url => 
                    this.isUrlForCategory(url, category)
                );
            case 'ajio':
                const ajioUrls = getAllAjioCategoryUrls();
                return ajioUrls.filter(url => 
                    this.isUrlForCategory(url, category)
                );
            case 'myntra':
                const myntraUrls = getAllMyntraCategoryUrls();
                return myntraUrls.filter(url => 
                    this.isUrlForCategory(url, category)
                );
            default:
                return [];
        }
    }

    /**
     * Check if URL belongs to a specific category
     * @param {string} url - URL to check
     * @param {string} category - Category key
     * @returns {boolean} True if URL belongs to category
     */
    isUrlForCategory(url, category) {
        const categoryKeywords = {
            electronics: ['mobile', 'laptop', 'headphone', 'camera', 'watch', 'audio', 'video', 'gaming', 'computer'],
            fashion: ['clothing', 'shoes', 'accessories', 'bags', 'watches', 'jewelry', 'mens', 'womens', 'kids'],
            home_kitchen: ['furniture', 'kitchen', 'home', 'decor', 'cookware', 'appliance'],
            sports_fitness: ['sports', 'fitness', 'outdoor', 'cycling', 'camping', 'swimming'],
            beauty_personal_care: ['beauty', 'skincare', 'makeup', 'hair', 'personal', 'grooming', 'fragrance'],
            automotive: ['car', 'auto', 'motorcycle', 'automotive'],
            baby_kids: ['baby', 'kids', 'toys', 'nursery', 'feeding'],
            grocery: ['grocery', 'food', 'beverage', 'fresh', 'dairy', 'frozen'],
            tools_hardware: ['tools', 'hardware', 'safety', 'power', 'hand'],
            music_entertainment: ['music', 'entertainment', 'gaming', 'books', 'instruments'],
            pet_supplies: ['pet', 'dog', 'cat', 'animal']
        };

        const keywords = categoryKeywords[category] || [];
        return keywords.some(keyword => url.toLowerCase().includes(keyword));
    }

    /**
     * Get comprehensive seed URLs for all platforms and categories
     * @returns {Array} Array of all seed URLs
     */
    getComprehensiveSeeds() {
        const allUrls = this.getAllPlatformUrls();
        const seeds = [];
        
        for (const [platform, urls] of Object.entries(allUrls)) {
            seeds.push(...urls);
        }
        
        logger.info(`Generated ${seeds.length} comprehensive seed URLs across all platforms`);
        return seeds;
    }

    /**
     * Get platform-specific seeds
     * @param {string} platform - Platform name
     * @returns {Array} Array of platform seed URLs
     */
    getPlatformSeeds(platform) {
        const urls = this.getPlatformUrls(platform);
        logger.info(`Generated ${urls.length} seed URLs for ${platform}`);
        return urls;
    }

    /**
     * Get category-specific seeds across all platforms
     * @param {string} category - Category key
     * @returns {Array} Array of category seed URLs
     */
    getCategorySeeds(category) {
        const seeds = [];
        
        for (const platform of this.platforms) {
            const urls = this.getCategoryUrls(platform, category);
            seeds.push(...urls);
        }
        
        logger.info(`Generated ${seeds.length} seed URLs for category: ${category}`);
        return seeds;
    }

    /**
     * Get statistics about available URLs
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const stats = {
            totalPlatforms: this.platforms.length,
            totalCategories: this.categories.length,
            platformStats: {},
            categoryStats: {},
            totalUrls: 0
        };

        // Platform statistics
        for (const platform of this.platforms) {
            const urls = this.getPlatformUrls(platform);
            stats.platformStats[platform] = urls.length;
            stats.totalUrls += urls.length;
        }

        // Category statistics
        for (const category of this.categories) {
            const urls = this.getCategorySeeds(category);
            stats.categoryStats[category] = urls.length;
        }

        return stats;
    }

    /**
     * Validate all URLs
     * @returns {Object} Validation results
     */
    validateUrls() {
        const results = {
            valid: 0,
            invalid: 0,
            errors: []
        };

        const allUrls = this.getComprehensiveSeeds();
        
        for (const url of allUrls) {
            try {
                new URL(url);
                results.valid++;
            } catch (error) {
                results.invalid++;
                results.errors.push({ url, error: error.message });
            }
        }

        logger.info(`URL Validation: ${results.valid} valid, ${results.invalid} invalid`);
        return results;
    }
}

const comprehensivePlatformScheduler = new ComprehensivePlatformScheduler();

module.exports = {
    ComprehensivePlatformScheduler,
    comprehensivePlatformScheduler
};


