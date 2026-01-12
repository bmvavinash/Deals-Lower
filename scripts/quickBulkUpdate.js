#!/usr/bin/env node

/**
 * Quick Bulk Update Launcher
 * 
 * This script provides quick access to common bulk update operations
 * without requiring command line arguments.
 */

const { runBulkUpdateAll, runBulkUpdateForPlatform, runBulkUpdateForCategory, PLATFORM_SEEDS } = require('./bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('quickBulkUpdate');

// Quick update configurations
const QUICK_CONFIGS = {
  // Popular single categories
  'amazon-electronics': { platform: 'amazon', category: 'electronics' },
  'amazon-fashion': { platform: 'amazon', category: 'fashion' },
  'amazon-home': { platform: 'amazon', category: 'home-kitchen' },
  'flipkart-electronics': { platform: 'flipkart', category: 'electronics' },
  'myntra-fashion': { platform: 'myntra', category: 'fashion' },
  
  // Platform-wide updates
  'amazon-all': { platform: 'amazon' },
  'flipkart-all': { platform: 'flipkart' },
  'myntra-all': { platform: 'myntra' },
  'ajio-all': { platform: 'ajio' },
  
  // Full system update
  'all-platforms': { platform: null }
};

function showQuickOptions() {
  console.log(`
🚀 Quick Bulk Update Options

Single Categories:
${Object.entries(QUICK_CONFIGS)
  .filter(([key, config]) => config.category)
  .map(([key, config]) => `  ${key}: ${config.platform} - ${config.category}`)
  .join('\n')}

Platform-wide:
${Object.entries(QUICK_CONFIGS)
  .filter(([key, config]) => !config.category && config.platform)
  .map(([key, config]) => `  ${key}: ${config.platform} (all categories)`)
  .join('\n')}

System-wide:
  all-platforms: All platforms and categories

Usage:
  node quickBulkUpdate.js [option]
  node quickBulkUpdate.js amazon-electronics
  node quickBulkUpdate.js amazon-all
  node quickBulkUpdate.js all-platforms

Options:
  --list, -l    Show this list of options
  --help, -h    Show detailed help
`);
}

function showDetailedHelp() {
  console.log(`
🚀 Quick Bulk Update Launcher - Detailed Help

This script provides quick access to common bulk update operations without
requiring complex command line arguments.

Quick Options:
${Object.entries(QUICK_CONFIGS)
  .map(([key, config]) => {
    if (config.platform && config.category) {
      return `  ${key}: ${config.platform} - ${config.category} (${PLATFORM_SEEDS[config.platform][config.category].length} URLs)`;
    } else if (config.platform) {
      const totalUrls = Object.values(PLATFORM_SEEDS[config.platform]).reduce((sum, urls) => sum + urls.length, 0);
      return `  ${key}: ${config.platform} (all categories, ${totalUrls} URLs)`;
    } else {
      const totalUrls = Object.values(PLATFORM_SEEDS).reduce((sum, platformData) => {
        return sum + Object.values(platformData).reduce((catSum, urls) => catSum + urls.length, 0);
      }, 0);
      return `  ${key}: All platforms (${totalUrls} URLs)`;
    }
  })
  .join('\n')}

Examples:
  node quickBulkUpdate.js amazon-electronics
    → Runs bulk update for Amazon Electronics category only
  
  node quickBulkUpdate.js amazon-all
    → Runs bulk update for all Amazon categories
  
  node quickBulkUpdate.js all-platforms
    → Runs bulk update for all platforms and categories

Database Options:
  By default, products are stored in the 'deals' database.
  To use a different database, use the full script:
  node runBulkUpdatesNow.js [option] --target-db productdeals

Estimated Times:
  Single category: 5-15 minutes
  Platform-wide: 30-60 minutes  
  All platforms: 1-3 hours

The script will show progress and completion statistics.
`);
}

async function runQuickUpdate(option, targetDb = 'deals', sourceType = 'website') {
  const config = QUICK_CONFIGS[option];
  
  if (!config) {
    console.error(`❌ Unknown quick option: ${option}`);
    console.log('Use --list to see available options');
    process.exit(1);
  }
  
  const startTime = Date.now();
  console.log(`\n🚀 Starting Quick Bulk Update: ${option}`);
  console.log('=====================================');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Target DB: ${targetDb}`);
  console.log(`Source Type: ${sourceType}`);
  console.log('=====================================\n');
  
  try {
    let result;
    
    if (config.platform && config.category) {
      // Single category
      const urls = PLATFORM_SEEDS[config.platform][config.category];
      console.log(`📦 Processing ${config.platform} - ${config.category} (${urls.length} URLs)`);
      result = await runBulkUpdateForCategory(config.platform, config.category, urls, sourceType, targetDb);
      
    } else if (config.platform) {
      // Platform-wide
      console.log(`📦 Processing ${config.platform} (all categories)`);
      result = await runBulkUpdateForPlatform(config.platform, sourceType, targetDb);
      
    } else {
      // All platforms
      console.log('📦 Processing all platforms');
      result = await runBulkUpdateAll(sourceType, targetDb);
    }
    
    const duration = Date.now() - startTime;
    const durationMinutes = Math.round(duration / 60000);
    
    console.log('\n✅ Quick Bulk Update Completed Successfully!');
    console.log('==========================================');
    console.log(`Duration: ${durationMinutes} minutes (${duration}ms)`);
    console.log(`Completed: ${new Date().toLocaleString()}`);
    
    if (result.totalPlatforms) {
      console.log(`\n📊 Summary:`);
      console.log(`  Total Platforms: ${result.totalPlatforms}`);
      console.log(`  Successful: ${result.successfulPlatforms}`);
      console.log(`  Failed: ${result.failedPlatforms}`);
      console.log(`  Total Products: ${result.totalProducts}`);
      console.log(`  Success Rate: ${result.successRate}%`);
    } else if (result.totalCategories) {
      console.log(`\n📊 Summary:`);
      console.log(`  Total Categories: ${result.totalCategories}`);
      console.log(`  Total Products: ${result.totalProducts}`);
      console.log(`  Total Success: ${result.totalSuccess}`);
      console.log(`  Total Errors: ${result.totalErrors}`);
      console.log(`  Success Rate: ${result.successRate}%`);
    } else {
      console.log(`\n📊 Summary:`);
      console.log(`  Total Products: ${result.totalProducts || 0}`);
      console.log(`  Success Count: ${result.successCount || 0}`);
      console.log(`  Error Count: ${result.errorCount || 0}`);
      console.log(`  Created: ${result.createdCount || 0}`);
      console.log(`  Updated: ${result.updatedCount || 0}`);
      console.log(`  Success Rate: ${result.successRate || 'N/A'}%`);
    }
    
    logger.info('✅ Quick bulk update completed successfully', {
      option,
      duration,
      result
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('❌ Quick bulk update failed', {
      option,
      error: error.message,
      stack: error.stack,
      duration
    });
    
    console.error('\n❌ Quick Bulk Update Failed!');
    console.error('==============================');
    console.error(`Error: ${error.message}`);
    console.error(`Duration: ${Math.round(duration / 60000)} minutes`);
    console.error(`Failed: ${new Date().toLocaleString()}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showDetailedHelp();
    process.exit(0);
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    showQuickOptions();
    process.exit(0);
  }
  
  const option = args[0];
  const targetDb = args.includes('--target-db') ? args[args.indexOf('--target-db') + 1] : 'deals';
  const sourceType = args.includes('--source-type') ? args[args.indexOf('--source-type') + 1] : 'website';
  
  await runQuickUpdate(option, targetDb, sourceType);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, runQuickUpdate, QUICK_CONFIGS };







