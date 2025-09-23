const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('../config/bannerConfig');
const { 
    validateBannerUrl, 
    validateBannerContent, 
    validateBannerImage,
    generateBannerId,
    generateBannerTimestamp,
    categorizeBanner,
    isProductCarousel
} = require('../utils/commonUtils');
const { getModuleLogger } = require('../logger/logger');
const { bannerDB } = require('../database/firebaseDB/bannerDB');
const { bannerUrlFixer } = require('../services/bannerUrlFixer');

const logger = getModuleLogger('bannerExtractor');

class BannerExtractor {
    constructor(options = {}) {
        this.driver = null;
        this.extractedBanners = [];
        this.useExistingChrome = options.useExistingChrome || process.env.USE_EXISTING_CHROME === '1';
        this.debuggerAddress = options.debuggerAddress || process.env.DEBUGGER_ADDRESS || '127.0.0.1:9222';
    }

    async initializeDriver() {
        try {
            const options = new chrome.Options();
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');

            if (this.useExistingChrome) {
                // Attach to an already running Chrome with remote debugging
                // selenium-webdriver chrome supports debuggerAddress via options_.
                options.options_.debuggerAddress = this.debuggerAddress;
                logger.info('Attaching to existing Chrome via debugger', { debuggerAddress: this.debuggerAddress });
            } else {
                options.addArguments('--headless');
            }

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            logger.info('Banner extractor driver initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize driver:', { error: error.message });
            throw error;
        }
    }

    isLikelyFlipkartProductImage(imageUrl, altText) {
        try {
            if (!imageUrl) return true;
            const lowerUrl = imageUrl.toLowerCase();
            const lowerAlt = (altText || '').toLowerCase();
            // Common Flipkart product thumbnail patterns and sizes
            const thumbnailPatterns = [
                '/image/150/150/',
                '/image/170/170/',
                '/image/128/128/',
                '/image/200/200/',
                '/image/250/250/',
                '/image/312/312/',
                '/image/416/416/',
                'q=70',
                'xif0q'
            ];
            if (thumbnailPatterns.some(p => lowerUrl.includes(p))) return true;
            // Likely catalog product words in alt
            const productWords = [
                'men ', 'women ', 'boys ', 'girls ', 'shirt', 't-shirt', 'jeans', 'trouser', 'track pant',
                'shoe', 'sandal', 'watch', 'dress', 'saree', 'lehenga', 'kurta', 'mobile', 'phone', 'case',
                'back cover', 'headphone', 'earbud', 'camera', 'laptop', 'router', 'mixer', 'refrigerator'
            ];
            if (productWords.some(w => lowerAlt.includes(w))) return true;
            // Image host for product images
            if (lowerUrl.includes('rukminim2.flixcart.com/image/')) return true;
            return false;
        } catch (_) {
            return false;
        }
    }

    async closeDriver() {
        if (this.driver) {
            try {
                await this.driver.quit();
                logger.info('Banner extractor driver closed successfully');
            } catch (error) {
                logger.error('Error closing driver:', { error: error.message });
            }
        }
    }

    async extractBannersFromPlatform(platformKey, platformConfig) {
        const banners = [];
        const { name, bannerUrls, selectors, validation } = platformConfig;

        logger.info(`Starting banner extraction for ${name}`, { platform: platformKey });

        for (const url of bannerUrls) {
            try {
                logger.debug(`Extracting banners from: ${url}`);
                await this.driver.get(url);
                
                // Wait for page to load
                await this.driver.wait(until.elementLocated(By.css('body')), 10000);
                
                // Extract banners from this URL
                const urlBanners = await this.extractBannersFromUrl(platformKey, selectors, validation);
                banners.push(...urlBanners);
                
                logger.info(`Extracted ${urlBanners.length} banners from ${url}`);
                
            } catch (error) {
                logger.error(`Error extracting banners from ${url}:`, { 
                    error: error.message, 
                    platform: platformKey 
                });
            }
        }

        return banners;
    }

    async extractBannersFromUrl(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            // Try primary selectors first
            let carouselElements = await this.driver.findElements(By.css(selectors.carousel));
            logger.debug(`Found ${carouselElements.length} carousel elements for ${platformKey} with primary selector`);
            
            // If no elements found, try alternative selectors
            if (carouselElements.length === 0 && selectors.alternativeCarousel) {
                carouselElements = await this.driver.findElements(By.css(selectors.alternativeCarousel));
                logger.debug(`Found ${carouselElements.length} carousel elements for ${platformKey} with alternative selector`);
            }
            
            // If still no carousel elements, try to find banner images directly
            if (carouselElements.length === 0) {
                logger.debug(`No carousel elements found, trying direct image extraction for ${platformKey}`);
                const directBanners = await this.extractBannersDirectly(platformKey, selectors, validation);
                banners.push(...directBanners);
            } else {
                for (const carouselElement of carouselElements) {
                    try {
                        // Find banner links within the carousel
                        let bannerLinks = await carouselElement.findElements(By.css(selectors.bannerLink));
                        logger.debug(`Found ${bannerLinks.length} banner links in carousel element`);
                        
                        // If no links found, try alternative link selector
                        if (bannerLinks.length === 0 && selectors.alternativeBannerLink) {
                            bannerLinks = await carouselElement.findElements(By.css(selectors.alternativeBannerLink));
                            logger.debug(`Found ${bannerLinks.length} banner links with alternative selector`);
                        }
                        
                        for (const linkElement of bannerLinks) {
                            try {
                                const banner = await this.extractBannerFromElement(
                                    linkElement, 
                                    platformKey, 
                                    selectors, 
                                    validation
                                );
                                
                                if (banner && banner.isValid) {
                                    banners.push(banner);
                                    logger.debug(`Successfully extracted banner: ${banner.id}`);
                                }
                            } catch (error) {
                                logger.debug(`Error extracting banner from link element:`, { error: error.message });
                            }
                        }
                    } catch (error) {
                        logger.debug(`Error processing carousel element:`, { error: error.message });
                    }
                }
            }
            
            // Limit banners to maxBannersPerPlatform and prioritize by category
            const maxBanners = bannerConfig.global.maxBannersPerPlatform;
            if (banners.length > maxBanners) {
                // Sort by priority (hero > promotional > seasonal > category)
                banners.sort((a, b) => (a.priority || 4) - (b.priority || 4));
                
                // Take only the top banners
                const limitedBanners = banners.slice(0, maxBanners);
                logger.info(`Limited banners from ${banners.length} to ${limitedBanners.length} for ${platformKey}`);
                return limitedBanners;
            }
            
        } catch (error) {
            logger.error(`Error extracting banners from URL:`, { error: error.message });
        }
        
        return banners;
    }

    async extractBannersDirectly(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            // Find all banner images directly on the page
            let bannerImages = await this.driver.findElements(By.css(selectors.bannerImage));
            logger.debug(`Found ${bannerImages.length} banner images directly for ${platformKey}`);
            
            // If no images found, try alternative image selector
            if (bannerImages.length === 0 && selectors.alternativeBannerImage) {
                bannerImages = await this.driver.findElements(By.css(selectors.alternativeBannerImage));
                logger.debug(`Found ${bannerImages.length} banner images with alternative selector for ${platformKey}`);
            }
            
            for (const imageElement of bannerImages) {
                try {
                    const imageUrl = await imageElement.getAttribute('src');
                    const altText = await imageElement.getAttribute('alt');
                    
                    // Skip data URLs and small images
                    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.length < 50) {
                        continue;
                    }
                    
                    // Check if this is a product carousel (should be excluded)
                    if (isProductCarousel(imageElement, selectors)) {
                        logger.debug(`Skipping product carousel: ${altText}`);
                        continue;
                    }
                    
                    logger.debug(`Found direct image: ${imageUrl}, alt: ${altText}`);

                    // Early filter for Flipkart product thumbnails
                    if (platformKey === 'flipkart' && this.isLikelyFlipkartProductImage(imageUrl, altText)) {
                        logger.debug('Skipping likely product image (Flipkart direct)', { imageUrl, altText });
                        continue;
                    }

                    // Validate banner URL
                    const urlValidation = validateBannerUrl(imageUrl, validation.allowedDomains);
                    if (!urlValidation.isValid) {
                        logger.debug(`Direct banner URL validation failed:`, { 
                            reason: urlValidation.reason, 
                            url: imageUrl 
                        });
                        continue;
                    }
                    
                    // Validate banner content
                    const contentValidation = validateBannerContent(altText, null, validation.excludedKeywords);
                    if (!contentValidation.isValid) {
                        logger.debug(`Direct banner content validation failed:`, { 
                            reason: contentValidation.reason, 
                            altText: altText 
                        });
                        continue;
                    }
                    
                    // Categorize the banner
                    const categorization = categorizeBanner(altText, null, imageUrl, platformKey);
                    
                    // Generate banner data
                    const bannerId = generateBannerId(platformKey, categorization.category);
                    const timestamp = generateBannerTimestamp();
                    
                    const banner = {
                        id: bannerId,
                        url: imageUrl,
                        clickRedirectUrl: `https://www.${platformKey}.com`, // Default redirect
                        isActive: true,
                        order: 0,
                        creationTimestamp: timestamp,
                        updateTimestamp: timestamp,
                        platform: platformKey,
                        category: categorization.category,
                        priority: categorization.priority,
                        title: contentValidation.value,
                        description: altText
                    };
                    
                    banners.push({
                        ...banner,
                        isValid: true
                    });
                    
                    logger.debug(`Successfully extracted direct banner: ${banner.id} (${categorization.category})`);
                    
                } catch (error) {
                    logger.debug(`Error extracting direct banner:`, { error: error.message });
                }
            }
            
        } catch (error) {
            logger.error(`Error extracting banners directly:`, { error: error.message });
        }
        
        return banners;
    }

    async extractBannerFromElement(element, platformKey, selectors, validation) {
        try {
            // Extract link URL
            const clickRedirectUrl = await element.getAttribute('href');
            logger.debug(`Found link: ${clickRedirectUrl}`);
            
            // Find image element within the link
            let imageElement;
            try {
                imageElement = await element.findElement(By.css(selectors.bannerImage));
            } catch (error) {
                // Try alternative image selector if available
                if (selectors.alternativeBannerImage) {
                    try {
                        imageElement = await element.findElement(By.css(selectors.alternativeBannerImage));
                    } catch (altError) {
                        logger.debug(`No image found with any selector:`, { error: altError.message });
                        return null;
                    }
                } else {
                    logger.debug(`No image found with primary selector:`, { error: error.message });
                    return null;
                }
            }
            
            const imageUrl = await imageElement.getAttribute('src');
            const altText = await imageElement.getAttribute('alt');
            logger.debug(`Found image: ${imageUrl}, alt: ${altText}`);

            // Early filter for Flipkart product thumbnails
            if (platformKey === 'flipkart' && this.isLikelyFlipkartProductImage(imageUrl, altText)) {
                logger.debug('Skipping likely product image (Flipkart link)', { imageUrl, altText });
                return null;
            }

            // Validate banner URL
            const urlValidation = validateBannerUrl(imageUrl, validation.allowedDomains);
            if (!urlValidation.isValid) {
                logger.debug(`Banner URL validation failed:`, { 
                    reason: urlValidation.reason, 
                    url: imageUrl 
                });
                return null;
            }
            
            // Validate banner content
            const contentValidation = validateBannerContent(altText, null, validation.excludedKeywords);
            if (!contentValidation.isValid) {
                logger.debug(`Banner content validation failed:`, { 
                    reason: contentValidation.reason, 
                    altText: altText 
                });
                return null;
            }
            
            // Validate image if enabled
            let imageValidation = { isValid: true, value: imageUrl };
            if (bannerConfig.global.validateImages) {
                imageValidation = await validateBannerImage(
                    imageUrl, 
                    validation.minImageWidth, 
                    validation.minImageHeight
                );
            }
            
            if (!imageValidation.isValid) {
                logger.debug(`Banner image validation failed:`, { 
                    reason: imageValidation.reason, 
                    url: imageUrl 
                });
                return null;
            }
            
            // Categorize the banner
            const categorization = categorizeBanner(altText, null, imageUrl, platformKey);
            
            // Generate banner data
            const bannerId = generateBannerId(platformKey, categorization.category);
            const timestamp = generateBannerTimestamp();
            
            const banner = {
                id: bannerId,
                url: imageValidation.value,
                clickRedirectUrl: clickRedirectUrl,
                isActive: true,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                platform: platformKey,
                category: categorization.category,
                priority: categorization.priority,
                title: contentValidation.value,
                description: altText
            };
            
            return {
                ...banner,
                isValid: true
            };
            
        } catch (error) {
            logger.debug(`Error extracting banner from element:`, { error: error.message });
            return null;
        }
    }

    async extractAllBanners() {
        try {
            await this.initializeDriver();
            
            const allBanners = [];
            
            // Extract banners from each platform
            for (const [platformKey, platformConfig] of Object.entries(bannerConfig.platforms)) {
                try {
                    const platformBanners = await this.extractBannersFromPlatform(platformKey, platformConfig);
                    allBanners.push(...platformBanners);
                    
                    logger.info(`Completed banner extraction for ${platformConfig.name}`, {
                        platform: platformKey,
                        bannerCount: platformBanners.length
                    });
                    
                } catch (error) {
                    logger.error(`Error extracting banners from ${platformConfig.name}:`, {
                        error: error.message,
                        platform: platformKey
                    });
                }
            }
            
            return allBanners;
            
        } catch (error) {
            logger.error('Error in banner extraction process:', { error: error.message });
            throw error;
        } finally {
            await this.closeDriver();
        }
    }

    async storeBannersInFirebase(banners) {
        try {
            const result = await bannerDB.storeMultipleBanners(banners);
            
            const storedBanners = result
                .filter(r => r.status === 200 || r.status === 201)
                .map(r => banners.find(b => b.id === r.id))
                .filter(Boolean);
            
            logger.info(`Stored ${storedBanners.length} banners in Firebase`, {
                total: banners.length,
                stored: storedBanners.length
            });
            
            return storedBanners;
        } catch (error) {
            logger.error('Error storing banners in Firebase:', { error: error.message });
            return [];
        }
    }

    async deactivateOldBanners(activeBannerIds) {
        try {
            const result = await bannerDB.deactivateOldBanners(activeBannerIds);
            logger.info('Banner deactivation completed', { result });
        } catch (error) {
            logger.error('Error deactivating old banners:', { error: error.message });
        }
    }

    async runBannerExtraction() {
        try {
            logger.info('Starting banner extraction process');
            
            // Extract banners from all platforms
            const extractedBanners = await this.extractAllBanners();
            
            logger.info(`Extracted ${extractedBanners.length} banners total`);
            
            // Fix URLs for banners if enabled
            let processedBanners = extractedBanners;
            if (extractedBanners.length > 0) {
                logger.info('Starting banner URL verification and fixing...');
                processedBanners = await bannerUrlFixer.fixBannerUrls(extractedBanners);
                
                const urlFixStats = bannerUrlFixer.getStatistics();
                logger.info('Banner URL fixing completed', {
                    total: urlFixStats.total,
                    fixed: urlFixStats.fixed,
                    errors: urlFixStats.errors,
                    skipped: urlFixStats.skipped
                });
            }
            
            // Store banners in Firebase
            const storedBanners = await this.storeBannersInFirebase(processedBanners);
            
            logger.info(`Successfully stored ${storedBanners.length} banners in Firebase`);
            
            // Deactivate old banners (optional)
            const activeBannerIds = storedBanners.map(banner => banner.id);
            await this.deactivateOldBanners(activeBannerIds);
            
            return {
                success: true,
                extracted: extractedBanners.length,
                stored: storedBanners.length
            };
            
        } catch (error) {
            logger.error('Banner extraction process failed:', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export the class and a convenience function
module.exports = {
    BannerExtractor,
    async extractBanners() {
        const extractor = new BannerExtractor();
        return await extractor.runBannerExtraction();
    }
}; 