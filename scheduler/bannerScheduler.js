const { extractBanners } = require('../dataSources/bannerExtractor');
const { getModuleLogger } = require('../logger/logger');
const bannerConfig = require('../config/bannerConfig');

const logger = getModuleLogger('bannerScheduler');

class BannerScheduler {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.lastRun = null;
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Banner scheduler is already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting banner scheduler');

        // Run immediately on start
        await this.runBannerExtraction();

        // Schedule to run every hour
        this.intervalId = setInterval(async () => {
            await this.runBannerExtraction();
        }, bannerConfig.global.extractionInterval);

        logger.info(`Banner scheduler started - will run every ${bannerConfig.global.extractionInterval / 1000 / 60} minutes`);
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('Banner scheduler is not running');
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        logger.info('Banner scheduler stopped');
    }

    async runBannerExtraction() {
        if (!this.isRunning) {
            logger.warn('Banner scheduler is not running, skipping extraction');
            return;
        }

        try {
            logger.info('Starting scheduled banner extraction');
            this.lastRun = new Date();

            const result = await extractBanners();

            if (result.success) {
                logger.info('Scheduled banner extraction completed successfully', {
                    extracted: result.extracted,
                    stored: result.stored,
                    lastRun: this.lastRun
                });
            } else {
                logger.error('Scheduled banner extraction failed', {
                    error: result.error,
                    lastRun: this.lastRun
                });
            }

        } catch (error) {
            logger.error('Error in scheduled banner extraction:', {
                error: error.message,
                stack: error.stack,
                lastRun: this.lastRun
            });
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.lastRun ? new Date(this.lastRun.getTime() + bannerConfig.global.extractionInterval) : null,
            interval: bannerConfig.global.extractionInterval
        };
    }
}

// Create a singleton instance
const bannerScheduler = new BannerScheduler();

// Export the singleton and the class
module.exports = {
    bannerScheduler,
    BannerScheduler
}; 