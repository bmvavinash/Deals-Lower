const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testMemoryOptimization');

async function testMemoryOptimization() {
    try {
        logger.info('Testing memory optimization...');
        
        // Test if garbage collection is available
        if (global.gc) {
            logger.info('Garbage collection is available');
            global.gc();
            logger.info('Garbage collection completed');
        } else {
            logger.warn('Garbage collection not available - run with --expose-gc flag');
        }
        
        // Test basic memory usage
        const memUsage = process.memoryUsage();
        logger.info('Memory usage:', {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
        });
        
        logger.info('Memory optimization test completed successfully');
        
    } catch (error) {
        logger.error('Memory optimization test failed', { error: error.message });
    }
}

if (require.main === module) {
    testMemoryOptimization();
}

module.exports = { testMemoryOptimization };
