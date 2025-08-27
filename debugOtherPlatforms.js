const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('./config/bannerConfig');
const { getModuleLogger } = require('./logger/logger');

const logger = getModuleLogger('debugOtherPlatforms');

async function debugOtherPlatforms() {
    let driver = null;
    
    try {
        // Initialize driver
        const options = new chrome.Options();
        options.addArguments('--headless');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--window-size=1920,1080');

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        logger.info('Debug driver initialized successfully');

        // Test other platforms
        const platforms = ['flipkart', 'myntra', 'ajio'];
        
        for (const platformKey of platforms) {
            const platformConfig = bannerConfig.platforms[platformKey];
            const { selectors } = platformConfig;

            logger.info(`\n=== Testing ${platformConfig.name} ===`);
            
            for (const url of platformConfig.bannerUrls) {
                logger.info(`\n--- Testing URL: ${url} ---`);
                
                try {
                    await driver.get(url);
                    await driver.wait(until.elementLocated(By.css('body')), 10000);
                    
                    // Test carousel selectors
                    logger.info('Testing carousel selectors:');
                    const primaryCarousels = await driver.findElements(By.css(selectors.carousel));
                    logger.info(`Primary carousel selector "${selectors.carousel}": ${primaryCarousels.length} elements`);
                    
                    if (selectors.alternativeCarousel) {
                        const altCarousels = await driver.findElements(By.css(selectors.alternativeCarousel));
                        logger.info(`Alternative carousel selector "${selectors.alternativeCarousel}": ${altCarousels.length} elements`);
                    }
                    
                    // Test banner link selectors
                    logger.info('Testing banner link selectors:');
                    const primaryLinks = await driver.findElements(By.css(selectors.bannerLink));
                    logger.info(`Primary link selector "${selectors.bannerLink}": ${primaryLinks.length} elements`);
                    
                    if (selectors.alternativeBannerLink) {
                        const altLinks = await driver.findElements(By.css(selectors.alternativeBannerLink));
                        logger.info(`Alternative link selector "${selectors.alternativeBannerLink}": ${altLinks.length} elements`);
                    }
                    
                    // Test image selectors
                    logger.info('Testing image selectors:');
                    const primaryImages = await driver.findElements(By.css(selectors.bannerImage));
                    logger.info(`Primary image selector "${selectors.bannerImage}": ${primaryImages.length} elements`);
                    
                    if (selectors.alternativeBannerImage) {
                        const altImages = await driver.findElements(By.css(selectors.alternativeBannerImage));
                        logger.info(`Alternative image selector "${selectors.alternativeBannerImage}": ${altImages.length} elements`);
                    }
                    
                    // Get page title and some basic info
                    const pageTitle = await driver.getTitle();
                    logger.info(`Page title: ${pageTitle}`);
                    
                    // Check if page loaded correctly
                    const bodyText = await driver.findElement(By.css('body')).getText();
                    logger.info(`Body text length: ${bodyText.length} characters`);
                    
                    // Look for any carousel-like elements
                    const allCarouselElements = await driver.findElements(By.css('[class*="carousel"]'));
                    logger.info(`Elements with "carousel" in class: ${allCarouselElements.length}`);
                    
                    const allSliderElements = await driver.findElements(By.css('[class*="slider"]'));
                    logger.info(`Elements with "slider" in class: ${allSliderElements.length}`);
                    
                    const allBannerElements = await driver.findElements(By.css('[class*="banner"]'));
                    logger.info(`Elements with "banner" in class: ${allBannerElements.length}`);
                    
                    const allImageElements = await driver.findElements(By.css('img'));
                    logger.info(`Total images on page: ${allImageElements.length}`);
                    
                    // Sample some image sources
                    const sampleImages = allImageElements.slice(0, 5);
                    for (let i = 0; i < sampleImages.length; i++) {
                        try {
                            const src = await sampleImages[i].getAttribute('src');
                            const alt = await sampleImages[i].getAttribute('alt');
                            logger.info(`Sample image ${i + 1}: src="${src?.substring(0, 50)}...", alt="${alt?.substring(0, 50)}..."`);
                        } catch (error) {
                            logger.info(`Sample image ${i + 1}: Error getting attributes`);
                        }
                    }
                    
                } catch (error) {
                    logger.error(`Error testing ${url}:`, { error: error.message });
                }
            }
        }
        
    } catch (error) {
        logger.error('Debug extraction failed:', { error: error.message, stack: error.stack });
    } finally {
        if (driver) {
            await driver.quit();
            logger.info('Debug driver closed');
        }
    }
}

// Run the debug script
if (require.main === module) {
    debugOtherPlatforms()
        .then(() => {
            logger.info('Debug completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Debug failed:', { error: error.message });
            process.exit(1);
        });
}

module.exports = { debugOtherPlatforms }; 