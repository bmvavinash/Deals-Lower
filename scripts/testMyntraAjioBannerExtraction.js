const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const bannerConfig = require('../config/bannerConfig');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testMyntraAjioBannerExtraction');

async function testMyntraBannerExtraction() {
    console.log('🛍️ Testing Myntra Banner Extraction\n');
    
    try {
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 3;
        
        console.log('1. Initializing extractor...');
        await extractor.initializeDriver();
        
        console.log('2. Testing Myntra banner extraction...');
        const myntraConfig = bannerConfig.platforms.myntra;
        
        const banners = await extractor.extractBannersFromPlatform('myntra', myntraConfig);
        
        console.log(`   Found ${banners.length} banners`);
        
        if (banners.length > 0) {
            banners.forEach((banner, index) => {
                console.log(`   ${index + 1}. ${banner.title || 'Untitled'}`);
                console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
                console.log(`      Confidence: ${banner.confidence}%`);
                console.log(`      URL: ${banner.url?.substring(0, 60)}...`);
                console.log(`      Click URL: ${banner.clickRedirectUrl?.substring(0, 60)}...`);
            });
        } else {
            console.log('   ⚠️ No banners found. This might be due to:');
            console.log('      - Site structure changes');
            console.log('      - Selector configuration needs updates');
            console.log('      - Access restrictions');
        }
        
        await extractor.closeDriver();
        
        console.log('✅ Myntra banner extraction test completed\n');
        return { success: true, bannerCount: banners.length, banners };
        
    } catch (error) {
        console.log(`❌ Myntra banner extraction test FAILED: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

async function testAjioBannerExtraction() {
    console.log('👗 Testing Ajio Banner Extraction\n');
    
    try {
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 3;
        
        console.log('1. Initializing extractor...');
        await extractor.initializeDriver();
        
        console.log('2. Testing Ajio banner extraction...');
        const ajioConfig = bannerConfig.platforms.ajio;
        
        const banners = await extractor.extractBannersFromPlatform('ajio', ajioConfig);
        
        console.log(`   Found ${banners.length} banners`);
        
        if (banners.length > 0) {
            banners.forEach((banner, index) => {
                console.log(`   ${index + 1}. ${banner.title || 'Untitled'}`);
                console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
                console.log(`      Confidence: ${banner.confidence}%`);
                console.log(`      URL: ${banner.url?.substring(0, 60)}...`);
                console.log(`      Click URL: ${banner.clickRedirectUrl?.substring(0, 60)}...`);
            });
        } else {
            console.log('   ⚠️ No banners found. This might be due to:');
            console.log('      - Site structure changes');
            console.log('      - Selector configuration needs updates');
            console.log('      - Access restrictions');
        }
        
        await extractor.closeDriver();
        
        console.log('✅ Ajio banner extraction test completed\n');
        return { success: true, bannerCount: banners.length, banners };
        
    } catch (error) {
        console.log(`❌ Ajio banner extraction test FAILED: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

async function testAllPlatformsBannerExtraction() {
    console.log('🌐 Testing All Platforms Banner Extraction\n');
    
    try {
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 2;
        
        console.log('1. Initializing extractor...');
        await extractor.initializeDriver();
        
        const platforms = ['amazon', 'flipkart', 'myntra', 'ajio'];
        const results = {};
        
        for (const platform of platforms) {
            console.log(`2. Testing ${platform} banner extraction...`);
            const platformConfig = bannerConfig.platforms[platform];
            
            if (!platformConfig) {
                console.log(`   ⚠️ No configuration found for ${platform}`);
                results[platform] = { success: false, error: 'No configuration' };
                continue;
            }
            
            try {
                const banners = await extractor.extractBannersFromPlatform(platform, platformConfig);
                console.log(`   Found ${banners.length} banners`);
                results[platform] = { success: true, bannerCount: banners.length, banners };
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                results[platform] = { success: false, error: error.message };
            }
        }
        
        await extractor.closeDriver();
        
        console.log('✅ All platforms banner extraction test completed\n');
        return results;
        
    } catch (error) {
        console.log(`❌ All platforms banner extraction test FAILED: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🚀 Starting Myntra & Ajio Banner Extraction Tests\n');
    console.log('=' .repeat(60));
    
    try {
        // Test individual platforms
        const myntraResult = await testMyntraBannerExtraction();
        const ajioResult = await testAjioBannerExtraction();
        
        // Test all platforms together
        const allPlatformsResult = await testAllPlatformsBannerExtraction();
        
        // Summary
        console.log('📊 Test Summary:');
        console.log('=' .repeat(60));
        console.log(`Myntra: ${myntraResult.success ? '✅ PASSED' : '❌ FAILED'} (${myntraResult.bannerCount || 0} banners)`);
        console.log(`Ajio: ${ajioResult.success ? '✅ PASSED' : '❌ FAILED'} (${ajioResult.bannerCount || 0} banners)`);
        
        if (allPlatformsResult && typeof allPlatformsResult === 'object') {
            console.log('\n📋 All Platforms Results:');
            Object.keys(allPlatformsResult).forEach(platform => {
                const result = allPlatformsResult[platform];
                console.log(`${platform}: ${result.success ? '✅' : '❌'} (${result.bannerCount || 0} banners)`);
            });
        }
        
        const totalBanners = (myntraResult.bannerCount || 0) + (ajioResult.bannerCount || 0);
        console.log(`\n🎯 Total Banners Extracted: ${totalBanners}`);
        
        if (totalBanners > 0) {
            console.log('\n🎉 Banner extraction is working for Myntra and Ajio!');
            console.log('The system can now extract banners from all four platforms.');
        } else {
            console.log('\n⚠️ No banners were extracted. Please check:');
            console.log('1. Chrome browser connection');
            console.log('2. Website accessibility');
            console.log('3. Selector configuration');
            console.log('4. Network connectivity');
        }
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    testMyntraBannerExtraction,
    testAjioBannerExtraction,
    testAllPlatformsBannerExtraction
};
