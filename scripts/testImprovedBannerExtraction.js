#!/usr/bin/env node

/**
 * Test Script for Improved Banner Extraction
 * 
 * This script tests the improved banner extraction system to ensure
 * it correctly identifies banners and excludes product images.
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerValidator } = require('../utils/improvedBannerValidator');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');

const logger = getModuleLogger('testImprovedBannerExtraction');

/**
 * Test banner validation with sample data
 */
function testBannerValidation() {
    console.log('🧪 Testing Banner Validation System\n');
    
    const validator = new ImprovedBannerValidator();
    
    // Test cases for banner validation
    const testCases = [
        {
            name: 'Valid Promotional Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/great-freedom-sale-banner.jpg',
                altText: 'Great Freedom Sale - Up to 70% off on Electronics',
                title: 'Great Freedom Sale',
                clickUrl: 'https://www.amazon.in/deals'
            },
            expectedValid: true
        },
        {
            name: 'Product Image (Should be excluded)',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/products/iphone-15-pro.jpg',
                altText: 'iPhone 15 Pro - Add to Cart - Price: ₹1,29,900',
                title: 'iPhone 15 Pro',
                clickUrl: 'https://www.amazon.in/dp/B0CHX1W1XY'
            },
            expectedValid: false
        },
        {
            name: 'Affiliate Commission Content (Should be excluded)',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/affiliate/commission-banner.jpg',
                altText: 'Join Amazon Associate Program - Earn 4% Commission',
                title: 'Amazon Associate Program',
                clickUrl: 'https://affiliate-program.amazon.in/home'
            },
            expectedValid: false
        },
        {
            name: 'Icon/Logo (Should be excluded)',
            bannerData: {
                imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                altText: 'Amazon Logo',
                title: 'Amazon',
                clickUrl: 'https://www.amazon.in'
            },
            expectedValid: false
        },
        {
            name: 'Seasonal Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/diwali-sale-banner.jpg',
                altText: 'Diwali Sale - Festival Special Offers',
                title: 'Diwali Sale',
                clickUrl: 'https://www.amazon.in/diwali-sale'
            },
            expectedValid: true
        },
        {
            name: 'Hero Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/hero-banner.jpg',
                altText: 'Featured Deal - Limited Time Offer',
                title: 'Featured Deal',
                clickUrl: 'https://www.amazon.in/featured-deals'
            },
            expectedValid: true
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. Testing: ${testCase.name}`);
        
        const validation = validator.validateBanner(testCase.bannerData);
        const passed = validation.isValid === testCase.expectedValid;
        
        console.log(`   Expected: ${testCase.expectedValid ? 'Valid' : 'Invalid'}`);
        console.log(`   Actual: ${validation.isValid ? 'Valid' : 'Invalid'}`);
        console.log(`   Confidence: ${validation.confidence}%`);
        console.log(`   Category: ${validation.category || 'N/A'}`);
        
        if (validation.reasons.length > 0) {
            console.log(`   Reasons: ${validation.reasons.join(', ')}`);
        }
        
        if (passed) {
            console.log(`   ✅ PASSED\n`);
            passedTests++;
        } else {
            console.log(`   ❌ FAILED\n`);
        }
    });
    
    console.log(`📊 Validation Test Results: ${passedTests}/${totalTests} tests passed`);
    return passedTests === totalTests;
}

/**
 * Test banner categorization
 */
function testBannerCategorization() {
    console.log('🏷️ Testing Banner Categorization System\n');
    
    const validator = new ImprovedBannerValidator();
    
    const testCases = [
        {
            name: 'Hero Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/hero-banner.jpg',
                altText: 'Featured Deal - Main Banner',
                title: 'Featured Deal'
            },
            expectedCategory: 'hero',
            expectedPriority: 1
        },
        {
            name: 'Seasonal Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/christmas-banner.jpg',
                altText: 'Christmas Sale - Holiday Special',
                title: 'Christmas Sale'
            },
            expectedCategory: 'seasonal',
            expectedPriority: 2
        },
        {
            name: 'Promotional Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/sale-banner.jpg',
                altText: 'Flash Sale - Up to 50% off',
                title: 'Flash Sale'
            },
            expectedCategory: 'promotional',
            expectedPriority: 3
        },
        {
            name: 'Category Banner',
            bannerData: {
                imageUrl: 'https://media-amazon.com/images/banners/electronics-banner.jpg',
                altText: 'Electronics Category',
                title: 'Electronics'
            },
            expectedCategory: 'category',
            expectedPriority: 4
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. Testing: ${testCase.name}`);
        
        const category = validator.getBannerCategory(testCase.bannerData);
        const passed = category.category === testCase.expectedCategory && 
                     category.priority === testCase.expectedPriority;
        
        console.log(`   Expected: ${testCase.expectedCategory} (Priority: ${testCase.expectedPriority})`);
        console.log(`   Actual: ${category.category} (Priority: ${category.priority})`);
        
        if (passed) {
            console.log(`   ✅ PASSED\n`);
            passedTests++;
        } else {
            console.log(`   ❌ FAILED\n`);
        }
    });
    
    console.log(`📊 Categorization Test Results: ${passedTests}/${totalTests} tests passed`);
    return passedTests === totalTests;
}

/**
 * Test Chrome connection
 */
async function testChromeConnection() {
    console.log('🌐 Testing Chrome Browser Connection\n');
    
    try {
        const extractor = new ImprovedBannerExtractor();
        
        console.log('1. Testing Chrome connection on port 9222...');
        await extractor.initializeDriver();
        
        console.log('2. Testing navigation...');
        await extractor.driver.get('https://www.google.com');
        const title = await extractor.driver.getTitle();
        
        console.log(`   Page title: ${title}`);
        
        await extractor.closeDriver();
        
        console.log('✅ Chrome connection test PASSED\n');
        return true;
        
    } catch (error) {
        console.log(`❌ Chrome connection test FAILED: ${error.message}\n`);
        return false;
    }
}

/**
 * Test banner extraction (dry run)
 */
async function testBannerExtraction() {
    console.log('🔍 Testing Banner Extraction (Dry Run)\n');
    
    try {
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 2; // Limit for testing
        
        console.log('1. Initializing extractor...');
        await extractor.initializeDriver();
        
        console.log('2. Testing Amazon banner extraction...');
        const amazonConfig = {
            name: 'Amazon',
            bannerUrls: ['https://www.amazon.in'],
            selectors: {
                carousel: 'li.a-carousel-card, div.a-carousel-card',
                bannerImage: 'img[src*="media-amazon.com"], img[src*="amazon.com"]',
                bannerLink: 'a[href*="/"]'
            },
            validation: {
                minImageWidth: 400,
                minImageHeight: 200,
                excludedKeywords: ['product', 'item', 'commission', 'affiliate']
            }
        };
        
        const banners = await extractor.extractBannersFromPlatform('amazon', amazonConfig);
        
        console.log(`   Found ${banners.length} banners`);
        
        banners.forEach((banner, index) => {
            console.log(`   ${index + 1}. ${banner.title || 'Untitled'}`);
            console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
            console.log(`      Confidence: ${banner.confidence}%`);
            console.log(`      URL: ${banner.url?.substring(0, 60)}...`);
        });
        
        await extractor.closeDriver();
        
        console.log('✅ Banner extraction test PASSED\n');
        return true;
        
    } catch (error) {
        console.log(`❌ Banner extraction test FAILED: ${error.message}\n`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 Starting Improved Banner Extraction Tests\n');
    console.log('=' .repeat(50));
    
    const results = {
        validation: false,
        categorization: false,
        chromeConnection: false,
        bannerExtraction: false
    };
    
    try {
        // Test 1: Banner Validation
        results.validation = testBannerValidation();
        
        // Test 2: Banner Categorization
        results.categorization = testBannerCategorization();
        
        // Test 3: Chrome Connection
        results.chromeConnection = await testChromeConnection();
        
        // Test 4: Banner Extraction (only if Chrome connection works)
        if (results.chromeConnection) {
            results.bannerExtraction = await testBannerExtraction();
        } else {
            console.log('⏭️ Skipping banner extraction test (Chrome connection failed)\n');
        }
        
    } catch (error) {
        console.log(`❌ Test execution failed: ${error.message}\n`);
    }
    
    // Summary
    console.log('📊 Test Summary');
    console.log('=' .repeat(50));
    console.log(`Banner Validation: ${results.validation ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Banner Categorization: ${results.categorization ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Chrome Connection: ${results.chromeConnection ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Banner Extraction: ${results.bannerExtraction ? '✅ PASSED' : '❌ FAILED'}`);
    
    const totalPassed = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\nOverall Result: ${totalPassed}/${totalTests} tests passed`);
    
    if (totalPassed === totalTests) {
        console.log('🎉 All tests passed! The improved banner extraction system is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please check the issues above.');
    }
    
    return totalPassed === totalTests;
}

/**
 * Main function
 */
async function main() {
    try {
        const success = await runAllTests();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    testBannerValidation,
    testBannerCategorization,
    testChromeConnection,
    testBannerExtraction,
    runAllTests
};
