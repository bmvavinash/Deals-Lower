#!/usr/bin/env node

/**
 * Improved Banner Extraction Script
 * 
 * This script runs the improved banner extraction process with comprehensive logging
 * and validation to extract only actual promotional banners, not product images.
 * 
 * Usage:
 * node scripts/runImprovedBannerExtraction.js [options]
 * 
 * Options:
 * --platform <platform>  - Extract from specific platform (amazon, flipkart)
 * --max-banners <number>  - Maximum banners per platform (default: 5)
 * --chrome-port <port>    - Chrome debugging port (default: 9222)
 * --verbose               - Enable verbose logging
 * --dry-run              - Test extraction without storing in database
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const bannerConfig = require('../config/bannerConfig');

const logger = getModuleLogger('runImprovedBannerExtraction');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        platform: null,
        maxBanners: 15,
        chromePort: 9222,
        verbose: false,
        dryRun: false,
        enableDatabase: false,
        outputJson: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--platform':
                options.platform = args[++i];
                break;
            case '--max-banners':
                options.maxBanners = parseInt(args[++i]) || 5;
                break;
            case '--chrome-port':
                options.chromePort = parseInt(args[++i]) || 9222;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--enable-db':
                options.enableDatabase = true;
                break;
            case '--output-json':
                options.outputJson = true;
                break;
            case '--help':
                showHelp();
                process.exit(0);
                break;
        }
    }

    return options;
}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
Improved Banner Extraction Script

Usage: node scripts/runImprovedBannerExtraction.js [options]

Options:
  --platform <platform>  Extract from specific platform (amazon, flipkart)
  --max-banners <number>  Maximum banners per platform (default: 15)
  --chrome-port <port>   Chrome debugging port (default: 9222)
  --verbose              Enable verbose logging
  --dry-run             Test extraction without storing in database
  --enable-db           Enable database storage (default: disabled)
  --output-json         Output JSON format for testing
  --help                Show this help message

Examples:
  node scripts/runImprovedBannerExtraction.js
  node scripts/runImprovedBannerExtraction.js --platform amazon --max-banners 20
  node scripts/runImprovedBannerExtraction.js --verbose --output-json
  node scripts/runImprovedBannerExtraction.js --enable-db --max-banners 30
  node scripts/runImprovedBannerExtraction.js --chrome-port 9223

Prerequisites:
  1. Start Chrome with debugging enabled:
     chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\selenum\\ChromeProfile"
  2. Login to Amazon affiliate program: https://affiliate-program.amazon.in/home
  3. Keep Chrome browser open during extraction
`);
}

/**
 * Run banner extraction for specific platform
 * @param {string} platformKey - Platform to extract from
 * @param {Object} options - Extraction options
 */
async function runPlatformExtraction(platformKey, options) {
    try {
        logger.info(`Starting banner extraction for platform: ${platformKey}`);
        
        const platformConfig = bannerConfig.platforms[platformKey];
        if (!platformConfig) {
            throw new Error(`Unknown platform: ${platformKey}`);
        }

        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = options.maxBanners;
        extractor.chromePort = options.chromePort;
        extractor.enableDatabase = options.enableDatabase;

        // Initialize driver
        await extractor.initializeDriver();
        
        try {
            // Extract banners from platform
            const banners = await extractor.extractBannersFromPlatform(platformKey, platformConfig);
            
            logger.info(`Extraction completed for ${platformKey}`, {
                platform: platformKey,
                bannersFound: banners.length,
                maxBanners: options.maxBanners
            });

            // Display banner details
            if (options.verbose) {
                console.log(`\n📊 Banner Details for ${platformKey}:`);
                banners.forEach((banner, index) => {
                    console.log(`${index + 1}. ${banner.title || 'Untitled Banner'}`);
                    console.log(`   Category: ${banner.category} (Priority: ${banner.priority})`);
                    console.log(`   Confidence: ${banner.confidence}%`);
                    console.log(`   URL: ${banner.url?.substring(0, 80)}...`);
                    console.log(`   Click URL: ${banner.clickRedirectUrl?.substring(0, 80)}...`);
                    console.log('');
                });
            }

            // Store in database if enabled and not dry run
            if (!options.dryRun && options.enableDatabase) {
                const storedBanners = await extractor.storeBannersInFirebase(banners);
                logger.info(`Stored ${storedBanners.length} banners in database for ${platformKey}`);
            } else {
                logger.info(`Database storage disabled for ${platformKey} - ${banners.length} banners would be stored`);
            }

            // Output JSON format if requested
            if (options.outputJson) {
                const jsonOutput = extractor.generateJsonOutput(banners);
                console.log('\n📄 JSON Output:');
                console.log(JSON.stringify(jsonOutput, null, 2));
            }

            return {
                success: true,
                platform: platformKey,
                banners: banners.length,
                stored: options.dryRun ? 0 : banners.length
            };

        } finally {
            await extractor.closeDriver();
        }

    } catch (error) {
        logger.error(`Error extracting banners from ${platformKey}:`, { error: error.message });
        return {
            success: false,
            platform: platformKey,
            error: error.message
        };
    }
}

/**
 * Run banner extraction for all platforms
 * @param {Object} options - Extraction options
 */
async function runAllPlatformsExtraction(options) {
    try {
        logger.info('Starting banner extraction for all platforms');
        
        const results = [];
        const platforms = Object.keys(bannerConfig.platforms);
        
        logger.info(`Processing ${platforms.length} platforms: ${platforms.join(', ')}`);

        for (const platformKey of platforms) {
            try {
                const result = await runPlatformExtraction(platformKey, options);
                results.push(result);
                
                // Add delay between platforms to avoid rate limiting
                if (platformKey !== platforms[platforms.length - 1]) {
                    logger.info('Waiting 10 seconds before next platform...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
                
            } catch (error) {
                logger.error(`Failed to process platform ${platformKey}:`, { error: error.message });
                results.push({
                    success: false,
                    platform: platformKey,
                    error: error.message
                });
            }
        }

        // Generate summary
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalBanners = successful.reduce((sum, r) => sum + r.banners, 0);
        const totalStored = successful.reduce((sum, r) => sum + r.stored, 0);

        logger.info('Banner extraction completed', {
            totalPlatforms: platforms.length,
            successful: successful.length,
            failed: failed.length,
            totalBanners,
            totalStored
        });

        // Display summary
        console.log('\n📊 Extraction Summary:');
        console.log(`Total Platforms: ${platforms.length}`);
        console.log(`Successful: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        console.log(`Total Banners Found: ${totalBanners}`);
        console.log(`Total Banners Stored: ${totalStored}`);

        if (successful.length > 0) {
            console.log('\n✅ Successful Platforms:');
            successful.forEach(result => {
                console.log(`  ${result.platform}: ${result.banners} banners (${result.stored} stored)`);
            });
        }

        if (failed.length > 0) {
            console.log('\n❌ Failed Platforms:');
            failed.forEach(result => {
                console.log(`  ${result.platform}: ${result.error}`);
            });
        }

        return {
            success: failed.length === 0,
            results,
            summary: {
                totalPlatforms: platforms.length,
                successful: successful.length,
                failed: failed.length,
                totalBanners,
                totalStored
            }
        };

    } catch (error) {
        logger.error('Error in banner extraction process:', { error: error.message });
        throw error;
    }
}

/**
 * Test Chrome connection
 * @param {number} chromePort - Chrome debugging port
 */
async function testChromeConnection(chromePort) {
    try {
        logger.info(`Testing Chrome connection on port ${chromePort}`);
        
        const extractor = new ImprovedBannerExtractor();
        extractor.chromePort = chromePort;
        
        await extractor.initializeDriver();
        
        // Test navigation
        await extractor.driver.get('https://www.google.com');
        const title = await extractor.driver.getTitle();
        
        await extractor.closeDriver();
        
        logger.info('Chrome connection test successful', { port: chromePort, title });
        return true;
        
    } catch (error) {
        logger.error('Chrome connection test failed:', { 
            port: chromePort, 
            error: error.message 
        });
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        const options = parseArgs();
        
        logger.info('Starting improved banner extraction', {
            platform: options.platform || 'all',
            maxBanners: options.maxBanners,
            chromePort: options.chromePort,
            verbose: options.verbose,
            dryRun: options.dryRun,
            enableDatabase: options.enableDatabase,
            outputJson: options.outputJson
        });

        // Test Chrome connection first
        logger.info('Testing Chrome browser connection...');
        const chromeConnected = await testChromeConnection(options.chromePort);
        
        if (!chromeConnected) {
            console.error('\n❌ Chrome browser connection failed!');
            console.error('Please ensure Chrome is running with debugging enabled:');
            console.error(`chrome.exe --remote-debugging-port=${options.chromePort} --user-data-dir="C:\\selenum\\ChromeProfile"`);
            process.exit(1);
        }

        console.log('✅ Chrome browser connection successful');

        // Run extraction
        let result;
        if (options.platform) {
            result = await runPlatformExtraction(options.platform, options);
        } else {
            result = await runAllPlatformsExtraction(options);
        }

        if (result.success) {
            console.log('\n🎉 Banner extraction completed successfully!');
            process.exit(0);
        } else {
            console.log('\n❌ Banner extraction completed with errors');
            process.exit(1);
        }

    } catch (error) {
        logger.error('Banner extraction failed:', { error: error.message });
        console.error('\n❌ Banner extraction failed:', error.message);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
    console.error('\n❌ Uncaught exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', { reason, promise });
    console.error('\n❌ Unhandled rejection:', reason);
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = {
    runPlatformExtraction,
    runAllPlatformsExtraction,
    testChromeConnection,
    parseArgs
};
