const { getModuleLogger } = require('../logger/logger');
const { productScheduler } = require('../scheduler/productScheduler');
const { bannerScheduler } = require('../scheduler/bannerScheduler');
const { DEFAULT_SEEDS } = require('./runBatchProducts');

const logger = getModuleLogger('startSchedulers');

async function main() {
    try {
        logger.info('Starting product and banner schedulers');

        await productScheduler.start(DEFAULT_SEEDS);
        await bannerScheduler.start();

        logger.info('Schedulers started');
    } catch (error) {
        logger.error('Failed to start schedulers', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };



