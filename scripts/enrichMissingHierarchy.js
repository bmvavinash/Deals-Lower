#!/usr/bin/env node

const { hierarchicalEnrichmentService } = require('../services/hierarchicalEnrichmentService');
const { initializeDriver, closeDriver } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('enrichMissingHierarchy');

async function main() {
  let driver;
  
  try {
    logger.info('🚀 Starting manual hierarchical enrichment process');
    
    // Initialize driver
    driver = await initializeDriver();
    logger.info('✅ Driver initialized successfully');
    
    // Run hierarchical enrichment
    await hierarchicalEnrichmentService.enrichProductsWithMissingHierarchy(driver);
    
    // Log final statistics
    const stats = hierarchicalEnrichmentService.getEnrichmentStats();
    logger.info('📊 Final Enrichment Statistics', stats);
    
    logger.info('✅ Manual hierarchical enrichment completed successfully');
    
  } catch (error) {
    logger.error('❌ Error in manual hierarchical enrichment', { error: error.message });
    process.exit(1);
  } finally {
    if (driver) {
      await closeDriver(driver);
      logger.info('🔒 Driver closed successfully');
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error('❌ Unhandled error in main function', { error: error.message });
  process.exit(1);
});
