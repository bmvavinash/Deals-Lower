#!/usr/bin/env node

/**
 * Debug Script for Amazon Affiliate Page Extraction
 * 
 * This script specifically debugs why Amazon affiliate page banners aren't being extracted.
 */

const { getModuleLogger } = require('../logger/logger');
const { ImprovedBannerExtractor } = require('../dataSources/improvedBannerExtractor');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const logger = getModuleLogger('debugAmazonAffiliateExtraction');

/**
 * Debug Amazon affiliate page extraction
 */
async function debugAmazonAffiliateExtraction() {
    try {
        console.log('🔍 Debugging Amazon Affiliate Page Extraction\n');
        console.log('=' .repeat(70));
        
        const extractor = new ImprovedBannerExtractor();
        extractor.enableDatabase = false;
        extractor.chromePort = 9222;
        
        console.log('1. Initializing Chrome browser connection...');
        await extractor.initializeDriver();
        
        const testUrl = 'https://affiliate-program.amazon.in/home';
        console.log(`2. Testing URL: ${testUrl}`);
        
        await extractor.driver.get(testUrl);
        await extractor.driver.wait(extractor.driver.until.elementLocated(extractor.driver.By.css('body')), 15000);
        await extractor.driver.sleep(5000);
        
        console.log('3. Checking page title and content...');
        const title = await extractor.driver.getTitle();
        console.log(`   Page title: ${title}`);
        
        // Check if we're on login page
        if (title.includes('Sign in') || title.includes('Login')) {
            console.log('   ⚠️ On login page - need to login first');
            console.log('   Please login to Amazon affiliate program in Chrome browser');
            return;
        }
        
        console.log('4. Testing carousel selectors...');
        
        // Test different carousel selectors
        const carouselSelectors = [
            'li.a-carousel-card',
            'ol.a-carousel li[aria-roledescription="slide"]',
            'div.ac-carousel li[aria-roledescription="slide"]',
            'div.a-carousel-col',
            'div.a-carousel-viewport',
            'ol.a-carousel',
            'div.ac-carousel',
            '[aria-roledescription="slide"]',
            'li[aria-roledescription="slide"]'
        ];
        
        for (const selector of carouselSelectors) {
            try {
                const elements = await extractor.driver.findElements(extractor.driver.By.css(selector));
                console.log(`   Selector "${selector}": Found ${elements.length} elements`);
                
                if (elements.length > 0) {
                    // Check first few elements for images
                    for (let i = 0; i < Math.min(elements.length, 3); i++) {
                        try {
                            const element = elements[i];
                            const images = await element.findElements(extractor.driver.By.css('img'));
                            console.log(`     Element ${i + 1}: Found ${images.length} images`);
                            
                            if (images.length > 0) {
                                const img = images[0];
                                const src = await img.getAttribute('src');
                                const alt = await img.getAttribute('alt');
                                console.log(`       Image: ${alt} - ${src?.substring(0, 80)}...`);
                            }
                        } catch (error) {
                            console.log(`     Error processing element ${i + 1}: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`   Error with selector "${selector}": ${error.message}`);
            }
        }
        
        console.log('\n5. Testing banner link selectors...');
        
        // Test banner link selectors
        const linkSelectors = [
            'a[target="_blank"]',
            'a[href*="amazon.in"]',
            'a[href*="/events/"]',
            'a[href*="/b?"]',
            'a[href*="/l/"]',
            'a[href*="/dp/"]'
        ];
        
        for (const selector of linkSelectors) {
            try {
                const elements = await extractor.driver.findElements(extractor.driver.By.css(selector));
                console.log(`   Selector "${selector}": Found ${elements.length} links`);
                
                if (elements.length > 0) {
                    // Check first few links
                    for (let i = 0; i < Math.min(elements.length, 3); i++) {
                        try {
                            const element = elements[i];
                            const href = await element.getAttribute('href');
                            const images = await element.findElements(extractor.driver.By.css('img'));
                            console.log(`     Link ${i + 1}: ${href?.substring(0, 80)}... (${images.length} images)`);
                        } catch (error) {
                            console.log(`     Error processing link ${i + 1}: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`   Error with selector "${selector}": ${error.message}`);
            }
        }
        
        console.log('\n6. Testing banner image selectors...');
        
        // Test banner image selectors
        const imageSelectors = [
            'img[border="0"]',
            'img[align="center"]',
            'img[src*="media-amazon.com"]',
            'img[src*="INAssociates"]',
            'img[src*="Associates"]',
            'img[alt*="Great Freedom"]',
            'img[alt*="Festival"]',
            'img[alt*="Autumn-Winter"]',
            'img[alt*="Ethnic Week"]'
        ];
        
        for (const selector of imageSelectors) {
            try {
                const elements = await extractor.driver.findElements(extractor.driver.By.css(selector));
                console.log(`   Selector "${selector}": Found ${elements.length} images`);
                
                if (elements.length > 0) {
                    // Check first few images
                    for (let i = 0; i < Math.min(elements.length, 3); i++) {
                        try {
                            const element = elements[i];
                            const src = await element.getAttribute('src');
                            const alt = await element.getAttribute('alt');
                            console.log(`     Image ${i + 1}: ${alt} - ${src?.substring(0, 80)}...`);
                        } catch (error) {
                            console.log(`     Error processing image ${i + 1}: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`   Error with selector "${selector}": ${error.message}`);
            }
        }
        
        console.log('\n7. Testing full banner extraction...');
        
        // Try to extract banners using the current configuration
        const amazonConfig = {
            name: 'Amazon',
            bannerUrls: [testUrl],
            selectors: {
                carousel: 'li.a-carousel-card, ol.a-carousel li[aria-roledescription="slide"], div.ac-carousel li[aria-roledescription="slide"]',
                bannerLink: 'a[target="_blank"], a[href*="amazon.in"], a[href*="amazon.com"]',
                bannerImage: 'img[border="0"], img[src*="media-amazon.com"], img[align="center"]',
                bannerAlt: 'img[alt]',
                alternativeCarousel: 'div[class*="bxcGridImage"], div[class*="bxcGridContent"], div[class*="celWidget"]',
                alternativeBannerLink: 'a[href*="amazon.in"], a[href*="amazon.com"]',
                alternativeBannerImage: 'img[src*="amazon.com"], img[src*="media-amazon.com"]',
                affiliateCarousel: 'li.a-carousel-card, ol.a-carousel li[aria-roledescription="slide"], div.ac-carousel li[aria-roledescription="slide"]',
                affiliateBannerLink: 'a[target="_blank"], a[href*="amazon.in"], a[href*="amazon.com"]',
                affiliateBannerImage: 'img[border="0"], img[src*="media-amazon.com"], img[align="center"]',
                promoElements: 'div[class*="promo"], div[class*="hero"], div[class*="featured"], section[class*="banner"], div[class*="bxcGridImage"]'
            },
            validation: {
                minImageWidth: 600,
                minImageHeight: 300,
                allowedDomains: ['media-amazon.com', 'amazon.com', 'images-eu.ssl-images-amazon.com'],
                excludedKeywords: [
                    'associate', 'commission', 'affiliate', 'whatsapp', 'telegram',
                    'product', 'item', 'goods', 'merchandise', 'inventory',
                    'add to cart', 'buy now', 'shop now', 'view details',
                    'price', 'discount', 'offer', 'deal', 'reviews', 'ratings',
                    'samsung', 'mi', 'tv', 'mobile', 'phone'
                ],
                bannerKeywords: [
                    'central header', 'great indian festival', 'early deals', 'live now',
                    'festival', 'sale', 'banner', 'promo', 'event', 'deal'
                ]
            }
        };
        
        const banners = await extractor.extractBannersFromPlatform('amazon', amazonConfig);
        
        console.log(`\n8. Extraction Results:`);
        console.log(`   Found ${banners.length} banners`);
        
        if (banners.length > 0) {
            banners.forEach((banner, index) => {
                console.log(`   ${index + 1}. ${banner.title || 'Untitled Banner'}`);
                console.log(`      ID: ${banner.id}`);
                console.log(`      Category: ${banner.category} (Priority: ${banner.priority})`);
                console.log(`      Confidence: ${banner.confidence}%`);
                console.log(`      URL: ${banner.url?.substring(0, 80)}...`);
                console.log(`      Click URL: ${banner.clickRedirectUrl?.substring(0, 80)}...`);
                console.log('');
            });
        } else {
            console.log('   ❌ No banners found!');
            console.log('   Possible issues:');
            console.log('   - Need to login to Amazon affiliate program');
            console.log('   - Selectors need adjustment');
            console.log('   - Page structure has changed');
        }
        
        await extractor.closeDriver();
        
        return {
            success: banners.length > 0,
            bannerCount: banners.length,
            banners: banners
        };
        
    } catch (error) {
        console.log(`❌ Debug failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🎯 Amazon Affiliate Page Debug\n');
        
        const result = await debugAmazonAffiliateExtraction();
        
        console.log('\n📊 Debug Summary:');
        console.log('=' .repeat(70));
        console.log(`Debug Test: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Banners Found: ${result.bannerCount || 0}`);
        
        if (result.success && result.banners) {
            console.log('\n🎉 Amazon affiliate page extraction working!');
            console.log('The system is now extracting banners from the affiliate page.');
        } else {
            console.log('\n⚠️ Amazon affiliate page extraction not working.');
            console.log('Please check:');
            console.log('1. Login to Amazon affiliate program in Chrome browser');
            console.log('2. Verify selectors are correct');
            console.log('3. Check if page structure has changed');
        }
        
    } catch (error) {
        console.error('❌ Debug execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    debugAmazonAffiliateExtraction
};
