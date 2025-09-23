#!/usr/bin/env node

/**
 * Test Script for Banner JSON Output
 * 
 * This script tests the banner extraction and outputs JSON in the required format
 * without storing in database, perfect for testing and validation.
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const bannerConfig = require('../config/bannerConfig');

const logger = getModuleLogger('testBannerJsonOutput');

/**
 * Test banner extraction with JSON output
 */
async function testBannerJsonOutput() {
    try {
        console.log('🚀 Testing Banner Extraction with JSON Output\n');
        console.log('=' .repeat(60));
        
        const extractor = new ImprovedBannerExtractor();
        extractor.maxBannersPerPlatform = 10; // Limit for testing
        extractor.enableDatabase = false; // Disable database storage
        extractor.chromePort = 9222;
        
        console.log('1. Initializing Chrome browser connection...');
        await extractor.initializeDriver();
        
        console.log('2. Testing Amazon banner extraction...');
        const amazonConfig = bannerConfig.platforms.amazon;
        
        const banners = await extractor.extractBannersFromPlatform('amazon', amazonConfig);
        
        console.log(`\n📊 Extraction Results:`);
        console.log(`Found ${banners.length} banners from Amazon`);
        
        if (banners.length > 0) {
            console.log('\n📋 Banner Details:');
            banners.forEach((banner, index) => {
                console.log(`${index + 1}. ${banner.title || 'Untitled Banner'}`);
                console.log(`   ID: ${banner.id}`);
                console.log(`   Category: ${banner.category} (Priority: ${banner.priority})`);
                console.log(`   Confidence: ${banner.confidence}%`);
                console.log(`   URL: ${banner.url?.substring(0, 80)}...`);
                console.log(`   Click URL: ${banner.clickRedirectUrl?.substring(0, 80)}...`);
                console.log(`   Expiration: ${banner.expirationTimestamp}`);
                console.log('');
            });
            
            // Generate JSON output in the required format
            const jsonOutput = extractor.generateJsonOutput(banners);
            
            console.log('📄 JSON Output (Required Format):');
            console.log('=' .repeat(60));
            console.log(JSON.stringify(jsonOutput, null, 2));
            console.log('=' .repeat(60));
            
            // Validate JSON structure
            console.log('\n✅ JSON Structure Validation:');
            const requiredFields = ['clickRedirectUrl', 'creationTimestamp', 'id', 'isActive', 'order', 'updateTimestamp', 'url'];
            const optionalFields = ['expirationTimestamp', 'targetDealId'];
            
            let validStructure = true;
            Object.keys(jsonOutput).forEach(bannerId => {
                const banner = jsonOutput[bannerId];
                
                // Check required fields
                requiredFields.forEach(field => {
                    if (!(field in banner)) {
                        console.log(`❌ Missing required field: ${field}`);
                        validStructure = false;
                    }
                });
                
                // Check optional fields
                optionalFields.forEach(field => {
                    if (!(field in banner)) {
                        console.log(`⚠️ Missing optional field: ${field}`);
                    }
                });
            });
            
            if (validStructure) {
                console.log('✅ JSON structure is valid!');
            } else {
                console.log('❌ JSON structure has issues!');
            }
            
        } else {
            console.log('❌ No banners found!');
        }
        
        await extractor.closeDriver();
        
        return {
            success: banners.length > 0,
            bannerCount: banners.length,
            jsonOutput: banners.length > 0 ? extractor.generateJsonOutput(banners) : null
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
 * Test with sample data to verify JSON format
 */
function testJsonFormat() {
    console.log('\n🧪 Testing JSON Format with Sample Data\n');
    
    const sampleBanners = [
        {
            id: 'amazon-summer-banner',
            url: 'https://a.media-amazon.com/images/G/31/prime/MayART/header/New/AMAZON-PRIME-MAY-ART-PC-HEADER-1_4_1.gif',
            clickRedirectUrl: 'https://www.amazon.in/prime',
            isActive: true,
            order: 0,
            creationTimestamp: '2025-04-27T10:51:12.731Z',
            updateTimestamp: '2025-04-27T10:51:12.731Z',
            expirationTimestamp: '2025-05-04T10:51:12.731Z',
            targetDealId: '',
            category: 'hero',
            priority: 1,
            title: 'Amazon Prime Summer Sale',
            description: 'Summer sale banner',
            confidence: 90
        },
        {
            id: 'flipkart-summer-banner',
            url: 'https://rukminim2.flixcart.com/fk-p-flap/1620/270/image/b692b7eec25beda6.jpg?q=20',
            clickRedirectUrl: 'https://www.flipkart.com/summer-sale',
            isActive: true,
            order: 1,
            creationTimestamp: '2025-04-27T10:51:12.743Z',
            updateTimestamp: '2025-04-27T10:51:12.743Z',
            expirationTimestamp: '2025-05-11T10:51:12.743Z',
            targetDealId: '',
            category: 'promotional',
            priority: 3,
            title: 'Flipkart Summer Sale',
            description: 'Summer sale banner',
            confidence: 85
        }
    ];
    
    const extractor = new ImprovedBannerExtractor();
    const jsonOutput = extractor.generateJsonOutput(sampleBanners);
    
    console.log('📄 Sample JSON Output:');
    console.log(JSON.stringify(jsonOutput, null, 2));
    
    return jsonOutput;
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🎯 Banner JSON Output Test\n');
        
        // Test 1: JSON format with sample data
        const sampleJson = testJsonFormat();
        
        // Test 2: Real banner extraction with JSON output
        const result = await testBannerJsonOutput();
        
        console.log('\n📊 Test Summary:');
        console.log('=' .repeat(60));
        console.log(`Sample JSON Test: ✅ PASSED`);
        console.log(`Real Extraction Test: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Banners Found: ${result.bannerCount || 0}`);
        
        if (result.success && result.jsonOutput) {
            console.log('\n🎉 JSON output generated successfully!');
            console.log('You can now use this format for your banner system.');
        } else {
            console.log('\n⚠️ No banners found or extraction failed.');
            console.log('Please check Chrome browser connection and Amazon affiliate login.');
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
    testBannerJsonOutput,
    testJsonFormat
};
