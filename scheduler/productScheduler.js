const { getModuleLogger } = require('../logger/logger');
const { runBatch } = require('../dataSources/batchProductExtractor');
const { DEFAULT_SEEDS } = require('../scripts/runBatchProducts');

const logger = getModuleLogger('productScheduler');

class ProductScheduler {
    constructor(intervalMs = 60 * 60 * 1000) {
        this.isRunning = false;
        this.intervalId = null;
        this.lastRun = null;
        this.intervalMs = intervalMs;
        this.lastSummary = null;
    }

    async start(seeds = DEFAULT_SEEDS, sourceType = 'website', categoryKey = '') {
        if (this.isRunning) {
            logger.warn('Product scheduler is already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting product scheduler');

        await this.runProductExtraction(seeds, sourceType, categoryKey);

        this.intervalId = setInterval(async () => {
            await this.runProductExtraction(seeds, sourceType, categoryKey);
        }, this.intervalMs);

        logger.info(`Product scheduler started - will run every ${this.intervalMs / 1000 / 60} minutes`);
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('Product scheduler is not running');
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('Product scheduler stopped');
    }

    async runProductExtraction(seeds, sourceType, categoryKey) {
        if (!this.isRunning) {
            logger.warn('Product scheduler is not running, skipping extraction');
            return;
        }

        try {
            this.lastRun = new Date();
            logger.info('Starting scheduled product extraction', { pages: seeds.length });

            const result = await runBatch(seeds, sourceType, categoryKey);

            const prevStored = this.lastSummary?.totalStored || 0;
            const deltaStored = result.totalStored - prevStored;
            this.lastSummary = result;

            logger.info('Scheduled product extraction completed', {
                pages: result.pages,
                extracted: result.totalExtracted,
                stored: result.totalStored,
                deltaStored,
                lastRun: this.lastRun
            });
        } catch (error) {
            logger.error('Error in scheduled product extraction', {
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
            nextRun: this.lastRun ? new Date(this.lastRun.getTime() + this.intervalMs) : null,
            interval: this.intervalMs,
            lastSummary: this.lastSummary
        };
    }
}

const productScheduler = new ProductScheduler();

module.exports = {
    productScheduler,
    ProductScheduler
};



