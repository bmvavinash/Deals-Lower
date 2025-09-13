const { EnhancedBannerExtractor } = require('../dataSources/enhancedBannerExtractor');
const { testBannerDB } = require('../database/firebaseDB/bannerDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testEnhancedBannerExtraction');

async function testAmazonAffiliateExtraction() {
    console.log('🚀 Starting Amazon Affiliate Banner Extraction Test...');
    
    try {
        const extractor = new EnhancedBannerExtractor();
        
        // Extract banners from Amazon affiliate program
        console.log('📱 Connecting to Chrome browser on port 9222...');
        const result = await extractor.extractBannersFromAmazonAffiliate();
        
        console.log('\n✅ Extraction Results:');
        console.log(`📊 Total Banners Extracted: ${result.extracted}`);
        console.log(`💾 Banners Stored in Firebase: ${result.stored}`);
        
        if (result.banners.length > 0) {
            console.log('\n🎯 Extracted Banners:');
            result.banners.forEach((banner, index) => {
                console.log(`\n${index + 1}. ${banner.id}`);
                console.log(`   Platform: ${banner.platform}`);
                console.log(`   Category: ${banner.category}`);
                console.log(`   Validation Score: ${banner.validationScore}`);
                console.log(`   Image URL: ${banner.url}`);
                console.log(`   Click URL: ${banner.clickRedirectUrl}`);
                console.log(`   Alt Text: ${banner.altText}`);
                console.log(`   Validation Reasons: ${banner.validationReasons.join(', ')}`);
            });
        }
        
        // Get all test banners from Firebase
        console.log('\n🔥 Retrieving all test banners from Firebase...');
        const allBanners = await testBannerDB.getAllTestBanners();
        
        if (allBanners.status === 200) {
            const bannerCount = Object.keys(allBanners.data).length;
            console.log(`📈 Total banners in test-banners node: ${bannerCount}`);
            
            if (bannerCount > 0) {
                console.log('\n📋 Firebase Test Banners:');
                Object.entries(allBanners.data).forEach(([id, banner], index) => {
                    console.log(`\n${index + 1}. ${id}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   Category: ${banner.category}`);
                    console.log(`   Active: ${banner.isActive}`);
                    console.log(`   Created: ${banner.creationTimestamp}`);
                });
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error during banner extraction test:', error.message);
        logger.error('Banner extraction test failed:', { error: error.message });
        throw error;
    }
}

async function testAmazonWebsiteExtraction() {
    console.log('🚀 Starting Amazon Website Banner Extraction Test...');
    
    try {
        const extractor = new EnhancedBannerExtractor();
        
        // Extract banners from Amazon website (no login required)
        console.log('🌐 Using headless Chrome for Amazon website extraction...');
        const result = await extractor.extractBannersFromAmazonWebsite();
        
        console.log('\n✅ Extraction Results:');
        console.log(`📊 Total Banners Extracted: ${result.extracted}`);
        console.log(`💾 Banners Stored in Firebase: ${result.stored}`);
        
        if (result.banners.length > 0) {
            console.log('\n🎯 Extracted Banners:');
            result.banners.forEach((banner, index) => {
                console.log(`\n${index + 1}. ${banner.id}`);
                console.log(`   Platform: ${banner.platform}`);
                console.log(`   Category: ${banner.category}`);
                console.log(`   Validation Score: ${banner.validationScore}`);
                console.log(`   Image URL: ${banner.url}`);
                console.log(`   Click URL: ${banner.clickRedirectUrl}`);
                console.log(`   Alt Text: ${banner.altText}`);
                console.log(`   Source URL: ${banner.sourceUrl}`);
                console.log(`   Validation Reasons: ${banner.validationReasons.join(', ')}`);
            });
        }
        
        // Get all test banners from Firebase
        console.log('\n🔥 Retrieving all test banners from Firebase...');
        const allBanners = await testBannerDB.getAllTestBanners();
        
        if (allBanners.status === 200) {
            const bannerCount = Object.keys(allBanners.data).length;
            console.log(`📈 Total banners in test-banners node: ${bannerCount}`);
            
            if (bannerCount > 0) {
                console.log('\n📋 Firebase Test Banners:');
                Object.entries(allBanners.data).forEach(([id, banner], index) => {
                    console.log(`\n${index + 1}. ${id}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   Category: ${banner.category}`);
                    console.log(`   Active: ${banner.isActive}`);
                    console.log(`   Source: ${banner.sourceUrl}`);
                    console.log(`   Created: ${banner.creationTimestamp}`);
                });
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error during Amazon website extraction test:', error.message);
        logger.error('Amazon website extraction test failed:', { error: error.message });
        throw error;
    }
}

async function testAllPlatformsExtraction() {
    console.log('🚀 Starting All Platforms Banner Extraction Test...');
    
    try {
        const extractor = new EnhancedBannerExtractor();
        
        // Extract banners from all platforms
        console.log('📱 Connecting to Chrome browser on port 9222...');
        const result = await extractor.extractAllBanners();
        
        console.log('\n✅ Extraction Results:');
        console.log(`📊 Total Banners Extracted: ${result.extracted}`);
        console.log(`💾 Banners Stored in Firebase: ${result.stored}`);
        
        if (result.banners.length > 0) {
            console.log('\n🎯 Extracted Banners by Platform:');
            const bannersByPlatform = {};
            result.banners.forEach(banner => {
                if (!bannersByPlatform[banner.platform]) {
                    bannersByPlatform[banner.platform] = [];
                }
                bannersByPlatform[banner.platform].push(banner);
            });
            
            Object.entries(bannersByPlatform).forEach(([platform, banners]) => {
                console.log(`\n📱 ${platform.toUpperCase()}: ${banners.length} banners`);
                banners.forEach((banner, index) => {
                    console.log(`   ${index + 1}. ${banner.id} (${banner.category}) - Score: ${banner.validationScore}`);
                });
            });
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error during all platforms extraction test:', error.message);
        logger.error('All platforms extraction test failed:', { error: error.message });
        throw error;
    }
}

async function clearTestBanners() {
    console.log('🧹 Clearing all test banners from Firebase...');
    
    try {
        const result = await testBannerDB.clearAllTestBanners();
        
        if (result.status === 200) {
            console.log('✅ All test banners cleared successfully');
        } else {
            console.log('❌ Failed to clear test banners:', result.message);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error clearing test banners:', error.message);
        throw error;
    }
}

async function showTestBannerStats() {
    console.log('📊 Test Banner Statistics...');
    
    try {
        const allBanners = await testBannerDB.getAllTestBanners();
        
        if (allBanners.status === 200) {
            const banners = allBanners.data;
            const bannerCount = Object.keys(banners).length;
            
            console.log(`📈 Total Test Banners: ${bannerCount}`);
            
            if (bannerCount > 0) {
                // Group by platform
                const platformStats = {};
                const categoryStats = {};
                const sourceStats = {};
                
                Object.values(banners).forEach(banner => {
                    // Platform stats
                    if (!platformStats[banner.platform]) {
                        platformStats[banner.platform] = 0;
                    }
                    platformStats[banner.platform]++;
                    
                    // Category stats
                    if (!categoryStats[banner.category]) {
                        categoryStats[banner.category] = 0;
                    }
                    categoryStats[banner.category]++;
                    
                    // Source stats
                    if (!sourceStats[banner.sourceUrl]) {
                        sourceStats[banner.sourceUrl] = 0;
                    }
                    sourceStats[banner.sourceUrl]++;
                });
                
                console.log('\n📱 Banners by Platform:');
                Object.entries(platformStats).forEach(([platform, count]) => {
                    console.log(`   ${platform}: ${count}`);
                });
                
                console.log('\n🏷️ Banners by Category:');
                Object.entries(categoryStats).forEach(([category, count]) => {
                    console.log(`   ${category}: ${count}`);
                });
                
                console.log('\n🌐 Banners by Source:');
                Object.entries(sourceStats).forEach(([source, count]) => {
                    const shortSource = source.length > 50 ? source.substring(0, 50) + '...' : source;
                    console.log(`   ${shortSource}: ${count}`);
                });
                
                // Show sample banners
                console.log('\n🎯 Sample Banners:');
                Object.entries(banners).slice(0, 3).forEach(([id, banner]) => {
                    console.log(`\n   ${id}`);
                    console.log(`     Platform: ${banner.platform}`);
                    console.log(`     Category: ${banner.category}`);
                    console.log(`     Score: ${banner.validationScore}`);
                    console.log(`     Active: ${banner.isActive}`);
                    console.log(`     Source: ${banner.sourceUrl}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error getting banner stats:', error.message);
        throw error;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'amazon';
    
    try {
        switch (command) {
            case 'amazon':
                await testAmazonAffiliateExtraction();
                break;
            case 'website':
                await testAmazonWebsiteExtraction();
                break;
            case 'all':
                await testAllPlatformsExtraction();
                break;
            case 'clear':
                await clearTestBanners();
                break;
            case 'stats':
                await showTestBannerStats();
                break;
            default:
                console.log('Usage: node testEnhancedBannerExtraction.js [amazon|website|all|clear|stats]');
                console.log('  amazon  - Extract from Amazon affiliate program (port 9222)');
                console.log('  website - Extract from Amazon website (headless, no login)');
                console.log('  all     - Extract from all platforms');
                console.log('  clear   - Clear all test banners');
                console.log('  stats   - Show banner statistics');
        }
        
        console.log('\n✨ Test completed successfully!');
        
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    testAmazonAffiliateExtraction,
    testAmazonWebsiteExtraction,
    testAllPlatformsExtraction,
    clearTestBanners,
    showTestBannerStats
};
