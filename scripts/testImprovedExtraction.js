const { EnhancedBannerExtractor } = require('../dataSources/enhancedBannerExtractor');
const { testBannerDB } = require('../database/firebaseDB/testBannerDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testImprovedExtraction');

async function testImprovedAmazonAffiliateExtraction() {
    console.log('🚀 Testing Improved Amazon Affiliate Banner Extraction...');
    
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
                    console.log(`   Score: ${banner.validationScore}`);
                    console.log(`   Created: ${banner.creationTimestamp}`);
                });
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error during improved banner extraction test:', error.message);
        logger.error('Improved banner extraction test failed:', { error: error.message });
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    testImprovedAmazonAffiliateExtraction();
}

module.exports = { testImprovedAmazonAffiliateExtraction };
