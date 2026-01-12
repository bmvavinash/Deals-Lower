#!/usr/bin/env node

/**
 * Immediate Bulk Update Runner
 * 
 * This script runs bulk updates immediately without waiting for scheduled intervals.
 * It provides various options for running bulk updates on specific platforms,
 * categories, or all platforms at once.
 * 
 * Usage Examples:
 * node runBulkUpdatesNow.js                    # Run all platforms
 * node runBulkUpdatesNow.js amazon             # Run Amazon only
 * node runBulkUpdatesNow.js amazon electronics # Run Amazon electronics only
 * node runBulkUpdatesNow.js --target-db productdeals  # Specify target database
 * node runBulkUpdatesNow.js --source-type website     # Specify source type
 */

const { runBulkUpdateAll, runBulkUpdateForPlatform, runBulkUpdateForCategory, PLATFORM_SEEDS } = require('./bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../logger/logger');
const { comprehensiveLoggingService } = require('../services/comprehensiveLoggingService');

const logger = getModuleLogger('runBulkUpdatesNow');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    
    let platform = '';
    let category = '';
    let targetDb = 'deals';
    let sourceType = 'website';
    let dryRun = false;
    let help = false;
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--help':
            case '-h':
                help = true;
                break;
            case '--target-db':
                targetDb = args[++i] || 'deals';
                break;
            case '--source-type':
                sourceType = args[++i] || 'website';
                break;
            case '--dry-run':
                dryRun = true;
                break;
            default:
                if (!platform) {
                    platform = arg;
                } else if (!category) {
                    category = arg;
                }
                break;
        }
    }
    
    return { platform, category, targetDb, sourceType, dryRun, help };
}

/**
 * Display help information
 */
function showHelp() {
    console.log(`
🚀 Immediate Bulk Update Runner

Usage:
  node runBulkUpdatesNow.js [options] [platform] [category]

Options:
  --help, -h           Show this help message
  --target-db <db>     Target database (default: deals)
  --source-type <type> Source type (default: website)
  --dry-run           Show what would be run without executing

Platforms:
  ${Object.keys(PLATFORM_SEEDS).join(', ')}

Categories (varies by platform):
  amazon: ${Object.keys(PLATFORM_SEEDS.amazon).join(', ')}
  flipkart: ${Object.keys(PLATFORM_SEEDS.flipkart).join(', ')}
  myntra: ${Object.keys(PLATFORM_SEEDS.myntra).join(', ')}
  ajio: ${Object.keys(PLATFORM_SEEDS.ajio).join(', ')}

Examples:
  node runBulkUpdatesNow.js                           # Run all platforms
  node runBulkUpdatesNow.js amazon                    # Run Amazon only
  node runBulkUpdatesNow.js amazon electronics        # Run Amazon electronics only
  node runBulkUpdatesNow.js --target-db productdeals  # Specify target database
  node runBulkUpdatesNow.js --source-type website     # Specify source type
  node runBulkUpdatesNow.js --dry-run amazon          # Show what would be run for Amazon
`);
}

/**
 * Validate arguments
 */
function validateArgs({ platform, category, targetDb, sourceType }) {
    const errors = [];
    
    if (platform && !PLATFORM_SEEDS[platform]) {
        errors.push(`Unknown platform: ${platform}. Available platforms: ${Object.keys(PLATFORM_SEEDS).join(', ')}`);
    }
    
    if (platform && category && !PLATFORM_SEEDS[platform]?.[category]) {
        const availableCategories = Object.keys(PLATFORM_SEEDS[platform] || {});
        errors.push(`Unknown category: ${category} for platform ${platform}. Available categories: ${availableCategories.join(', ')}`);
    }
    
    const validDatabases = ['deals', 'productdeals', 'test'];
    if (!validDatabases.includes(targetDb)) {
        errors.push(`Invalid target database: ${targetDb}. Valid options: ${validDatabases.join(', ')}`);
    }
    
    const validSourceTypes = ['website', 'telegram', 'api'];
    if (!validSourceTypes.includes(sourceType)) {
        errors.push(`Invalid source type: ${sourceType}. Valid options: ${validSourceTypes.join(', ')}`);
    }
    
    return errors;
}

/**
 * Show dry run information
 */
function showDryRun({ platform, category, targetDb, sourceType }) {
    console.log('\n🔍 DRY RUN - What would be executed:\n');
    
    if (platform && category) {
        const urls = PLATFORM_SEEDS[platform][category];
        console.log(`Platform: ${platform}`);
        console.log(`Category: ${category}`);
        console.log(`URLs to process: ${urls.length}`);
        console.log(`Target DB: ${targetDb}`);
        console.log(`Source Type: ${sourceType}`);
        console.log('\nURLs:');
        urls.forEach((url, index) => {
            console.log(`  ${index + 1}. ${url}`);
        });
    } else if (platform) {
        const platformData = PLATFORM_SEEDS[platform];
        const totalUrls = Object.values(platformData).reduce((sum, urls) => sum + urls.length, 0);
        console.log(`Platform: ${platform}`);
        console.log(`Categories: ${Object.keys(platformData).length}`);
        console.log(`Total URLs: ${totalUrls}`);
        console.log(`Target DB: ${targetDb}`);
        console.log(`Source Type: ${sourceType}`);
        console.log('\nCategories and URLs:');
        Object.entries(platformData).forEach(([cat, urls]) => {
            console.log(`  ${cat}: ${urls.length} URLs`);
        });
    } else {
        const totalPlatforms = Object.keys(PLATFORM_SEEDS).length;
        const totalUrls = Object.values(PLATFORM_SEEDS).reduce((sum, platformData) => {
            return sum + Object.values(platformData).reduce((catSum, urls) => catSum + urls.length, 0);
        }, 0);
        
        console.log(`All Platforms: ${totalPlatforms}`);
        console.log(`Total URLs: ${totalUrls}`);
        console.log(`Target DB: ${targetDb}`);
        console.log(`Source Type: ${sourceType}`);
        console.log('\nPlatforms:');
        Object.entries(PLATFORM_SEEDS).forEach(([platform, categories]) => {
            const platformUrls = Object.values(categories).reduce((sum, urls) => sum + urls.length, 0);
            console.log(`  ${platform}: ${Object.keys(categories).length} categories, ${platformUrls} URLs`);
        });
    }
    
    console.log('\n⚠️  This was a dry run. Use without --dry-run to execute.');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const args = parseArgs();
        
        if (args.help) {
            showHelp();
            process.exit(0);
        }
        
        // Validate arguments
        const errors = validateArgs(args);
        if (errors.length > 0) {
            console.error('❌ Validation errors:');
            errors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }
        
        // Show dry run if requested
        if (args.dryRun) {
            showDryRun(args);
            process.exit(0);
        }
        
        const startTime = Date.now();
        logger.info('🚀 Starting immediate bulk update', {
            platform: args.platform || 'ALL',
            category: args.category || 'ALL',
            targetDb: args.targetDb,
            sourceType: args.sourceType
        });
        
        console.log('\n🚀 Starting Immediate Bulk Update');
        console.log('================================');
        console.log(`Platform: ${args.platform || 'ALL'}`);
        console.log(`Category: ${args.category || 'ALL'}`);
        console.log(`Target DB: ${args.targetDb}`);
        console.log(`Source Type: ${args.sourceType}`);
        console.log(`Started: ${new Date().toLocaleString()}`);
        console.log('================================\n');
        
        let result;
        
        if (args.platform && args.category) {
            // Run specific platform and category
            const urls = PLATFORM_SEEDS[args.platform][args.category];
            console.log(`📦 Processing ${args.platform} - ${args.category} (${urls.length} URLs)`);
            result = await runBulkUpdateForCategory(args.platform, args.category, urls, args.sourceType, args.targetDb);
            
        } else if (args.platform) {
            // Run specific platform
            console.log(`📦 Processing ${args.platform} platform`);
            result = await runBulkUpdateForPlatform(args.platform, args.sourceType, args.targetDb);
            
        } else {
            // Run all platforms
            console.log('📦 Processing all platforms');
            result = await runBulkUpdateAll(args.sourceType, args.targetDb);
        }
        
        const duration = Date.now() - startTime;
        const durationMinutes = Math.round(duration / 60000);
        
        console.log('\n✅ Bulk Update Completed Successfully!');
        console.log('=====================================');
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
        
        logger.info('✅ Immediate bulk update completed successfully', {
            duration,
            result: result
        });
        
        process.exit(0);
        
    } catch (error) {
        const duration = Date.now() - (global.startTime || Date.now());
        logger.error('❌ Immediate bulk update failed', {
            error: error.message,
            stack: error.stack,
            duration
        });
        
        console.error('\n❌ Bulk Update Failed!');
        console.error('======================');
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

// Set global start time
global.startTime = Date.now();

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

module.exports = { main, parseArgs, validateArgs, showHelp, showDryRun };


