#!/usr/bin/env node

const { bannerManager } = require('./bannerManager');
const { extractBanners } = require('./dataSources/bannerExtractor');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('bannerCLI');

// Command-line argument parser
function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = {};
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            options[key] = args[i + 1] || true;
        }
    }
    
    return { command, options };
}

// Help function
function showHelp() {
    console.log(`
🎯 Banner Management CLI

USAGE: node bannerCLI.js <command> [options]

COMMANDS:
  extract                    Extract banners from all platforms
  list                       List banners with optional filters
  stats                      Show banner statistics
  delete                     Delete banners
  deactivate                 Deactivate banners
  order                      Update banner order
  display                    Get banners for display

OPTIONS:
  --platform=<platform>      Filter by platform (amazon, flipkart, etc.)
  --category=<category>      Filter by category (hero, promotional, seasonal, category)
  --active-only              Show only active banners
  --limit=<number>           Limit number of results
  --id=<banner-id>           Specific banner ID
  --order=<number>           New order value for banner

EXAMPLES:
  # Extract banners from all platforms
  node bannerCLI.js extract

  # List all active banners
  node bannerCLI.js list --active-only

  # List Amazon banners only
  node bannerCLI.js list --platform=amazon

  # Show banner statistics
  node bannerCLI.js stats

  # Delete a specific banner
  node bannerCLI.js delete --id=amazon-hero-2025-08-05-abc123

  # Delete all Flipkart banners
  node bannerCLI.js delete --platform=flipkart

  # Delete all category banners
  node bannerCLI.js delete --category=category

  # Deactivate a banner
  node bannerCLI.js deactivate --id=amazon-hero-2025-08-05-abc123

  # Update banner order
  node bannerCLI.js order --id=amazon-hero-2025-08-05-abc123 --order=1

  # Get display banners (limited to 15)
  node bannerCLI.js display --limit=10

AUTOMATION:
  # Run extraction every hour (add to crontab)
  0 * * * * cd /path/to/project && node bannerCLI.js extract

  # Clean up old banners daily
  0 2 * * * cd /path/to/project && node bannerCLI.js delete --category=category

  # Get daily statistics
  0 9 * * * cd /path/to/project && node bannerCLI.js stats
`);
}

// Extract banners
async function extractBanners() {
    try {
        console.log('🔄 Starting banner extraction...');
        const result = await extractBanners();
        
        if (result.success) {
            console.log(`✅ Extraction completed successfully!`);
            console.log(`   Extracted: ${result.extracted} banners`);
            console.log(`   Stored: ${result.stored} banners`);
        } else {
            console.log(`❌ Extraction failed: ${result.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.log(`❌ Error during extraction: ${error.message}`);
        process.exit(1);
    }
}

// List banners
async function listBanners(options) {
    try {
        const filters = {};
        if (options.platform) filters.platform = options.platform;
        if (options.category) filters.category = options.category;
        if (options['active-only']) filters.activeOnly = true;
        
        console.log('📋 Fetching banners...');
        const result = await bannerManager.getBanners(filters);
        
        if (result.status === 200) {
            const banners = result.data || {};
            const bannerCount = Object.keys(banners).length;
            
            console.log(`✅ Found ${bannerCount} banners`);
            
            if (bannerCount > 0) {
                const limit = options.limit ? parseInt(options.limit) : 10;
                const bannerList = Object.values(banners).slice(0, limit);
                
                bannerList.forEach((banner, index) => {
                    console.log(`\n${index + 1}. ${banner.id}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   Category: ${banner.category} (Priority: ${banner.priority})`);
                    console.log(`   Active: ${banner.isActive ? 'Yes' : 'No'}`);
                    console.log(`   URL: ${banner.url}`);
                    console.log(`   Title: ${banner.title || 'N/A'}`);
                    console.log(`   Created: ${banner.creationTimestamp}`);
                });
                
                if (bannerCount > limit) {
                    console.log(`\n... and ${bannerCount - limit} more banners`);
                }
            }
        } else {
            console.log(`❌ Error fetching banners: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ Error listing banners: ${error.message}`);
    }
}

// Show statistics
async function showStats() {
    try {
        console.log('📊 Fetching banner statistics...');
        const result = await bannerManager.getBannerStats();
        
        if (result.status === 200) {
            const stats = result.data;
            console.log('\n📈 Banner Statistics:');
            console.log(`   Total Banners: ${stats.total}`);
            console.log(`   Active Banners: ${stats.active}`);
            console.log(`   Inactive Banners: ${stats.inactive}`);
            
            console.log('\n📊 By Platform:');
            Object.entries(stats.byPlatform).forEach(([platform, count]) => {
                console.log(`   ${platform}: ${count}`);
            });
            
            console.log('\n📊 By Category:');
            Object.entries(stats.byCategory).forEach(([category, count]) => {
                console.log(`   ${category}: ${count}`);
            });
        } else {
            console.log(`❌ Error fetching statistics: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ Error showing statistics: ${error.message}`);
    }
}

// Delete banners
async function deleteBanners(options) {
    try {
        if (options.id) {
            console.log(`🗑️  Deleting banner: ${options.id}`);
            const result = await bannerManager.deleteBanner(options.id);
            
            if (result.status === 200) {
                console.log(`✅ Banner deleted successfully`);
            } else {
                console.log(`❌ Error deleting banner: ${result.message}`);
            }
        } else if (options.platform) {
            console.log(`🗑️  Deleting all banners for platform: ${options.platform}`);
            const result = await bannerManager.deleteBannersByPlatform(options.platform);
            
            if (result.status === 200) {
                console.log(`✅ ${result.message}`);
            } else {
                console.log(`❌ Error deleting platform banners: ${result.message}`);
            }
        } else if (options.category) {
            console.log(`🗑️  Deleting all banners for category: ${options.category}`);
            const result = await bannerManager.deleteBannersByCategory(options.category);
            
            if (result.status === 200) {
                console.log(`✅ ${result.message}`);
            } else {
                console.log(`❌ Error deleting category banners: ${result.message}`);
            }
        } else {
            console.log('❌ Please specify --id, --platform, or --category for deletion');
        }
    } catch (error) {
        console.log(`❌ Error deleting banners: ${error.message}`);
    }
}

// Deactivate banner
async function deactivateBanner(options) {
    try {
        if (!options.id) {
            console.log('❌ Please specify --id for deactivation');
            return;
        }
        
        console.log(`🔒 Deactivating banner: ${options.id}`);
        const result = await bannerManager.deactivateBanner(options.id);
        
        if (result.status === 200) {
            console.log(`✅ Banner deactivated successfully`);
        } else {
            console.log(`❌ Error deactivating banner: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ Error deactivating banner: ${error.message}`);
    }
}

// Update banner order
async function updateBannerOrder(options) {
    try {
        if (!options.id || !options.order) {
            console.log('❌ Please specify both --id and --order');
            return;
        }
        
        const order = parseInt(options.order);
        if (isNaN(order)) {
            console.log('❌ Order must be a number');
            return;
        }
        
        console.log(`📝 Updating banner order: ${options.id} -> ${order}`);
        const result = await bannerManager.updateBannerOrder(options.id, order);
        
        if (result.status === 200) {
            console.log(`✅ Banner order updated successfully`);
        } else {
            console.log(`❌ Error updating banner order: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ Error updating banner order: ${error.message}`);
    }
}

// Get display banners
async function getDisplayBanners(options) {
    try {
        const limit = options.limit ? parseInt(options.limit) : 15;
        console.log(`🎯 Fetching display banners (limit: ${limit})...`);
        
        const result = await bannerManager.getDisplayBanners(limit);
        
        if (result.status === 200) {
            console.log(`✅ Found ${result.limited} display banners (${result.total} total)`);
            
            if (result.data.length > 0) {
                result.data.forEach((banner, index) => {
                    console.log(`\n${index + 1}. ${banner.id}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   Category: ${banner.category} (Priority: ${banner.priority})`);
                    console.log(`   URL: ${banner.url}`);
                    console.log(`   Title: ${banner.title || 'N/A'}`);
                });
            }
        } else {
            console.log(`❌ Error fetching display banners: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ Error getting display banners: ${error.message}`);
    }
}

// Main CLI function
async function main() {
    const { command, options } = parseArgs();
    
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        return;
    }
    
    try {
        switch (command) {
            case 'extract':
                await extractBanners();
                break;
                
            case 'list':
                await listBanners(options);
                break;
                
            case 'stats':
                await showStats();
                break;
                
            case 'delete':
                await deleteBanners(options);
                break;
                
            case 'deactivate':
                await deactivateBanner(options);
                break;
                
            case 'order':
                await updateBannerOrder(options);
                break;
                
            case 'display':
                await getDisplayBanners(options);
                break;
                
            default:
                console.log(`❌ Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.log(`❌ CLI Error: ${error.message}`);
        process.exit(1);
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.log(`❌ Fatal Error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    main,
    extractBanners,
    listBanners,
    showStats,
    deleteBanners,
    deactivateBanner,
    updateBannerOrder,
    getDisplayBanners
}; 