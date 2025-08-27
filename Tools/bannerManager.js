#!/usr/bin/env node

const { bannerManager } = require('../bannerManager');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('bannerManagerTool');

class BannerManagerTool {
    constructor() {
        this.manager = bannerManager;
    }

    // List banners with filters
    async listBanners(options = {}) {
        console.log('📋 Fetching banners...');
        
        const filters = {};
        if (options.platform) filters.platform = options.platform;
        if (options.category) filters.category = options.category;
        if (options.activeOnly) filters.activeOnly = true;
        
        const result = await this.manager.getBanners(filters);
        
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
    }

    // Show statistics
    async showStats() {
        console.log('📊 Fetching banner statistics...');
        const result = await this.manager.getBannerStats();
        
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
    }

    // Delete banners
    async deleteBanners(options) {
        if (options.id) {
            console.log(`🗑️  Deleting banner: ${options.id}`);
            const result = await this.manager.deleteBanner(options.id);
            
            if (result.status === 200) {
                console.log(`✅ Banner deleted successfully`);
            } else {
                console.log(`❌ Error deleting banner: ${result.message}`);
            }
        } else if (options.platform) {
            console.log(`🗑️  Deleting all banners for platform: ${options.platform}`);
            const result = await this.manager.deleteBannersByPlatform(options.platform);
            
            if (result.status === 200) {
                console.log(`✅ ${result.message}`);
            } else {
                console.log(`❌ Error deleting platform banners: ${result.message}`);
            }
        } else if (options.category) {
            console.log(`🗑️  Deleting all banners for category: ${options.category}`);
            const result = await this.manager.deleteBannersByCategory(options.category);
            
            if (result.status === 200) {
                console.log(`✅ ${result.message}`);
            } else {
                console.log(`❌ Error deleting category banners: ${result.message}`);
            }
        } else {
            console.log('❌ Please specify --id, --platform, or --category for deletion');
        }
    }

    // Deactivate banner
    async deactivateBanner(options) {
        if (!options.id) {
            console.log('❌ Please specify --id for deactivation');
            return;
        }
        
        console.log(`🔒 Deactivating banner: ${options.id}`);
        const result = await this.manager.deactivateBanner(options.id);
        
        if (result.status === 200) {
            console.log(`✅ Banner deactivated successfully`);
        } else {
            console.log(`❌ Error deactivating banner: ${result.message}`);
        }
    }

    // Update banner order
    async updateBannerOrder(options) {
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
        const result = await this.manager.updateBannerOrder(options.id, order);
        
        if (result.status === 200) {
            console.log(`✅ Banner order updated successfully`);
        } else {
            console.log(`❌ Error updating banner order: ${result.message}`);
        }
    }

    // Get display banners
    async getDisplayBanners(options) {
        const limit = options.limit ? parseInt(options.limit) : 15;
        console.log(`🎯 Fetching display banners (limit: ${limit})...`);
        
        const result = await this.manager.getDisplayBanners(limit);
        
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
    }

    // Bulk operations
    async bulkDelete(bannerIds) {
        console.log(`🗑️  Bulk deleting ${bannerIds.length} banners...`);
        const result = await this.manager.bulkDeleteBanners(bannerIds);
        
        if (result.status === 200) {
            console.log(`✅ ${result.message}`);
        } else {
            console.log(`❌ Error in bulk delete: ${result.message}`);
        }
    }

    // Clean up old banners
    async cleanupOldBanners(options = {}) {
        console.log('🧹 Cleaning up old banners...');
        
        const stats = await this.manager.getBannerStats();
        if (stats.status !== 200) {
            console.log('❌ Error getting banner statistics');
            return;
        }
        
        const data = stats.data;
        const totalBanners = data.total;
        const inactiveBanners = data.inactive;
        
        console.log(`📊 Current state:`);
        console.log(`   Total banners: ${totalBanners}`);
        console.log(`   Active banners: ${data.active}`);
        console.log(`   Inactive banners: ${inactiveBanners}`);
        
        if (inactiveBanners > 0) {
            console.log(`\n🗑️  Found ${inactiveBanners} inactive banners to clean up`);
            
            // Get inactive banners
            const inactiveResult = await this.manager.getBanners({ activeOnly: false });
            if (inactiveResult.status === 200) {
                const inactiveBannerIds = Object.keys(inactiveResult.data || {});
                
                if (inactiveBannerIds.length > 0) {
                    console.log(`   Deleting ${inactiveBannerIds.length} inactive banners...`);
                    await this.bulkDelete(inactiveBannerIds);
                }
            }
        } else {
            console.log('✅ No inactive banners to clean up');
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    const tool = new BannerManagerTool();
    
    try {
        // Parse options
        const options = {};
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const [key, value] = arg.slice(2).split('=');
                options[key] = value || true;
            }
        }
        
        switch (command) {
            case 'list':
                await tool.listBanners(options);
                break;
                
            case 'stats':
                await tool.showStats();
                break;
                
            case 'delete':
                await tool.deleteBanners(options);
                break;
                
            case 'deactivate':
                await tool.deactivateBanner(options);
                break;
                
            case 'order':
                await tool.updateBannerOrder(options);
                break;
                
            case 'display':
                await tool.getDisplayBanners(options);
                break;
                
            case 'cleanup':
                await tool.cleanupOldBanners(options);
                break;
                
            case 'help':
            default:
                console.log(`
🎯 Banner Manager Tool

USAGE: node tools/bannerManager.js <command> [options]

COMMANDS:
  list        List banners with optional filters
  stats       Show banner statistics
  delete      Delete banners
  deactivate  Deactivate banners
  order       Update banner order
  display     Get banners for display
  cleanup     Clean up old inactive banners
  help        Show this help

OPTIONS:
  --platform=<platform>      Filter by platform (amazon, flipkart, etc.)
  --category=<category>      Filter by category (hero, promotional, seasonal, category)
  --active-only              Show only active banners
  --limit=<number>           Limit number of results
  --id=<banner-id>           Specific banner ID
  --order=<number>           New order value for banner

EXAMPLES:
  # List all active banners
  node tools/bannerManager.js list --active-only

  # List Amazon banners only
  node tools/bannerManager.js list --platform=amazon

  # Show banner statistics
  node tools/bannerManager.js stats

  # Delete a specific banner
  node tools/bannerManager.js delete --id=amazon-hero-2025-08-05-abc123

  # Delete all Flipkart banners
  node tools/bannerManager.js delete --platform=flipkart

  # Delete all category banners
  node tools/bannerManager.js delete --category=category

  # Deactivate a banner
  node tools/bannerManager.js deactivate --id=amazon-hero-2025-08-05-abc123

  # Update banner order
  node tools/bannerManager.js order --id=amazon-hero-2025-08-05-abc123 --order=1

  # Get display banners (limited to 15)
  node tools/bannerManager.js display --limit=10

  # Clean up old inactive banners
  node tools/bannerManager.js cleanup
`);
                break;
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal Error:', error.message);
        process.exit(1);
    });
}

module.exports = { BannerManagerTool }; 