const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('debugBannerExtraction');

async function debugAmazonAffiliatePage() {
    console.log('🔍 Debugging Amazon Affiliate Page...');
    
    let driver = null;
    
    try {
        // Connect to existing Chrome browser on port 9222
        const options = new chrome.Options();
        options.addArguments('--remote-debugging-port=9222');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');
        
        // Connect to existing Chrome instance
        options.debuggerAddress('localhost:9222');

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        console.log('✅ Connected to Chrome browser on port 9222');
        
        // Navigate to affiliate page
        const affiliateUrl = 'https://affiliate-program.amazon.in/home';
        console.log(`🌐 Navigating to: ${affiliateUrl}`);
        
        await driver.get(affiliateUrl);
        await driver.wait(until.elementLocated(By.css('body')), 15000);
        await driver.sleep(5000); // Wait for dynamic content
        
        console.log('📄 Page loaded, searching for elements...');
        
        // Try different selectors
        const selectorsToTest = [
            'li.a-carousel-card',
            '.a-carousel-card',
            '[aria-roledescription="slide"]',
            '.a-carousel li',
            'ol.a-carousel li',
            'a img[src*="media-amazon.com"]',
            'img[src*="media-amazon.com"]'
        ];
        
        for (const selector of selectorsToTest) {
            try {
                const elements = await driver.findElements(By.css(selector));
                console.log(`🔍 Selector "${selector}": Found ${elements.length} elements`);
                
                if (elements.length > 0) {
                    console.log(`   First element details:`);
                    const firstElement = elements[0];
                    
                    try {
                        const tagName = await firstElement.getTagName();
                        const classes = await firstElement.getAttribute('class');
                        const id = await firstElement.getAttribute('id');
                        console.log(`     Tag: ${tagName}, Classes: ${classes}, ID: ${id}`);
                        
                        // Try to find image within
                        try {
                            const img = await firstElement.findElement(By.css('img'));
                            const src = await img.getAttribute('src');
                            const alt = await img.getAttribute('alt');
                            console.log(`     Image: ${src}`);
                            console.log(`     Alt: ${alt}`);
                        } catch (error) {
                            console.log(`     No image found within element`);
                        }
                        
                        // Try to find link within
                        try {
                            const link = await firstElement.findElement(By.css('a'));
                            const href = await link.getAttribute('href');
                            console.log(`     Link: ${href}`);
                        } catch (error) {
                            console.log(`     No link found within element`);
                        }
                        
                    } catch (error) {
                        console.log(`     Error getting element details: ${error.message}`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ Selector "${selector}" failed: ${error.message}`);
            }
        }
        
        // Check page source for carousel structure
        console.log('\n📋 Checking page structure...');
        const pageSource = await driver.getPageSource();
        
        if (pageSource.includes('a-carousel')) {
            console.log('✅ Found "a-carousel" in page source');
        } else {
            console.log('❌ "a-carousel" not found in page source');
        }
        
        if (pageSource.includes('a-carousel-card')) {
            console.log('✅ Found "a-carousel-card" in page source');
        } else {
            console.log('❌ "a-carousel-card" not found in page source');
        }
        
        if (pageSource.includes('aria-roledescription="slide"')) {
            console.log('✅ Found "aria-roledescription=\"slide\"" in page source');
        } else {
            console.log('❌ "aria-roledescription=\"slide\"" not found in page source');
        }
        
        // Count total images
        const allImages = await driver.findElements(By.css('img'));
        console.log(`\n🖼️ Total images on page: ${allImages.length}`);
        
        // Check for media-amazon.com images
        const amazonImages = await driver.findElements(By.css('img[src*="media-amazon.com"]'));
        console.log(`🖼️ Images from media-amazon.com: ${amazonImages.length}`);
        
        if (amazonImages.length > 0) {
            console.log('   Sample image URLs:');
            for (let i = 0; i < Math.min(3, amazonImages.length); i++) {
                const src = await amazonImages[i].getAttribute('src');
                const alt = await amazonImages[i].getAttribute('alt');
                console.log(`     ${i + 1}. ${src}`);
                console.log(`        Alt: ${alt}`);
            }
        }
        
        // Check for links with images
        const linksWithImages = await driver.findElements(By.css('a img'));
        console.log(`🔗 Links with images: ${linksWithImages.length}`);
        
        if (linksWithImages.length > 0) {
            console.log('   Sample link-image pairs:');
            for (let i = 0; i < Math.min(3, linksWithImages.length); i++) {
                try {
                    const parentLink = await linksWithImages[i].findElement(By.xpath('..'));
                    const href = await parentLink.getAttribute('href');
                    const imgSrc = await linksWithImages[i].getAttribute('src');
                    const imgAlt = await linksWithImages[i].getAttribute('alt');
                    console.log(`     ${i + 1}. Link: ${href}`);
                    console.log(`        Image: ${imgSrc}`);
                    console.log(`        Alt: ${imgAlt}`);
                } catch (error) {
                    console.log(`     ${i + 1}. Error getting link details: ${error.message}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        logger.error('Debug failed:', { error: error.message });
    } finally {
        if (driver) {
            await driver.quit();
            console.log('🔒 Driver closed');
        }
    }
}

// Run if called directly
if (require.main === module) {
    debugAmazonAffiliatePage();
}

module.exports = { debugAmazonAffiliatePage };
