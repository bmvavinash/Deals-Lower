#!/usr/bin/env node

/**
 * Test Script for Amazon Banner Extraction
 * 
 * This script specifically tests Amazon banner extraction using the correct selectors
 * and validates that we're getting actual promotional banners, not product images.
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const bannerConfig = require('../config/bannerConfig');

const logger = getModuleLogger('testAmazonBannerExtraction');

/**
 * Test Amazon banner extraction with improved selectors
 */
async function testAmazonBannerExtraction() {
    try {
        console.log('🚀 Testing Amazon Banner Extraction with Improved Selectors\n');
        console.log('=' .repeat(70));
        
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 10; // Limit for testing
        extractor.enableDatabase = false; // Disable database storage
        extractor.chromePort = 9222;
        
        console.log('1. Initializing Chrome browser connection...');
        await extractor.initializeDriver();
        
        console.log('2. Testing Amazon banner extraction with improved selectors...');
        const amazonConfig = bannerConfig.platforms.amazon;
        
        // Test each URL individually
        const testUrls = [
            'https://www.amazon.in/deals',
            'https://www.amazon.in/gp/goldbox',
            'https://affiliate-program.amazon.in/home'
        ];
        
        const allBanners = [];
        
        for (const url of testUrls) {
            console.log(`\n📄 Testing URL: ${url}`);
            
            try {
                await extractor.driver.get(url);
                await extractor.driver.wait(extractor.driver.until.elementLocated(extractor.driver.By.css('body')), 10000);
                await extractor.driver.sleep(3000); // Wait for dynamic content
                
                const urlBanners = await extractor.extractBannersFromUrl('amazon', amazonConfig.selectors, amazonConfig.validation, url);
                allBanners.push(...urlBanners);
                
                console.log(`   Found ${urlBanners.length} banners from ${url}`);
                
                if (urlBanners.length > 0) {
                    urlBanners.forEach((banner, index) => {
                        console.log(`   ${index + 1}. ${banner.title || 'Untitled Banner'}`);
                        console.log(`      ID: ${banner.id}`);
                        console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
                        console.log(`      Confidence: ${banner.confidence}%`);
                        console.log(`      URL: ${banner.url?.substring(0, 80)}...`);
                        console.log(`      Click URL: ${banner.clickRedirectUrl?.substring(0, 80)}...`);
                        console.log(`      Empty Bottom: ${banner.validationReasons?.includes('empty bottom section') ? 'Yes' : 'No'}`);
                        console.log('');
                    });
                }
                
            } catch (error) {
                console.log(`   ❌ Error testing ${url}: ${error.message}`);
            }
        }
        
        console.log(`\n📊 Total Results:`);
        console.log(`Found ${allBanners.length} banners total`);
        console.log(`Unique URLs: ${extractor.extractedUrls.size}`);
        
        if (allBanners.length > 0) {
            // Generate JSON output in the required format
            const jsonOutput = extractor.generateJsonOutput(allBanners);
            
            console.log('\n📄 JSON Output (Required Format):');
            console.log('=' .repeat(70));
            console.log(JSON.stringify(jsonOutput, null, 2));
            console.log('=' .repeat(70));
            
            // Validate results
            console.log('\n✅ Validation Results:');
            const validBanners = allBanners.filter(b => b.confidence > 70);
            const highConfidenceBanners = allBanners.filter(b => b.confidence > 85);
            const bannersWithEmptyBottom = allBanners.filter(b => b.validationReasons?.includes('empty bottom section'));
            
            console.log(`Total Banners: ${allBanners.length}`);
            console.log(`Valid Banners (confidence > 70%): ${validBanners.length}`);
            console.log(`High Confidence Banners (confidence > 85%): ${highConfidenceBanners.length}`);
            console.log(`Banners with Empty Bottom: ${bannersWithEmptyBottom.length}`);
            
            // Check for specific banner types
            const heroBanners = allBanners.filter(b => b.category === 'hero');
            const promotionalBanners = allBanners.filter(b => b.category === 'promotional');
            const seasonalBanners = allBanners.filter(b => b.category === 'seasonal');
            
            console.log(`Hero Banners: ${heroBanners.length}`);
            console.log(`Promotional Banners: ${promotionalBanners.length}`);
            console.log(`Seasonal Banners: ${seasonalBanners.length}`);
            
            // Check for the specific banner you mentioned
            const centralHeaderBanners = allBanners.filter(b => 
                b.title?.toLowerCase().includes('central header') || 
                b.url?.includes('central') ||
                b.url?.includes('header')
            );
            
            console.log(`Central Header Banners: ${centralHeaderBanners.length}`);
            
            if (centralHeaderBanners.length > 0) {
                console.log('\n🎯 Central Header Banners Found:');
                centralHeaderBanners.forEach((banner, index) => {
                    console.log(`${index + 1}. ${banner.title || 'Untitled'}`);
                    console.log(`   URL: ${banner.url}`);
                    console.log(`   Confidence: ${banner.confidence}%`);
                });
            }
            
        } else {
            console.log('❌ No banners found!');
            console.log('This might indicate:');
            console.log('- Selectors need adjustment');
            console.log('- Page structure has changed');
            console.log('- Need to login to Amazon affiliate program');
        }
        
        await extractor.closeDriver();
        
        return {
            success: allBanners.length > 0,
            bannerCount: allBanners.length,
            uniqueUrls: extractor.extractedUrls.size,
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
 * Test specific selectors
 */
async function testSpecificSelectors() {
    console.log('\n🔍 Testing Specific Selectors\n');
    
    const extractor = new ImprovedBannerExtractor();
    extractor.enableDatabase = false;
    
    try {
        await extractor.initializeDriver();
        
        // Test the specific selector from your HTML example
        const testUrl = 'https://www.amazon.in/deals';
        console.log(`Testing URL: ${testUrl}`);
        
        await extractor.driver.get(testUrl);
        await extractor.driver.wait(extractor.driver.until.elementLocated(extractor.driver.By.css('body')), 10000);
        await extractor.driver.sleep(5000);
        
        // Test the specific selector from your HTML
        const specificSelector = 'div._Y29ud_acsUxWidgetDesktop_veWWI';
        console.log(`Testing selector: ${specificSelector}`);
        
        const elements = await extractor.driver.findElements(extractor.driver.By.css(specificSelector));
        console.log(`Found ${elements.length} elements with specific selector`);
        
        if (elements.length > 0) {
            for (let i = 0; i < elements.length; i++) {
                try {
                    const element = elements[i];
                    const images = await element.findElements(extractor.driver.By.css('img'));
                    console.log(`Element ${i + 1}: Found ${images.length} images`);
                    
                    for (let j = 0; j < images.length; j++) {
                        const img = images[j];
                        const src = await img.getAttribute('src');
                        const alt = await img.getAttribute('alt');
                        console.log(`  Image ${j + 1}: ${alt} - ${src?.substring(0, 80)}...`);
                    }
                } catch (error) {
                    console.log(`Error processing element ${i + 1}: ${error.message}`);
                }
            }
        }
        
        await extractor.closeDriver();
        
    } catch (error) {
        console.log(`❌ Selector test failed: ${error.message}`);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🎯 Amazon Banner Extraction Test\n');
        
        // Test 1: Specific selectors
        await testSpecificSelectors();
        
        // Test 2: Full banner extraction
        const result = await testAmazonBannerExtraction();
        
        console.log('\n📊 Test Summary:');
        console.log('=' .repeat(70));
        console.log(`Banner Extraction Test: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Banners Found: ${result.bannerCount || 0}`);
        console.log(`Unique URLs: ${result.uniqueUrls || 0}`);
        
        if (result.success && result.jsonOutput) {
            console.log('\n🎉 Amazon banner extraction working correctly!');
            console.log('The system is now extracting actual promotional banners.');
        } else {
            console.log('\n⚠️ No banners found or extraction failed.');
            console.log('Please check:');
            console.log('1. Chrome browser connection');
            console.log('2. Amazon affiliate login');
            console.log('3. Selector configuration');
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
    testAmazonBannerExtraction,
    testSpecificSelectors
};
