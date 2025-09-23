const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('../config/bannerConfig');
const { ImprovedBannerValidator } = require('../utils/improvedBannerValidator');
const { getModuleLogger } = require('../logger/logger');
const { bannerDB } = require('../database/firebaseDB/bannerDB');

const logger = getModuleLogger('improvedBannerExtractor');

/**
 * Improved Banner Extractor
 * 
 * This extractor focuses on extracting only actual promotional banners,
 * not product images or affiliate commission details. It connects to
 * Chrome browser on port 9222 for Amazon affiliate login support.
 */

class ImprovedBannerExtractor {
    constructor() {
        this.driver = null;
        this.extractedBanners = [];
        this.validator = new ImprovedBannerValidator();
        this.chromePort = 9222;
        this.maxBannersPerPlatform = 50; // Remove limit to fetch all banners
        this.enableDatabase = false; // Flag to control database storage
        this.extractedUrls = new Set(); // Track extracted URLs to avoid duplicates
    }

    /**
     * Initialize driver with Chrome browser on port 9222
     */
    async initializeDriver() {
        try {
            logger.info('Initializing improved banner extractor with Chrome port 9222');
            
            const options = new chrome.Options();
            
            // Connect to existing Chrome browser on port 9222
            options.addArguments(`--remote-debugging-port=${this.chromePort}`);
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');
            options.addArguments('--disable-web-security');
            options.addArguments('--disable-features=VizDisplayCompositor');
            
            // Connect to existing Chrome instance
            options.debuggerAddress(`localhost:${this.chromePort}`);

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            logger.info('Successfully connected to Chrome browser on port 9222');
            
            // Test the connection
            await this.driver.get('https://www.google.com');
            logger.info('Chrome browser connection test successful');
            
        } catch (error) {
            logger.error('Failed to connect to Chrome browser on port 9222:', { error: error.message });
            
            // Fallback to new Chrome instance
            logger.info('Falling back to new Chrome instance');
            await this.initializeNewDriver();
        }
    }

    /**
     * Initialize new Chrome driver as fallback
     */
    async initializeNewDriver() {
        try {
            const options = new chrome.Options();
            options.addArguments('--headless');
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            logger.info('New Chrome driver initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize new driver:', { error: error.message });
            throw error;
        }
    }

    /**
     * Close driver
     */
    async closeDriver() {
        if (this.driver) {
            try {
                await this.driver.quit();
                logger.info('Improved banner extractor driver closed successfully');
            } catch (error) {
                logger.error('Error closing driver:', { error: error.message });
            }
        }
    }

    /**
     * Extract banners from a specific platform
     * @param {string} platformKey - Platform identifier
     * @param {Object} platformConfig - Platform configuration
     * @returns {Array} Array of validated banners
     */
    async extractBannersFromPlatform(platformKey, platformConfig) {
        const banners = [];
        const { name, bannerUrls, selectors, validation } = platformConfig;

        logger.info(`Starting improved banner extraction for ${name}`, { 
            platform: platformKey,
            maxBanners: this.maxBannersPerPlatform 
        });

        for (const url of bannerUrls) {
            try {
                logger.info(`Processing URL: ${url}`);
                await this.driver.get(url);
                
                // Wait for page to load completely
                await this.driver.wait(until.elementLocated(By.css('body')), 15000);
                
                // Additional wait for dynamic content
                await this.driver.sleep(5000);
                
                // Extract banners from this URL
                const urlBanners = await this.extractBannersFromUrl(platformKey, selectors, validation, url);
                banners.push(...urlBanners);
                
                logger.info(`Extracted ${urlBanners.length} quality banners from ${url}`);
                
                // Continue processing all URLs to get all banners
                logger.debug(`Processed ${url}, total banners so far: ${banners.length}`);
                
            } catch (error) {
                logger.error(`Error extracting banners from ${url}:`, { 
                    error: error.message, 
                    platform: platformKey 
                });
            }
        }

        // Sort by priority but don't limit - return all banners
        const sortedBanners = banners
            .sort((a, b) => (a.priority || 4) - (b.priority || 4));

        logger.info(`Final banner count for ${platformKey}: ${sortedBanners.length}`, {
            totalFound: banners.length,
            selected: sortedBanners.length
        });

        return sortedBanners;
    }

    /**
     * Extract banners from a specific URL
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors for banner elements
     * @param {Object} validation - Validation rules
     * @param {string} url - Current URL being processed
     * @returns {Array} Array of validated banners
     */
    async extractBannersFromUrl(platformKey, selectors, validation, url) {
        const banners = [];
        
        try {
            logger.debug(`Extracting banners from URL: ${url}`);
            
            // Try different extraction methods
            const extractionMethods = [
                () => this.extractFromCarousel(platformKey, selectors, validation),
                () => this.extractFromBannerImages(platformKey, selectors, validation),
                () => this.extractFromPromotionalElements(platformKey, selectors, validation)
            ];

            for (const method of extractionMethods) {
                try {
                    const methodBanners = await method();
                    banners.push(...methodBanners);
                    
                    if (banners.length >= this.maxBannersPerPlatform) {
                        break;
                    }
                } catch (error) {
                    logger.debug(`Extraction method failed:`, { error: error.message });
                }
            }
            
            logger.debug(`Found ${banners.length} banner candidates from ${url}`);
            
        } catch (error) {
            logger.error(`Error extracting banners from URL:`, { error: error.message });
        }
        
        return banners;
    }

    /**
     * Extract banners from carousel elements
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors
     * @param {Object} validation - Validation rules
     * @returns {Array} Array of banners
     */
    async extractFromCarousel(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            // Find carousel elements
            let carouselElements = await this.driver.findElements(By.css(selectors.carousel));
            logger.debug(`Found ${carouselElements.length} carousel elements`);
            
            // Try alternative carousel selector if no elements found
            if (carouselElements.length === 0 && selectors.alternativeCarousel) {
                carouselElements = await this.driver.findElements(By.css(selectors.alternativeCarousel));
                logger.debug(`Found ${carouselElements.length} carousel elements with alternative selector`);
            }
            
            // Try affiliate carousel selector for affiliate page
            if (carouselElements.length === 0 && selectors.affiliateCarousel) {
                carouselElements = await this.driver.findElements(By.css(selectors.affiliateCarousel));
                logger.debug(`Found ${carouselElements.length} affiliate carousel elements`);
            }
            
            for (const carouselElement of carouselElements) {
                try {
                    // Find banner links within the carousel
                    let bannerLinks = await carouselElement.findElements(By.css(selectors.bannerLink));
                    
                    if (bannerLinks.length === 0 && selectors.alternativeBannerLink) {
                        bannerLinks = await carouselElement.findElements(By.css(selectors.alternativeBannerLink));
                    }
                    
                    if (bannerLinks.length === 0 && selectors.affiliateBannerLink) {
                        bannerLinks = await carouselElement.findElements(By.css(selectors.affiliateBannerLink));
                    }
                    
                    logger.debug(`Found ${bannerLinks.length} banner links in carousel`);
                    
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
                                logger.debug(`Successfully extracted carousel banner: ${banner.id}`);
                            }
                        } catch (error) {
                            logger.debug(`Error extracting banner from carousel link:`, { error: error.message });
                        }
                    }
                } catch (error) {
                    logger.debug(`Error processing carousel element:`, { error: error.message });
                }
            }
            
        } catch (error) {
            logger.error(`Error extracting from carousel:`, { error: error.message });
        }
        
        return banners;
    }

    /**
     * Extract banners from direct banner images
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors
     * @param {Object} validation - Validation rules
     * @returns {Array} Array of banners
     */
    async extractFromBannerImages(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            // Find banner images directly
            let bannerImages = await this.driver.findElements(By.css(selectors.bannerImage));
            logger.debug(`Found ${bannerImages.length} banner images directly`);
            
            if (bannerImages.length === 0 && selectors.alternativeBannerImage) {
                bannerImages = await this.driver.findElements(By.css(selectors.alternativeBannerImage));
                logger.debug(`Found ${bannerImages.length} banner images with alternative selector`);
            }
            
            for (const imageElement of bannerImages) {
                try {
                    const banner = await this.extractBannerFromImageElement(
                        imageElement, 
                        platformKey, 
                        selectors, 
                        validation
                    );
                    
                    if (banner && banner.isValid) {
                        banners.push(banner);
                        logger.debug(`Successfully extracted direct banner: ${banner.id}`);
                    }
                } catch (error) {
                    logger.debug(`Error extracting banner from image element:`, { error: error.message });
                }
            }
            
        } catch (error) {
            logger.error(`Error extracting from banner images:`, { error: error.message });
        }
        
        return banners;
    }

    /**
     * Extract banners from promotional elements
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors
     * @param {Object} validation - Validation rules
     * @returns {Array} Array of banners
     */
    async extractFromPromotionalElements(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            // Look for promotional elements (divs with promotional content)
            const promoSelectors = [
                'div[class*="promo"]',
                'div[class*="banner"]',
                'div[class*="hero"]',
                'div[class*="advertisement"]',
                'div[class*="campaign"]',
                'section[class*="promo"]',
                'section[class*="banner"]'
            ];
            
            for (const selector of promoSelectors) {
                try {
                    const promoElements = await this.driver.findElements(By.css(selector));
                    logger.debug(`Found ${promoElements.length} promotional elements with selector: ${selector}`);
                    
                    for (const promoElement of promoElements) {
                        try {
                            // Find images within promotional elements
                            const images = await promoElement.findElements(By.css('img'));
                            
                            for (const image of images) {
                                const banner = await this.extractBannerFromImageElement(
                                    image, 
                                    platformKey, 
                                    selectors, 
                                    validation
                                );
                                
                                if (banner && banner.isValid) {
                                    banners.push(banner);
                                    logger.debug(`Successfully extracted promotional banner: ${banner.id}`);
                                }
                            }
                        } catch (error) {
                            logger.debug(`Error processing promotional element:`, { error: error.message });
                        }
                    }
                } catch (error) {
                    logger.debug(`Error with promotional selector ${selector}:`, { error: error.message });
                }
            }
            
        } catch (error) {
            logger.error(`Error extracting from promotional elements:`, { error: error.message });
        }
        
        return banners;
    }

    /**
     * Extract banner from link element
     * @param {Object} element - Link element
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors
     * @param {Object} validation - Validation rules
     * @returns {Object|null} Banner object or null
     */
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
                if (selectors.alternativeBannerImage) {
                    try {
                        imageElement = await element.findElement(By.css(selectors.alternativeBannerImage));
                    } catch (altError) {
                        logger.debug(`No image found in link element`);
                        return null;
                    }
                } else {
                    return null;
                }
            }
            
            const imageUrl = await imageElement.getAttribute('src');
            const altText = await imageElement.getAttribute('alt');
            
            logger.debug(`Found image in link: ${imageUrl?.substring(0, 100)}, alt: ${altText?.substring(0, 50)}`);
            
            // Check for duplicate URLs
            if (this.extractedUrls.has(imageUrl)) {
                logger.debug(`Duplicate URL detected: ${imageUrl?.substring(0, 100)}`);
                return null;
            }

            // Validate banner using improved validator
            const bannerData = {
                imageUrl,
                altText,
                title: null,
                clickUrl: clickRedirectUrl,
                element: imageElement
            };
            
            const validation = this.validator.validateBanner(bannerData);
            
            if (!validation.isValid) {
                logger.debug(`Banner validation failed:`, { 
                    reasons: validation.reasons,
                    imageUrl: imageUrl?.substring(0, 100)
                });
                return null;
            }

            // Add URL to extracted set
            this.extractedUrls.add(imageUrl);
            
            // Get category and priority
            const category = this.validator.getBannerCategory(bannerData);
            
            // Generate banner data in the required format
            const bannerId = this.generateBannerId(platformKey, category.category);
            const timestamp = this.generateBannerTimestamp();
            
            const banner = {
                id: bannerId,
                url: imageUrl,
                clickRedirectUrl: clickRedirectUrl || "",
                isActive: true,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                expirationTimestamp: "", // Leave empty - don't generate random expiration
                targetDealId: "",
                platform: platformKey,
                category: category.category,
                priority: category.priority,
                title: altText || 'Banner',
                description: altText,
                confidence: validation.confidence,
                validationReasons: validation.reasons
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

    /**
     * Extract banner from image element
     * @param {Object} imageElement - Image element
     * @param {string} platformKey - Platform identifier
     * @param {Object} selectors - CSS selectors
     * @param {Object} validation - Validation rules
     * @returns {Object|null} Banner object or null
     */
    async extractBannerFromImageElement(imageElement, platformKey, selectors, validation) {
        try {
            const imageUrl = await imageElement.getAttribute('src');
            const altText = await imageElement.getAttribute('alt');
            
            logger.debug(`Found direct image: ${imageUrl?.substring(0, 100)}, alt: ${altText?.substring(0, 50)}`);
            
            // Check for duplicate URLs
            if (this.extractedUrls.has(imageUrl)) {
                logger.debug(`Duplicate URL detected: ${imageUrl?.substring(0, 100)}`);
                return null;
            }

            // Validate banner using improved validator
            const bannerData = {
                imageUrl,
                altText,
                title: null,
                clickUrl: null,
                element: imageElement
            };
            
            const validation = this.validator.validateBanner(bannerData);
            
            if (!validation.isValid) {
                logger.debug(`Direct banner validation failed:`, { 
                    reasons: validation.reasons,
                    imageUrl: imageUrl?.substring(0, 100)
                });
                return null;
            }

            // Add URL to extracted set
            this.extractedUrls.add(imageUrl);
            
            // Get category and priority
            const category = this.validator.getBannerCategory(bannerData);
            
            // Generate banner data in the required format
            const bannerId = this.generateBannerId(platformKey, category.category);
            const timestamp = this.generateBannerTimestamp();
            
            const banner = {
                id: bannerId,
                url: imageUrl,
                clickRedirectUrl: `https://www.${platformKey}.com`, // Default redirect
                isActive: true,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                expirationTimestamp: "", // Leave empty - don't generate random expiration
                targetDealId: "",
                platform: platformKey,
                category: category.category,
                priority: category.priority,
                title: altText || 'Banner',
                description: altText,
                confidence: validation.confidence,
                validationReasons: validation.reasons
            };
            
            return {
                ...banner,
                isValid: true
            };
            
        } catch (error) {
            logger.debug(`Error extracting banner from image element:`, { error: error.message });
            return null;
        }
    }

    /**
     * Extract all banners from all platforms
     * @returns {Array} Array of all extracted banners
     */
    async extractAllBanners() {
        try {
            await this.initializeDriver();
            
            const allBanners = [];
            
            // Extract banners from each platform
            for (const [platformKey, platformConfig] of Object.entries(bannerConfig.platforms)) {
                try {
                    logger.info(`Starting extraction for platform: ${platformKey}`);
                    
                    const platformBanners = await this.extractBannersFromPlatform(platformKey, platformConfig);
                    allBanners.push(...platformBanners);
                    
                    logger.info(`Completed banner extraction for ${platformConfig.name}`, {
                        platform: platformKey,
                        bannerCount: platformBanners.length,
                        totalBanners: allBanners.length
                    });
                    
                } catch (error) {
                    logger.error(`Error extracting banners from ${platformConfig.name}:`, {
                        error: error.message,
                        platform: platformKey
                    });
                }
            }
            
            logger.info(`Total banners extracted: ${allBanners.length}`);
            return allBanners;
            
        } catch (error) {
            logger.error('Error in banner extraction process:', { error: error.message });
            throw error;
        } finally {
            await this.closeDriver();
        }
    }

    /**
     * Store banners in Firebase (only if enableDatabase is true)
     * @param {Array} banners - Array of banners to store
     * @returns {Array} Array of stored banners
     */
    async storeBannersInFirebase(banners) {
        if (!this.enableDatabase) {
            logger.info(`Database storage disabled - ${banners.length} banners would be stored`);
            return banners; // Return banners as if stored
        }
        
        try {
            logger.info(`Storing ${banners.length} banners in Firebase`);
            
            const result = await bannerDB.storeMultipleBanners(banners);
            
            const storedBanners = result
                .filter(r => r.status === 200 || r.status === 201)
                .map(r => banners.find(b => b.id === r.id))
                .filter(Boolean);
            
            logger.info(`Successfully stored ${storedBanners.length} banners in Firebase`, {
                total: banners.length,
                stored: storedBanners.length,
                failed: banners.length - storedBanners.length
            });
            
            return storedBanners;
        } catch (error) {
            logger.error('Error storing banners in Firebase:', { error: error.message });
            return [];
        }
    }

    /**
     * Deactivate old banners
     * @param {Array} activeBannerIds - Array of active banner IDs
     */
    async deactivateOldBanners(activeBannerIds) {
        try {
            logger.info(`Deactivating old banners, keeping ${activeBannerIds.length} active`);
            
            const result = await bannerDB.deactivateOldBanners(activeBannerIds);
            logger.info('Banner deactivation completed', { result });
        } catch (error) {
            logger.error('Error deactivating old banners:', { error: error.message });
        }
    }

    /**
     * Run complete banner extraction process
     * @returns {Object} Process result
     */
    async runBannerExtraction() {
        try {
            logger.info('Starting improved banner extraction process');
            
            // Extract banners from all platforms
            const extractedBanners = await this.extractAllBanners();
            
            logger.info(`Extracted ${extractedBanners.length} quality banners total`);
            
            // Store banners in Firebase
            const storedBanners = await this.storeBannersInFirebase(extractedBanners);
            
            logger.info(`Successfully stored ${storedBanners.length} banners in Firebase`);
            
            // Deactivate old banners
            const activeBannerIds = storedBanners.map(banner => banner.id);
            await this.deactivateOldBanners(activeBannerIds);
            
            return {
                success: true,
                extracted: extractedBanners.length,
                stored: storedBanners.length,
                platforms: Object.keys(bannerConfig.platforms).length
            };
            
        } catch (error) {
            logger.error('Improved banner extraction process failed:', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate banner ID
     * @param {string} platform - Platform name
     * @param {string} category - Banner category
     * @returns {string} Generated banner ID
     */
    generateBannerId(platform, category = "banner") {
        const timestamp = new Date().getTime();
        const date = new Date(timestamp).toISOString().split('T')[0];
        const uniqueId = Math.random().toString(36).substring(2, 8);
        return `${platform}-${category}-${date}-${uniqueId}`;
    }

    /**
     * Generate banner timestamp
     * @returns {string} ISO timestamp
     */
    generateBannerTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Generate expiration timestamp based on banner category
     * @param {string} category - Banner category
     * @returns {string} ISO timestamp
     */
    generateExpirationTimestamp(category) {
        const now = new Date();
        let expirationDays = 30; // Default 30 days
        
        // Set expiration based on category
        switch (category) {
            case 'hero':
                expirationDays = 7; // Hero banners expire in 7 days
                break;
            case 'seasonal':
                expirationDays = 14; // Seasonal banners expire in 14 days
                break;
            case 'promotional':
                expirationDays = 21; // Promotional banners expire in 21 days
                break;
            case 'category':
                expirationDays = 30; // Category banners expire in 30 days
                break;
            default:
                expirationDays = 30;
        }
        
        const expiration = new Date(now.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
        return expiration.toISOString();
    }

    /**
     * Generate JSON output in the required format
     * @param {Array} banners - Array of banners
     * @returns {Object} JSON object in the required format
     */
    generateJsonOutput(banners) {
        const jsonOutput = {};
        
        banners.forEach((banner, index) => {
            // Create the banner object in the exact format required
            jsonOutput[banner.id] = {
                clickRedirectUrl: banner.clickRedirectUrl || "",
                creationTimestamp: banner.creationTimestamp,
                id: banner.id,
                isActive: banner.isActive,
                order: index, // Set order based on index
                updateTimestamp: banner.updateTimestamp,
                url: banner.url,
                expirationTimestamp: banner.expirationTimestamp || "", // Keep empty if not set
                targetDealId: banner.targetDealId || "",
                platform: banner.platform || "" // Add platform field
            };
        });
        
        return jsonOutput;
    }
}

// Export the class and a convenience function
module.exports = {
    ImprovedBannerExtractor,
    async extractBanners() {
        const extractor = new ImprovedBannerExtractor();
        return await extractor.runBannerExtraction();
    }
};
