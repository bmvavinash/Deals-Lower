const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('../config/bannerConfig');
const EnhancedBannerUtils = require('../utils/enhancedBannerUtils');
const { getModuleLogger } = require('../logger/logger');
const { testBannerDB } = require('../database/firebaseDB/bannerDB');
const { bannerUrlFixer } = require('../services/bannerUrlFixer');

const logger = getModuleLogger('enhancedBannerExtractor');

class EnhancedBannerExtractor {
    constructor() {
        this.driver = null;
        this.extractedBanners = [];
        this.chromePort = 9222;
    }

    async initializeDriver() {
        try {
            // Connect to existing Chrome browser on port 9222
            const options = new chrome.Options();
            options.addArguments(`--remote-debugging-port=${this.chromePort}`);
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');
            
            // Connect to existing Chrome instance
            options.debuggerAddress(`localhost:${this.chromePort}`);

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            logger.info('Enhanced banner extractor connected to existing Chrome browser successfully');
        } catch (error) {
            logger.error('Failed to connect to existing Chrome browser:', { error: error.message });
            throw error;
        }
    }

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

    async closeDriver() {
        if (this.driver) {
            try {
                await this.driver.quit();
                logger.info('Enhanced banner extractor driver closed successfully');
            } catch (error) {
                logger.error('Error closing driver:', { error: error.message });
            }
        }
    }

    async extractBannersFromPlatform(platformKey, platformConfig) {
        const banners = [];
        const { name, bannerUrls, selectors, validation } = platformConfig;

        logger.info(`Starting enhanced banner extraction for ${name}`, { platform: platformKey });

        for (const url of bannerUrls) {
            try {
                logger.debug(`Extracting banners from: ${url}`);
                await this.driver.get(url);
                
                // Wait for page to load
                await this.driver.wait(until.elementLocated(By.css('body')), 15000);
                
                // Additional wait for dynamic content
                await this.driver.sleep(3000);
                
                // Extract banners from this URL
                const urlBanners = await this.extractBannersFromUrl(platformKey, selectors, validation, url);
                banners.push(...urlBanners);
                
                logger.info(`Extracted ${urlBanners.length} quality banners from ${url}`);
                
            } catch (error) {
                logger.error(`Error extracting banners from ${url}:`, { 
                    error: error.message, 
                    platform: platformKey 
                });
            }
        }

        return banners;
    }

    async extractBannersFromUrl(platformKey, selectors, validation, sourceUrl) {
        const banners = [];
        
        try {
            // Try multiple selector strategies for Amazon affiliate page
            let carouselElements = [];
            
            // Strategy 1: Try primary carousel selector
            try {
                carouselElements = await this.driver.findElements(By.css(selectors.carousel));
                logger.debug(`Found ${carouselElements.length} carousel elements with primary selector`);
            } catch (error) {
                logger.debug('Primary selector failed, trying alternatives');
            }
            
            // Strategy 2: Try alternative carousel selector
            if (carouselElements.length === 0 && selectors.alternativeCarousel) {
                try {
                    carouselElements = await this.driver.findElements(By.css(selectors.alternativeCarousel));
                    logger.debug(`Found ${carouselElements.length} carousel elements with alternative selector`);
                } catch (error) {
                    logger.debug('Alternative selector failed');
                }
            }
            
            // Strategy 3: Try broader carousel selectors for Amazon affiliate
            if (carouselElements.length === 0) {
                try {
                    // Try multiple carousel selectors for Amazon affiliate page
                    const selectorsToTry = [
                        'li.a-carousel-card',
                        '.a-carousel-card',
                        '[aria-roledescription="slide"]',
                        '.a-carousel li',
                        'ol.a-carousel li'
                    ];
                    
                    for (const selector of selectorsToTry) {
                        try {
                            carouselElements = await this.driver.findElements(By.css(selector));
                            if (carouselElements.length > 0) {
                                logger.debug(`Found ${carouselElements.length} elements with selector: ${selector}`);
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                } catch (error) {
                    logger.debug('Broad selector strategy failed');
                }
            }
            
            // Strategy 4: Try to find any image elements with links
            if (carouselElements.length === 0) {
                try {
                    const imageLinks = await this.driver.findElements(By.css('a img[src*="media-amazon.com"]'));
                    logger.debug(`Found ${imageLinks.length} image links with media-amazon.com`);
                    
                    // Convert image links to carousel-like elements for processing
                    for (const imgLink of imageLinks) {
                        try {
                            const parentLink = await imgLink.findElement(By.xpath('..'));
                            if (parentLink) {
                                carouselElements.push(parentLink);
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                } catch (error) {
                    logger.debug('Image link strategy failed');
                }
            }
            
            logger.info(`Total elements found for processing: ${carouselElements.length}`);
            
            // Pre-filter elements to exclude obvious non-banners
            const filteredElements = [];
            for (const element of carouselElements) {
                try {
                    // Check if element contains an image
                    const hasImage = await element.findElements(By.css('img')).then(imgs => imgs.length > 0);
                    if (!hasImage) continue;
                    
                    // Get image details for pre-filtering
                    const imgElement = await element.findElement(By.css('img'));
                    const imgSrc = await imgElement.getAttribute('src') || '';
                    const imgAlt = await imgElement.getAttribute('alt') || '';
                    
                    // Skip obvious non-banner images
                    if (this.isObviousNonBanner(imgSrc, imgAlt)) {
                        logger.debug(`Skipping obvious non-banner: ${imgAlt} (${imgSrc})`);
                        continue;
                    }
                    
                    filteredElements.push(element);
                } catch (error) {
                    logger.debug('Error pre-filtering element:', error.message);
                }
            }
            
            logger.info(`Elements after pre-filtering: ${filteredElements.length}`);
            
            // Process each filtered element
            for (let i = 0; i < filteredElements.length; i++) {
                try {
                    const element = filteredElements[i];
                    const banner = await this.extractBannerFromElement(element, platformKey, selectors, validation, sourceUrl, i);
                    
                    if (banner) {
                        banners.push(banner);
                        logger.debug(`Valid banner extracted: ${banner.id}`);
                    }
                    
                    // Limit banners per URL to avoid too many
                    if (banners.length >= 8) {
                        logger.info(`Reached banner limit (8) for ${sourceUrl}`);
                        break;
                    }
                    
                } catch (error) {
                    logger.debug(`Error processing carousel element ${i}:`, { error: error.message });
                }
            }
            
        } catch (error) {
            logger.error(`Error extracting banners from URL ${sourceUrl}:`, { error: error.message });
        }
        
        return banners;
    }

    // Helper method to identify obvious non-banner images
    isObviousNonBanner(imgSrc, imgAlt) {
        if (!imgSrc) return true;
        
        const src = imgSrc.toLowerCase();
        const alt = (imgAlt || "").toLowerCase();
        
        // Skip small images, flags, icons
        const nonBannerPatterns = [
            /\.gif$/i,
            /flag/i,
            /icon/i,
            /logo/i,
            /network/i,
            /associate/i,
            /_V\d+_/i, // Version patterns
            /ssl-images/i,
            /images-eu/i
        ];
        
        // Check URL patterns
        const hasNonBannerPattern = nonBannerPatterns.some(pattern => 
            pattern.test(src)
        );
        
        // Check alt text
        const hasNonBannerText = alt.includes('flag') || 
                                alt.includes('icon') || 
                                alt.includes('logo') ||
                                alt.includes('network') ||
                                alt.includes('whatsapp') ||
                                alt.includes('channel');
        
        return hasNonBannerPattern || hasNonBannerText;
    }

    async extractBannerFromElement(element, platformKey, selectors, validation, sourceUrl, index) {
        try {
            // Extract link URL
            let clickRedirectUrl = '';
            try {
                // Try to get href from the element itself if it's a link
                const tagName = await element.getTagName();
                if (tagName === 'a') {
                    clickRedirectUrl = await element.getAttribute('href');
                } else {
                    // Find link element within
                    const linkElement = await element.findElement(By.css('a'));
                    clickRedirectUrl = await linkElement.getAttribute('href');
                }
            } catch (error) {
                // Element might not have a link
                logger.debug(`No link found for element ${index}`);
            }
            
            // Find image element
            let imageElement;
            try {
                imageElement = await element.findElement(By.css('img'));
            } catch (error) {
                // Try to find image in parent elements
                try {
                    imageElement = await element.findElement(By.css('img'));
                } catch (altError) {
                    logger.debug(`No image found for element ${index}:`, { error: altError.message });
                    return null;
                }
            }
            
            const imageUrl = await imageElement.getAttribute('src');
            const altText = await imageElement.getAttribute('alt');
            const title = await imageElement.getAttribute('title');
            
            logger.debug(`Found image: ${imageUrl}, alt: ${altText}, title: ${title}`);
            
            // Get element context for better validation
            const elementContext = await this.getElementContext(element);
            
            // Enhanced validation using our new utility
            const validationResult = EnhancedBannerUtils.validateBanner(
                altText, title, clickRedirectUrl, imageUrl, elementContext
            );
            
            if (!validationResult.isValid) {
                logger.debug(`Banner validation failed for element ${index}:`, { 
                    reasons: validationResult.reasons,
                    score: validationResult.score
                });
                return null;
            }
            
            // Generate banner ID
            const bannerId = EnhancedBannerUtils.generateBannerId(platformKey, sourceUrl, index);
            
            // Create banner object
            const banner = {
                id: bannerId,
                url: imageUrl,
                clickRedirectUrl: clickRedirectUrl,
                altText: altText,
                title: title,
                platform: platformKey,
                sourceUrl: sourceUrl,
                category: validationResult.category,
                validationScore: validationResult.score,
                validationReasons: validationResult.reasons,
                isActive: true,
                order: index,
                creationTimestamp: new Date().toISOString(),
                updateTimestamp: new Date().toISOString(),
                metadata: {
                    elementType: await element.getTagName() || 'unknown',
                    elementClasses: await element.getAttribute('class') || '',
                    elementId: await element.getAttribute('id') || '',
                    parentContext: elementContext
                }
            };
            
            return banner;
            
        } catch (error) {
            logger.error(`Error extracting banner from element ${index}:`, { error: error.message });
            return null;
        }
    }

    async getElementContext(element) {
        try {
            // Get parent element context
            const parent = await element.findElement(By.xpath('..'));
            const parentClasses = await parent.getAttribute('class') || '';
            const parentId = await parent.getAttribute('id') || '';
            const parentTag = await parent.getTagName() || '';
            
            return `${parentTag}${parentId ? '#' + parentId : ''}${parentClasses ? '.' + parentClasses.split(' ').join('.') : ''}`;
        } catch (error) {
            return 'unknown-context';
        }
    }

    async extractAllBanners() {
        try {
            await this.initializeDriver();
            
            const allBanners = [];
            const platforms = bannerConfig.platforms;
            
            for (const [platformKey, platformConfig] of Object.entries(platforms)) {
                try {
                    logger.info(`Starting extraction for platform: ${platformKey}`);
                    const platformBanners = await this.extractBannersFromPlatform(platformKey, platformConfig);
                    allBanners.push(...platformBanners);
                    
                    logger.info(`Completed extraction for ${platformKey}: ${platformBanners.length} banners`);
                    
                } catch (error) {
                    logger.error(`Error extracting from platform ${platformKey}:`, { error: error.message });
                }
            }
            
            // Store banners in Firebase
            if (allBanners.length > 0) {
                const storeResult = await testBannerDB.storeMultipleTestBanners(allBanners);
                logger.info(`Stored ${allBanners.length} banners in test-banners node`);
                
                return {
                    extracted: allBanners.length,
                    stored: storeResult.filter(r => r.status === 200 || r.status === 201).length,
                    banners: allBanners,
                    storeResults: storeResult
                };
            } else {
                logger.warn('No banners extracted from any platform');
                return { extracted: 0, stored: 0, banners: [], storeResults: [] };
            }
            
        } catch (error) {
            logger.error('Error in banner extraction process:', { error: error.message });
            throw error;
        } finally {
            await this.closeDriver();
        }
    }

    async extractBannersFromAmazonAffiliate() {
        try {
            await this.initializeDriver();
            
            const amazonConfig = bannerConfig.platforms.amazon;
            const affiliateUrl = 'https://affiliate-program.amazon.in/home';
            
            logger.info('Starting Amazon affiliate program banner extraction');
            
            await this.driver.get(affiliateUrl);
            await this.driver.wait(until.elementLocated(By.css('body')), 15000);
            await this.driver.sleep(5000); // Wait for dynamic content
            
            // Extract banners using Amazon-specific selectors
            const banners = await this.extractBannersFromUrl('amazon', amazonConfig.selectors, amazonConfig.validation, affiliateUrl);
            
            // Store in Firebase
            if (banners.length > 0) {
                const storeResult = await testBannerDB.storeMultipleTestBanners(banners);
                logger.info(`Stored ${banners.length} Amazon affiliate banners in test-banners node`);
                
                return {
                    extracted: banners.length,
                    stored: storeResult.filter(r => r.status === 200 || r.status === 201).length,
                    banners: banners,
                    storeResults: storeResult
                };
            } else {
                logger.warn('No Amazon affiliate banners extracted');
                return { extracted: 0, stored: 0, banners: [], storeResults: [] };
            }
            
        } catch (error) {
            logger.error('Error extracting Amazon affiliate banners:', { error: error.message });
            throw error;
        } finally {
            await this.closeDriver();
        }
    }

    async extractBannersFromAmazonWebsite() {
        try {
            // Use new driver for Amazon website (no login required)
            await this.initializeNewDriver();
            
            const amazonConfig = bannerConfig.platforms.amazon;
            const websiteUrls = [
                'https://www.amazon.in',
                'https://www.amazon.in/deals',
                'https://www.amazon.in/events/greatfreedomsale'
            ];
            
            logger.info('Starting Amazon website banner extraction (no login required)');
            
            const allBanners = [];
            
            for (const url of websiteUrls) {
                try {
                    logger.info(`Extracting from: ${url}`);
                    await this.driver.get(url);
                    await this.driver.wait(until.elementLocated(By.css('body')), 15000);
                    await this.driver.sleep(3000);
                    
                    const urlBanners = await this.extractBannersFromUrl('amazon', amazonConfig.selectors, amazonConfig.validation, url);
                    allBanners.push(...urlBanners);
                    
                    logger.info(`Extracted ${urlBanners.length} banners from ${url}`);
                    
                } catch (error) {
                    logger.error(`Error extracting from ${url}:`, { error: error.message });
                }
            }
            
            // Fix URLs for banners if enabled
            let processedBanners = allBanners;
            if (allBanners.length > 0) {
                logger.info('Starting banner URL verification and fixing...');
                processedBanners = await bannerUrlFixer.fixBannerUrls(allBanners);
                
                const urlFixStats = bannerUrlFixer.getStatistics();
                logger.info('Banner URL fixing completed', {
                    total: urlFixStats.total,
                    fixed: urlFixStats.fixed,
                    errors: urlFixStats.errors,
                    skipped: urlFixStats.skipped
                });
            }
            
            // Store in Firebase
            if (processedBanners.length > 0) {
                const storeResult = await testBannerDB.storeMultipleTestBanners(processedBanners);
                logger.info(`Stored ${processedBanners.length} Amazon website banners in test-banners node`);
                
                return {
                    extracted: allBanners.length,
                    stored: storeResult.filter(r => r.status === 200 || r.status === 201).length,
                    banners: processedBanners,
                    storeResults: storeResult
                };
            } else {
                logger.warn('No Amazon website banners extracted');
                return { extracted: 0, stored: 0, banners: [], storeResults: [] };
            }
            
        } catch (error) {
            logger.error('Error extracting Amazon website banners:', { error: error.message });
            throw error;
        } finally {
            await this.closeDriver();
        }
    }
}

module.exports = { EnhancedBannerExtractor };
