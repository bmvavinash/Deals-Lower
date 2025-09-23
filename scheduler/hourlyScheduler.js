const cron = require('node-cron');
const { getModuleLogger } = require('../logger/logger');
const { runBatch } = require('../dataSources/batchProductExtractor');
const { extractBannersFromAmazonWebsite } = require('../dataSources/enhancedBannerExtractor');
const { getAllProductDeals, updateProductDeal } = require('../database/firebaseDB/productDealsDB');
const { getAllTestBanners, updateTestBannerStatus } = require('../database/firebaseDB/testBannerDB');

const logger = getModuleLogger('hourlyScheduler');

class HourlyScheduler {
    constructor() {
        this.isRunning = false;
        this.jobs = new Map();
        this.DEFAULT_SEEDS = [
            'https://www.amazon.in',
            'https://www.amazon.in/deals',
            
            // Electronics
            'https://www.amazon.in/gp/browse.html?node=976419031',  // Electronics
            'https://www.amazon.in/gp/browse.html?node=1389401031', // Mobiles & Accessories
            'https://www.amazon.in/gp/browse.html?node=976392031',  // Computers & Accessories
            'https://www.amazon.in/s?k=mobile+phones',
            'https://www.amazon.in/s?k=laptops',
            'https://www.amazon.in/s?k=headphones',
            'https://www.amazon.in/s?k=smartwatches',
            'https://www.amazon.in/s?k=cameras',
            
            // Fashion
            'https://www.amazon.in/gp/browse.html?node=1968024031', // Fashion (Men)
            'https://www.amazon.in/gp/browse.html?node=1968253031', // Fashion (Women)
            'https://www.amazon.in/s?k=mens+clothing',
            'https://www.amazon.in/s?k=womens+clothing',
            'https://www.amazon.in/s?k=shoes',
            'https://www.amazon.in/s?k=accessories',
            
            // Home & Kitchen
            'https://www.amazon.in/gp/browse.html?node=976442031',  // Home & Kitchen
            'https://www.amazon.in/gp/browse.html?node=1380365031', // Large Appliances
            'https://www.amazon.in/s?k=furniture',
            'https://www.amazon.in/s?k=kitchen+appliances',
            'https://www.amazon.in/s?k=home+decor',
            'https://www.amazon.in/s?k=cookware',
            
            // Sports & Fitness
            'https://www.amazon.in/gp/browse.html?node=1984443031', // Sports & Outdoors
            'https://www.amazon.in/s?k=fitness+equipment',
            'https://www.amazon.in/s?k=sports+gear',
            'https://www.amazon.in/s?k=outdoor+recreation',
            
            // Beauty & Personal Care
            'https://www.amazon.in/gp/browse.html?node=1355016031', // Beauty & Personal Care
            'https://www.amazon.in/s?k=skincare',
            'https://www.amazon.in/s?k=makeup',
            'https://www.amazon.in/s?k=hair+care',
            'https://www.amazon.in/s?k=personal+care',
            
            // Automotive
            'https://www.amazon.in/gp/browse.html?node=1571272031', // Automotive
            'https://www.amazon.in/s?k=car+care',
            'https://www.amazon.in/s?k=car+parts',
            'https://www.amazon.in/s?k=car+electronics',
            'https://www.amazon.in/s?k=motorcycle',
            
            // Baby & Kids
            'https://www.amazon.in/gp/browse.html?node=1350380031', // Toys & Games
            'https://www.amazon.in/s?k=baby+clothing',
            'https://www.amazon.in/s?k=kids+clothing',
            'https://www.amazon.in/s?k=toys+games',
            'https://www.amazon.in/s?k=baby+care',
            
            // Grocery
            'https://www.amazon.in/gp/browse.html?node=4859480031', // Grocery & Gourmet Foods
            'https://www.amazon.in/s?k=food+beverages',
            'https://www.amazon.in/s?k=fresh+produce',
            'https://www.amazon.in/s?k=dairy+eggs',
            'https://www.amazon.in/s?k=frozen+foods',
            
            // Tools & Hardware
            'https://www.amazon.in/s?k=hand+tools',
            'https://www.amazon.in/s?k=power+tools',
            'https://www.amazon.in/s?k=hardware',
            'https://www.amazon.in/s?k=safety+equipment',
            
            // Music & Entertainment
            'https://www.amazon.in/gp/browse.html?node=976389031',  // Books
            'https://www.amazon.in/s?k=musical+instruments',
            'https://www.amazon.in/s?k=audio+equipment',
            'https://www.amazon.in/s?k=gaming',
            'https://www.amazon.in/s?k=books',
            
            // Pet Supplies
            'https://www.amazon.in/gp/browse.html?node=4772060031', // Pet Supplies
            'https://www.amazon.in/s?k=dog+supplies',
            'https://www.amazon.in/s?k=cat+supplies',
            'https://www.amazon.in/s?k=pet+supplies'
        ];
    }

    /**
     * Start the hourly scheduler
     */
    start() {
        if (this.isRunning) {
            logger.warn('Hourly scheduler is already running');
            return;
        }

        logger.info('Starting hourly scheduler');

        // Schedule product extraction every hour
        this.scheduleProductExtraction();
        
        // Schedule banner extraction every hour
        this.scheduleBannerExtraction();

        this.isRunning = true;
        logger.info('Hourly scheduler started successfully');
    }

    /**
     * Stop the hourly scheduler
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('Hourly scheduler is not running');
            return;
        }

        logger.info('Stopping hourly scheduler');

        // Stop all scheduled jobs
        for (const [name, job] of this.jobs) {
            job.stop();
            logger.info(`Stopped job: ${name}`);
        }

        this.jobs.clear();
        this.isRunning = false;
        logger.info('Hourly scheduler stopped successfully');
    }

    /**
     * Schedule product extraction to run every hour
     */
    scheduleProductExtraction() {
        const job = cron.schedule('0 * * * *', async () => {
            logger.info('Starting scheduled product extraction');
            try {
                await this.runProductExtraction();
                logger.info('Scheduled product extraction completed');
            } catch (error) {
                logger.error('Scheduled product extraction failed:', error);
            }
        }, {
            scheduled: false
        });

        this.jobs.set('productExtraction', job);
        job.start();
        logger.info('Product extraction scheduled for every hour');
    }

    /**
     * Schedule banner extraction to run every hour
     */
    scheduleBannerExtraction() {
        const job = cron.schedule('30 * * * *', async () => {
            logger.info('Starting scheduled banner extraction');
            try {
                await this.runBannerExtraction();
                logger.info('Scheduled banner extraction completed');
            } catch (error) {
                logger.error('Scheduled banner extraction failed:', error);
            }
        }, {
            scheduled: false
        });

        this.jobs.set('bannerExtraction', job);
        job.start();
        logger.info('Banner extraction scheduled for every hour (at 30 minutes)');
    }

    /**
     * Run product extraction and detect changes
     */
    async runProductExtraction() {
        logger.info('Running product extraction with change detection');
        
        try {
            // Run batch extraction
            const result = await runBatch(this.DEFAULT_SEEDS, 'website', '');
            logger.info('Product extraction completed', { 
                totalExtracted: result.totalExtracted, 
                totalStored: result.totalStored 
            });

            // Check for price/discount changes in existing products
            await this.detectProductChanges();

        } catch (error) {
            logger.error('Product extraction failed:', error);
            throw error;
        }
    }

    /**
     * Run banner extraction
     */
    async runBannerExtraction() {
        logger.info('Running banner extraction');
        
        try {
            // Extract banners from Amazon website (no login required)
            const banners = await extractBannersFromAmazonWebsite();
            logger.info('Banner extraction completed', { count: banners.length });

            // Check for banner changes
            await this.detectBannerChanges(banners);

        } catch (error) {
            logger.error('Banner extraction failed:', error);
            throw error;
        }
    }

    /**
     * Detect changes in existing products (prices, discounts)
     */
    async detectProductChanges() {
        logger.info('Checking for product changes');
        
        try {
            const existingProducts = await getAllProductDeals();
            let changesDetected = 0;

            for (const [productId, product] of Object.entries(existingProducts)) {
                // For now, we'll just log that we're checking
                // In a real implementation, you'd compare with fresh data
                logger.debug(`Checking product for changes: ${productId}`);
                
                // TODO: Implement actual change detection logic
                // This would involve re-scraping the product page and comparing values
            }

            logger.info('Product change detection completed', { changesDetected });
            return changesDetected;

        } catch (error) {
            logger.error('Product change detection failed:', error);
            throw error;
        }
    }

    /**
     * Detect changes in existing banners
     */
    async detectBannerChanges(newBanners) {
        logger.info('Checking for banner changes');
        
        try {
            const existingBanners = await getAllTestBanners();
            let changesDetected = 0;

            for (const [bannerId, existingBanner] of Object.entries(existingBanners)) {
                // Check if banner still exists in new extraction
                const stillExists = newBanners.some(banner => 
                    banner.url === existingBanner.url || 
                    banner.clickRedirectUrl === existingBanner.clickRedirectUrl
                );

                if (!stillExists) {
                    // Banner no longer exists, mark as inactive
                    await updateTestBannerStatus(bannerId, false);
                    changesDetected++;
                    logger.info(`Banner marked as inactive: ${bannerId}`);
                }
            }

            logger.info('Banner change detection completed', { changesDetected });
            return changesDetected;

        } catch (error) {
            logger.error('Banner change detection failed:', error);
            throw error;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            nextProductExtraction: this.getNextRunTime('productExtraction'),
            nextBannerExtraction: this.getNextRunTime('bannerExtraction')
        };
    }

    /**
     * Get next run time for a specific job
     */
    getNextRunTime(jobName) {
        const job = this.jobs.get(jobName);
        if (!job) return null;
        
        // For cron jobs, we can't easily get next run time without additional logic
        // This is a simplified version
        return 'Every hour';
    }

    /**
     * Manually trigger product extraction
     */
    async triggerProductExtraction() {
        logger.info('Manual trigger of product extraction');
        return await this.runProductExtraction();
    }

    /**
     * Manually trigger banner extraction
     */
    async triggerBannerExtraction() {
        logger.info('Manual trigger of banner extraction');
        return await this.runBannerExtraction();
    }
}

// Create singleton instance
const hourlyScheduler = new HourlyScheduler();

module.exports = { HourlyScheduler, hourlyScheduler };
