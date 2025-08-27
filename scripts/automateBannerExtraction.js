#!/usr/bin/env node

const { extractBanners } = require('../dataSources/bannerExtractor');
const { bannerManager } = require('../bannerManager');
const { getModuleLogger } = require('../logger/logger');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('automateBannerExtraction');

class BannerAutomation {
    constructor() {
        this.logFile = path.join(__dirname, '../logs/banner-automation.log');
        this.statsFile = path.join(__dirname, '../logs/banner-stats.json');
    }

    // Log to file
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type}] ${message}\n`;
        
        // Console output
        console.log(logEntry.trim());
        
        // File output
        try {
            fs.appendFileSync(this.logFile, logEntry);
        } catch (error) {
            console.error('Error writing to log file:', error.message);
        }
    }

    // Save statistics
    saveStats(stats) {
        try {
            const statsData = {
                timestamp: new Date().toISOString(),
                ...stats
            };
            fs.writeFileSync(this.statsFile, JSON.stringify(statsData, null, 2));
        } catch (error) {
            this.log(`Error saving stats: ${error.message}`, 'ERROR');
        }
    }

    // Main automation function
    async runExtraction() {
        const startTime = new Date();
        this.log('🚀 Starting automated banner extraction...');
        
        try {
            // Extract banners
            this.log('📥 Extracting banners from all platforms...');
            const result = await extractBanners();
            
            if (result.success) {
                this.log(`✅ Extraction completed successfully!`);
                this.log(`   Extracted: ${result.extracted} banners`);
                this.log(`   Stored: ${result.stored} banners`);
                
                // Get statistics
                const stats = await bannerManager.getBannerStats();
                if (stats.status === 200) {
                    this.log('📊 Current banner statistics:');
                    this.log(`   Total: ${stats.data.total}`);
                    this.log(`   Active: ${stats.data.active}`);
                    this.log(`   Inactive: ${stats.data.inactive}`);
                    
                    // Save statistics
                    this.saveStats(stats.data);
                }
                
                const endTime = new Date();
                const duration = (endTime - startTime) / 1000;
                this.log(`⏱️  Extraction completed in ${duration.toFixed(2)} seconds`);
                
                return {
                    success: true,
                    extracted: result.extracted,
                    stored: result.stored,
                    duration: duration
                };
            } else {
                this.log(`❌ Extraction failed: ${result.error}`, 'ERROR');
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            this.log(`❌ Fatal error during extraction: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Cleanup old banners
    async cleanupOldBanners() {
        this.log('🧹 Starting banner cleanup...');
        
        try {
            // Get all banners
            const allBanners = await bannerManager.getBanners();
            
            if (allBanners.status === 200) {
                const banners = allBanners.data || {};
                const bannerCount = Object.keys(banners).length;
                
                if (bannerCount > 100) {
                    // Delete old category banners if we have too many
                    this.log('🗑️  Too many banners, cleaning up category banners...');
                    const deleteResult = await bannerManager.deleteBannersByCategory('category');
                    
                    if (deleteResult.status === 200) {
                        this.log(`✅ Cleanup completed: ${deleteResult.message}`);
                    } else {
                        this.log(`⚠️  Cleanup warning: ${deleteResult.message}`, 'WARN');
                    }
                } else {
                    this.log(`✅ Banner count is manageable (${bannerCount}), no cleanup needed`);
                }
            }
        } catch (error) {
            this.log(`❌ Error during cleanup: ${error.message}`, 'ERROR');
        }
    }

    // Health check
    async healthCheck() {
        this.log('🏥 Running banner system health check...');
        
        try {
            const stats = await bannerManager.getBannerStats();
            
            if (stats.status === 200) {
                const data = stats.data;
                
                // Check if we have active banners
                if (data.active === 0) {
                    this.log('⚠️  No active banners found!', 'WARN');
                    return false;
                }
                
                // Check if we have too many inactive banners
                if (data.inactive > data.active * 2) {
                    this.log('⚠️  Too many inactive banners, consider cleanup', 'WARN');
                }
                
                this.log('✅ Banner system is healthy');
                return true;
            } else {
                this.log('❌ Health check failed', 'ERROR');
                return false;
            }
        } catch (error) {
            this.log(`❌ Health check error: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // Full automation cycle
    async runFullCycle() {
        this.log('🔄 Starting full banner automation cycle...');
        
        // Health check
        const isHealthy = await this.healthCheck();
        
        if (!isHealthy) {
            this.log('⚠️  System health check failed, proceeding with extraction anyway', 'WARN');
        }
        
        // Run extraction
        const extractionResult = await this.runExtraction();
        
        if (extractionResult.success) {
            // Cleanup if needed
            await this.cleanupOldBanners();
            
            // Final health check
            await this.healthCheck();
            
            this.log('✅ Full automation cycle completed successfully');
        } else {
            this.log('❌ Automation cycle failed', 'ERROR');
        }
        
        return extractionResult;
    }
}

// Main execution
async function main() {
    const automation = new BannerAutomation();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'extract';
    
    try {
        switch (command) {
            case 'extract':
                await automation.runExtraction();
                break;
                
            case 'cleanup':
                await automation.cleanupOldBanners();
                break;
                
            case 'health':
                await automation.healthCheck();
                break;
                
            case 'full':
                await automation.runFullCycle();
                break;
                
            default:
                console.log(`
🎯 Banner Automation Script

USAGE: node scripts/automateBannerExtraction.js [command]

COMMANDS:
  extract    Run banner extraction only
  cleanup    Run banner cleanup only
  health     Run health check only
  full       Run full automation cycle (extract + cleanup + health)

EXAMPLES:
  # Run extraction only
  node scripts/automateBannerExtraction.js extract

  # Run full cycle
  node scripts/automateBannerExtraction.js full

  # Health check
  node scripts/automateBannerExtraction.js health

CRON EXAMPLES:
  # Run extraction every hour
  0 * * * * cd /path/to/project && node scripts/automateBannerExtraction.js extract

  # Run full cycle daily at 2 AM
  0 2 * * * cd /path/to/project && node scripts/automateBannerExtraction.js full

  # Health check every 6 hours
  0 */6 * * * cd /path/to/project && node scripts/automateBannerExtraction.js health
`);
                break;
        }
    } catch (error) {
        automation.log(`❌ Fatal error: ${error.message}`, 'ERROR');
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

module.exports = { BannerAutomation }; 