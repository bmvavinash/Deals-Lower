#!/usr/bin/env node

/**
 * Script to run Favorites Notification Service from CLI
 */
const { favoritesNotificationService } = require('../services/favoritesNotificationService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('runFavoritesService');

async function run() {
    logger.info('🚀 Starting user favorites notification checks...');
    
    try {
        const result = await favoritesNotificationService.runOnce();
        logger.info('✅ User favorites checks completed successfully!', { result });
        process.exit(0);
    } catch (error) {
        logger.error('❌ User favorites checks failed:', error);
        process.exit(1);
    }
}

run();
