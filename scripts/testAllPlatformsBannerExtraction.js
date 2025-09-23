#!/usr/bin/env node

/**
 * Test Script for All Platforms Banner Extraction
 * 
 * This script tests banner extraction from all platforms (Amazon, Flipkart)
 * and outputs JSON in the required format with platform field.
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const bannerConfig = require('../config/bannerConfig');

const logger = getModuleLogger('testAllPlatformsBannerExtraction');

/**
 * Test banner extraction from all platforms
 */
async function testAllPlatformsBannerExtraction() {
    try {
        console.log('🚀 Testing Banner Extraction from All Platforms\n');
        console.log('=' .repeat(80));
        
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 50; // Remove limit to get all banners
        extractor.enableDatabase = false; // Disable database storage
        extractor.chromePort = 9222;
        
        console.log('1. Initializing Chrome browser connection...');
        await extractor.initializeDriver();
        
        const allBanners = [];
        const platforms = Object.keys(bannerConfig.platforms);
        
        console.log(`2. Testing ${platforms.length} platforms: ${platforms.join(', ')}`);
        
        for (const platformKey of platforms) {
            console.log(`\n📄 Testing Platform: ${platformKey.toUpperCase()}`);
            console.log('-' .repeat(50));
            
            try {
                const platformConfig = bannerConfig.platforms[platformKey];
                
                const platformBanners = await extractor.extractBannersFromPlatform(platformKey, platformConfig);
                allBanners.push(...platformBanners);
                
                console.log(`   Found ${platformBanners.length} banners from ${platformKey}`);
                
                if (platformBanners.length > 0) {
                    platformBanners.forEach((banner, index) => {
                        console.log(`   ${index + 1}. ${banner.title || 'Untitled Banner'}`);
                        console.log(`      ID: ${banner.id}`);
                        console.log(`      Platform: ${banner.platform}`);
                        console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
                        console.log(`      Confidence: ${banner.confidence}%`);
                        console.log(`      URL: ${banner.url?.substring(0, 80)}...`);
                        console.log(`      Click URL: ${banner.clickRedirectUrl?.substring(0, 80)}...`);
                        console.log(`      Empty Bottom: ${banner.validationReasons?.includes('empty bottom section') ? 'Yes' : 'No'}`);
                        console.log('');
                    });
                } else {
                    console.log(`   ❌ No banners found for ${platformKey}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error testing ${platformKey}: ${error.message}`);
            }
        }
        
        console.log(`\n📊 Total Results:`);
        console.log(`Found ${allBanners.length} banners total`);
        console.log(`Unique URLs: ${extractor.extractedUrls.size}`);
        
        // Group by platform
        const bannersByPlatform = {};
        allBanners.forEach(banner => {
            if (!bannersByPlatform[banner.platform]) {
                bannersByPlatform[banner.platform] = [];
            }
            bannersByPlatform[banner.platform].push(banner);
        });
        
        console.log('\n📋 Banners by Platform:');
        Object.keys(bannersByPlatform).forEach(platform => {
            console.log(`${platform}: ${bannersByPlatform[platform].length} banners`);
        });
        
        if (allBanners.length > 0) {
            // Generate JSON output in the required format
            const jsonOutput = extractor.generateJsonOutput(allBanners);
            
            console.log('\n📄 JSON Output (Required Format):');
            console.log('=' .repeat(80));
            console.log(JSON.stringify(jsonOutput, null, 2));
            console.log('=' .repeat(80));
            
            // Validate results
            console.log('\n✅ Validation Results:');
            const validBanners = allBanners.filter(b => b.confidence > 70);
            const highConfidenceBanners = allBanners.filter(b => b.confidence > 85);
            const bannersWithEmptyBottom = allBanners.filter(b => b.validationReasons?.includes('empty bottom section'));
            const productImages = allBanners.filter(b => b.validationReasons?.some(r => r.includes('product')));
            
            console.log(`Total Banners: ${allBanners.length}`);
            console.log(`Valid Banners (confidence > 70%): ${validBanners.length}`);
            console.log(`High Confidence Banners (confidence > 85%): ${highConfidenceBanners.length}`);
            console.log(`Banners with Empty Bottom: ${bannersWithEmptyBottom.length}`);
            console.log(`Product Images (should be excluded): ${productImages.length}`);
            
            // Check for specific banner types
            const heroBanners = allBanners.filter(b => b.category === 'hero');
            const promotionalBanners = allBanners.filter(b => b.category === 'promotional');
            const seasonalBanners = allBanners.filter(b => b.category === 'seasonal');
            const categoryBanners = allBanners.filter(b => b.category === 'category');
            
            console.log(`Hero Banners: ${heroBanners.length}`);
            console.log(`Promotional Banners: ${promotionalBanners.length}`);
            console.log(`Seasonal Banners: ${seasonalBanners.length}`);
            console.log(`Category Banners: ${categoryBanners.length}`);
            
            // Check for affiliate page banners
            const affiliateBanners = allBanners.filter(b => 
                b.url?.includes('INAssociates') || 
                b.url?.includes('associates') ||
                b.title?.toLowerCase().includes('associate')
            );
            
            console.log(`Affiliate Page Banners: ${affiliateBanners.length}`);
            
            if (affiliateBanners.length > 0) {
                console.log('\n🎯 Affiliate Page Banners Found:');
                affiliateBanners.forEach((banner, index) => {
                    console.log(`${index + 1}. ${banner.title || 'Untitled'}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   URL: ${banner.url}`);
                    console.log(`   Confidence: ${banner.confidence}%`);
                });
            }
            
            // Check for banners with empty bottom sections
            if (bannersWithEmptyBottom.length > 0) {
                console.log('\n⚠️ Banners with Empty Bottom Sections:');
                bannersWithEmptyBottom.forEach((banner, index) => {
                    console.log(`${index + 1}. ${banner.title || 'Untitled'}`);
                    console.log(`   Platform: ${banner.platform}`);
                    console.log(`   URL: ${banner.url}`);
                    console.log(`   Confidence: ${banner.confidence}%`);
                });
            }
            
        } else {
            console.log('❌ No banners found from any platform!');
            console.log('This might indicate:');
            console.log('- Selectors need adjustment');
            console.log('- Page structures have changed');
            console.log('- Need to login to Amazon affiliate program');
            console.log('- Chrome browser connection issues');
        }
        
        await extractor.closeDriver();
        
        return {
            success: allBanners.length > 0,
            bannerCount: allBanners.length,
            uniqueUrls: extractor.extractedUrls.size,
            bannersByPlatform,
            jsonOutput: allBanners.length > 0 ? extractor.generateJsonOutput(allBanners) : null
        };
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test specific Amazon affiliate page extraction
 */
async function testAmazonAffiliateExtraction() {
    console.log('\n🔍 Testing Amazon Affiliate Page Extraction\n');
    
    const extractor = new ImprovedBannerExtractor();
    extractor.enableDatabase = false;
    
    try {
        await extractor.initializeDriver();
        
        const testUrl = 'https://affiliate-program.amazon.in/home';
        console.log(`Testing URL: ${testUrl}`);
        
        await extractor.driver.get(testUrl);
        await extractor.driver.wait(extractor.driver.until.elementLocated(extractor.driver.By.css('body')), 10000);
        await extractor.driver.sleep(5000);
        
        // Test the specific carousel selector from your HTML
        const carouselSelector = 'li.a-carousel-card';
        console.log(`Testing carousel selector: ${carouselSelector}`);
        
        const carouselElements = await extractor.driver.findElements(extractor.driver.By.css(carouselSelector));
        console.log(`Found ${carouselElements.length} carousel elements`);
        
        if (carouselElements.length > 0) {
            for (let i = 0; i < Math.min(carouselElements.length, 5); i++) {
                try {
                    const element = carouselElements[i];
                    const links = await element.findElements(extractor.driver.By.css('a'));
                    console.log(`Element ${i + 1}: Found ${links.length} links`);
                    
                    for (let j = 0; j < links.length; j++) {
                        const link = links[j];
                        const href = await link.getAttribute('href');
                        const images = await link.findElements(extractor.driver.By.css('img'));
                        
                        if (images.length > 0) {
                            const img = images[0];
                            const src = await img.getAttribute('src');
                            const alt = await img.getAttribute('alt');
                            console.log(`  Link ${j + 1}: ${alt} - ${src?.substring(0, 80)}...`);
                        }
                    }
                } catch (error) {
                    console.log(`Error processing element ${i + 1}: ${error.message}`);
                }
            }
        }
        
        await extractor.closeDriver();
        
    } catch (error) {
        console.log(`❌ Affiliate page test failed: ${error.message}`);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🎯 All Platforms Banner Extraction Test\n');
        
        // Test 1: Amazon affiliate page specifically
        await testAmazonAffiliateExtraction();
        
        // Test 2: All platforms banner extraction
        const result = await testAllPlatformsBannerExtraction();
        
        console.log('\n📊 Test Summary:');
        console.log('=' .repeat(80));
        console.log(`Banner Extraction Test: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Total Banners Found: ${result.bannerCount || 0}`);
        console.log(`Unique URLs: ${result.uniqueUrls || 0}`);
        
        if (result.bannersByPlatform) {
            console.log('\n📋 Banners by Platform:');
            Object.keys(result.bannersByPlatform).forEach(platform => {
                console.log(`${platform}: ${result.bannersByPlatform[platform].length} banners`);
            });
        }
        
        if (result.success && result.jsonOutput) {
            console.log('\n🎉 Multi-platform banner extraction working correctly!');
            console.log('The system is now extracting banners from all platforms.');
            console.log('JSON format includes platform field and empty expiration timestamps.');
        } else {
            console.log('\n⚠️ No banners found or extraction failed.');
            console.log('Please check:');
            console.log('1. Chrome browser connection');
            console.log('2. Amazon affiliate login');
            console.log('3. Selector configuration');
            console.log('4. Platform accessibility');
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
    testAllPlatformsBannerExtraction,
    testAmazonAffiliateExtraction
};
