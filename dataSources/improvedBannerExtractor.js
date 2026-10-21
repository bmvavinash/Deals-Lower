const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('../config/bannerConfig');
const { ImprovedBannerValidator } = require('../utils/improvedBannerValidator');
const { classifyBanner } = require('../utils/bannerCategorizer');
const { getModuleLogger } = require('../logger/logger');
const { bannerDB } = require('../database/firebaseDB/bannerDB');

const logger = getModuleLogger('improvedBannerExtractor');

function parseTimerText(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().replace(/ends\s*in|ending\s*in/i, '').trim();
    const parts = clean.match(/(\d+)\s*(?:d|day|days)?\s*:\s*(\d+)\s*(?:h|hour|hours)?\s*:\s*(\d+)\s*(?:m|minute|minutes)?(?:\s*:\s*(\d+)\s*(?:s|second|seconds)?)?/i);
    if (parts) {
        let days = 0, hours = 0, minutes = 0, seconds = 0;
        if (parts[4] !== undefined) {
            days = parseInt(parts[1], 10) || 0;
            hours = parseInt(parts[2], 10) || 0;
            minutes = parseInt(parts[3], 10) || 0;
            seconds = parseInt(parts[4], 10) || 0;
        } else {
            const colons = clean.split(':').map(s => parseInt(s.trim(), 10) || 0);
            if (colons.length === 3) {
                hours = colons[0];
                minutes = colons[1];
                seconds = colons[2];
            } else if (colons.length === 2) {
                hours = colons[0];
                minutes = colons[1];
            }
        }
        const totalMs = (days * 24 * 3600 + hours * 3600 + minutes * 60 + seconds) * 1000;
        if (totalMs > 0) return Date.now() + totalMs;
    }
    const hrMatch = clean.match(/(\d+)\s*(?:h|hour|hours)/);
    const minMatch = clean.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
    const secMatch = clean.match(/(\d+)\s*(?:s|sec|secs|second|seconds)/);
    let totalMs = 0;
    if (hrMatch) totalMs += parseInt(hrMatch[1], 10) * 3600 * 1000;
    if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60 * 1000;
    if (secMatch) totalMs += parseInt(secMatch[1], 10) * 1000;
    if (totalMs > 0) return Date.now() + totalMs;
    return null;
}

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
     * Search ancestral DOM tree of element for ticking countdown timers
     */
    async findBannerTimer(element) {
        if (!this.driver || !element) return null;
        try {
            const timerText = await this.driver.executeScript((el) => {
                let parent = el.parentElement;
                const timerPattern = /ends\s*in|\d+\s*h\s*:\s*\d+\s*m|\d{2}\s*:\s*\d{2}\s*:\s*\d{2}/i;
                for (let i = 0; i < 6 && parent; i++) {
                    const text = parent.innerText || '';
                    if (timerPattern.test(text)) {
                        const walk = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while (node = walk.nextNode()) {
                            const val = node.nodeValue;
                            if (val && timerPattern.test(val)) {
                                return val.trim();
                            }
                        }
                    }
                    parent = parent.parentElement;
                }
                return null;
            }, element);
            
            if (timerText) {
                logger.info(`🕒 [TIMER DISCOVERY] Found nearby timer on homepage: "${timerText}"`);
                return timerText;
            }
        } catch (e) {
            logger.debug('Error searching for nearby timer:', { error: e.message });
        }
        return null;
    }

    /**
     * Check if a TCP port is open
     * @param {number} port
     * @returns {Promise<boolean>}
     */
    checkPortOpen(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();
            socket.setTimeout(800);
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.once('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
    }

    /**
     * Initialize driver with Chrome browser on port 9222
     */
    async initializeDriver() {
        try {
            logger.info(`Checking if Chrome browser is running on port ${this.chromePort}...`);
            const isPortOpen = await this.checkPortOpen(this.chromePort);
            
            if (!isPortOpen) {
                logger.info(`Port ${this.chromePort} not open, immediately initializing new headless Chrome instance`);
                await this.initializeNewDriver();
                return;
            }

            logger.info(`Connecting to Chrome browser on port ${this.chromePort}`);
            const options = new chrome.Options();
            options.debuggerAddress(`127.0.0.1:${this.chromePort}`);

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            this.isRemoteChrome = true;
            logger.info('Successfully connected to Chrome browser on port 9222');
        } catch (error) {
            logger.error('Failed to connect to Chrome browser on port 9222:', { error: error.message });
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
            options.addArguments('--headless=new');
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=450,850');
            options.addArguments('--user-agent=Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            this.isRemoteChrome = false;
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
                if (!this.isRemoteChrome) {
                    await this.driver.quit();
                } else {
                    logger.info('Remote Chrome browser on port 9222 kept alive (not terminating user browser)');
                }
                this.driver = null;
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
            let retries = 1;
            while (retries >= 0) {
                try {
                    logger.info(`Processing URL: ${url}`);
                    this.currentUrl = url;
                    await this.driver.get(url);
                    
                    // Wait for page to load completely
                    await this.driver.wait(until.elementLocated(By.css('body')), 15000);
                    
                    // Dismiss login overlay on Flipkart
                    if (platformKey === 'flipkart') {
                        try {
                            const { Key } = require('selenium-webdriver');
                            await this.driver.findElement(By.css('body')).sendKeys(Key.ESCAPE);
                            await this.driver.sleep(1000);
                        } catch (e) {
                            logger.debug('Flipkart login modal dismiss skipped:', { error: e.message });
                        }
                    }
                    
                    // Additional wait for dynamic content
                    await this.driver.sleep(5000);
                    
                    // Extract banners from this URL
                    const urlBanners = await this.extractBannersFromUrl(platformKey, selectors, validation, url);
                    banners.push(...urlBanners);
                    
                    logger.info(`Extracted ${urlBanners.length} quality banners from ${url}`);
                    
                    // Stop if we reached target banners
                    if (banners.length >= this.maxBannersPerPlatform) {
                        logger.info(`Reached maximum banners limit (${this.maxBannersPerPlatform}) for ${platformKey}, skipping remaining URLs`);
                        break;
                    }
                    
                    logger.debug(`Processed ${url}, total banners so far: ${banners.length}`);
                    break; // Success, exit retry loop
                } catch (error) {
                    const isSessionError = error.message.includes('invalid session id') || 
                                           error.message.includes('disconnected') || 
                                           error.message.includes('no such session') ||
                                           error.message.includes('chrome not reachable') ||
                                           error.message.includes('ECONNREFUSED') ||
                                           error.message.includes('ECONNRESET');
                    
                    if (isSessionError && retries > 0) {
                        logger.warn(`Driver session crashed/invalidated during get(${url}) on improved extractor. Re-initializing driver and retrying...`, {
                            error: error.message
                        });
                        try {
                            await this.closeDriver();
                        } catch (_) {}
                        try {
                            await this.initializeDriver();
                        } catch (initErr) {
                            logger.error('Failed to re-initialize driver during recovery:', { error: initErr.message });
                            throw error;
                        }
                        retries--;
                    } else {
                        logger.error(`Error extracting banners from ${url}:`, { 
                            error: error.message, 
                            platform: platformKey 
                        });
                        break;
                    }
                }
            }
            if (banners.length >= this.maxBannersPerPlatform) {
                break;
            }
            }
        }

        // Sort by priority and limit to maxBannersPerPlatform
        const sortedBanners = banners
            .sort((a, b) => (a.priority || 4) - (b.priority || 4))
            .slice(0, this.maxBannersPerPlatform || 15);

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

                    if (bannerLinks.length === 0) {
                        bannerLinks = await carouselElement.findElements(By.css('a[href]'));
                    }
                    
                    logger.debug(`Found ${bannerLinks.length} banner links in carousel`);

                    // If still no links found in carousel, process images inside carousel directly
                    if (bannerLinks.length === 0) {
                        const carouselImages = await carouselElement.findElements(By.css('img'));
                        logger.debug(`Processing ${carouselImages.length} images directly from carousel`);
                        for (const imgEl of carouselImages) {
                            try {
                                const banner = await this.extractBannerFromImageElement(
                                    imgEl,
                                    platformKey,
                                    selectors,
                                    validation
                                );
                                if (banner && banner.isValid) {
                                    banners.push(banner);
                                    logger.debug(`Successfully extracted carousel image banner: ${banner.id}`);
                                }
                            } catch (e) {
                                logger.debug(`Error extracting carousel image:`, { error: e.message });
                            }
                        }
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
     * Check if a URL is just a generic homepage or invalid redirect
     * @param {string} url - URL to check
     * @param {string} platformKey - Platform identifier
     * @returns {boolean} True if URL is homepage or invalid
     */
    isHomePageUrl(url, platformKey) {
        if (!url || typeof url !== 'string') return true;
        const trimmed = url.trim();
        if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:') || trimmed.startsWith('about:')) return true;
        try {
            const parsed = new URL(trimmed);
            const path = parsed.pathname.replace(/\/+$/, '');
            if (path === '' || path === '/') {
                if (!parsed.search || parsed.search === '?ref_=nav_logo' || parsed.search === '?ref_=nav_header') {
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Extract the actual target webpage redirect URL from an element (image or link or container)
     * On click of banner it redirects to this webpage
     * @param {Object} element - WebElement (img, a, div, etc.)
     * @param {string} platformKey - Platform identifier
     * @returns {Promise<string>} The destination webpage URL when banner is clicked
     */
    async extractRedirectUrl(element, platformKey) {
        try {
            const baseUrl = bannerConfig.platforms[platformKey]?.baseUrl || `https://www.${platformKey}.com`;
            
            // Execute in-browser script to inspect the DOM hierarchy around the element
            const rawUrl = await this.driver.executeScript(`
                var el = arguments[0];
                if (!el) return null;

                function isValid(u) {
                    if (!u || typeof u !== 'string') return false;
                    u = u.trim();
                    if (!u || u === '#' || u.startsWith('javascript:') || u === 'about:blank' || u.startsWith('mailto:')) return false;
                    return true;
                }

                function isHome(u) {
                    if (!isValid(u)) return false;
                    try {
                        var parsed = new URL(u, window.location.origin);
                        var path = parsed.pathname.replace(/\\/+$/, '');
                        if (path === '' || path === '/') {
                            if (!parsed.search || parsed.search === '?ref_=nav_logo' || parsed.search === '?ref_=nav_header') {
                                return true;
                            }
                        }
                        return false;
                    } catch(e) {
                        return false;
                    }
                }

                function clean(u) {
                    if (!isValid(u)) return null;
                    try {
                        return new URL(u, window.location.origin).href;
                    } catch(e) {
                        return u;
                    }
                }

                // 1. If el is itself an <a> tag
                if (el.tagName && el.tagName.toLowerCase() === 'a') {
                    var href = el.getAttribute('href') || el.href;
                    var full = clean(href);
                    if (full && !isHome(full)) return full;
                }

                // 2. Check closest enclosing <a> tag (parent, grandparent, etc.)
                var closestA = el.closest ? el.closest('a') : null;
                if (closestA) {
                    var href2 = closestA.getAttribute('href') || closestA.href;
                    var full2 = clean(href2);
                    if (full2 && !isHome(full2)) return full2;
                }

                // 3. Check data attributes on el and its ancestors (up to 6 levels)
                var curr = el;
                for (var i = 0; i < 6; i++) {
                    if (!curr || curr === document.body) break;
                    var d = curr.getAttribute('data-href') || 
                            curr.getAttribute('data-url') || 
                            curr.getAttribute('data-link') || 
                            curr.getAttribute('data-target') || 
                            curr.getAttribute('data-target-url') ||
                            curr.getAttribute('data-landing-url') ||
                            curr.getAttribute('data-destination') ||
                            curr.getAttribute('data-action-url');
                    if (d) {
                        var fullD = clean(d);
                        if (fullD && !isHome(fullD)) return fullD;
                    }

                    // Check onclick attribute
                    var oc = curr.getAttribute('onclick') || '';
                    if (oc) {
                        var match = oc.match(/(?:href|open|location|navigate)\\s*(?:=|\\()\\s*['"]([^'"]+)['"]/);
                        if (match && match[1]) {
                            var fullOc = clean(match[1]);
                            if (fullOc && !isHome(fullOc)) return fullOc;
                        }
                    }

                    curr = curr.parentElement;
                }

                // 4. Look inside enclosing slide/card/banner/carousel container for anchor tags
                var container = el.closest ? el.closest('[class*="slide"], [class*="card"], [class*="banner"], [class*="carousel"], [class*="item"], [class*="promo"], [class*="hero"], [class*="widget"], li, section') : null;
                if (container) {
                    var links = container.querySelectorAll('a[href]');
                    for (var j = 0; j < links.length; j++) {
                        var lHref = links[j].getAttribute('href') || links[j].href;
                        var fullL = clean(lHref);
                        if (fullL && !isHome(fullL)) return fullL;
                    }
                }

                // 5. Look in parent element for any anchor tags
                if (el.parentElement) {
                    var pLinks = el.parentElement.querySelectorAll('a[href]');
                    for (var k = 0; k < pLinks.length; k++) {
                        var plHref = pLinks[k].getAttribute('href') || pLinks[k].href;
                        var fullPL = clean(plHref);
                        if (fullPL && !isHome(fullPL)) return fullPL;
                    }
                }

                // 6. Closest anchor if not homepage
                if (closestA) {
                    var lastHref = closestA.getAttribute('href') || closestA.href;
                    var lastFull = clean(lastHref);
                    if (lastFull && !isHome(lastFull)) return lastFull;
                }

                return null;
            `, element);

            if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
                const resolved = new URL(rawUrl.trim(), baseUrl).href;
                if (!this.isHomePageUrl(resolved, platformKey)) {
                    logger.debug(`Extracted target redirect URL: ${resolved} for platform: ${platformKey}`);
                    return resolved;
                }
            }
        } catch (error) {
            logger.debug(`Error extracting redirect URL from element:`, { error: error.message });
        }
        
        return null;
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
            // Extract destination redirect URL on click
            let clickRedirectUrl = await this.extractRedirectUrl(element, platformKey);
            logger.debug(`Found destination redirect URL: ${clickRedirectUrl}`);
            
            // Find image element within the link
            let imageElement;
            try {
                imageElement = await element.findElement(By.css(selectors.bannerImage));
            } catch (error) {
                if (selectors.alternativeBannerImage) {
                    try {
                        imageElement = await element.findElement(By.css(selectors.alternativeBannerImage));
                    } catch (altError) {
                        try {
                            imageElement = await element.findElement(By.css('img'));
                        } catch (imgErr) {
                            logger.debug(`No image found in link element`);
                            return null;
                        }
                    }
                } else {
                    try {
                        imageElement = await element.findElement(By.css('img'));
                    } catch (imgErr) {
                        return null;
                    }
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

            // If destination link from element is generic homepage, try inspecting around imageElement
            if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                const imgRedirect = await this.extractRedirectUrl(imageElement, platformKey);
                if (imgRedirect && !this.isHomePageUrl(imgRedirect, platformKey)) {
                    clickRedirectUrl = imgRedirect;
                    logger.debug(`Upgraded generic link to image redirect URL: ${clickRedirectUrl}`);
                }
            }

            if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                logger.debug(`Skipping banner link element because no non-homepage destination redirect URL found`);
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
            
            // Get layout type and priority
            const layoutType = this.validator.getBannerCategory(bannerData);
            const isAffiliatePortal = this.currentUrl && this.currentUrl.includes('affiliate-program.amazon.in');
            const assignedBannerType = isAffiliatePortal ? 'hero' : layoutType.category;
            const assignedPriority = isAffiliatePortal ? 1 : layoutType.priority;

            let finalRedirectUrl = clickRedirectUrl;
            if (platformKey === 'amazon' && finalRedirectUrl && !finalRedirectUrl.includes('tag=dealshubglo0c-21')) {
                try {
                    const parsedUrl = new URL(finalRedirectUrl);
                    parsedUrl.searchParams.set('tag', 'dealshubglo0c-21');
                    finalRedirectUrl = parsedUrl.href;
                } catch (_) {}
            }

            // Auto-classify into canonical ecommerce category & subcategory
            const classification = classifyBanner({
                title: altText,
                description: altText,
                clickRedirectUrl: finalRedirectUrl,
                url: imageUrl
            });

            // Generate banner data in the required format
            const bannerId = this.generateBannerId(platformKey, classification.category);
            const timestamp = this.generateBannerTimestamp();
            
            let expirationTimestamp = "";
            try {
                const nearbyTimerText = await this.findBannerTimer(imageElement);
                if (nearbyTimerText) {
                    const parsedExpiry = parseTimerText(nearbyTimerText);
                    if (parsedExpiry) {
                        expirationTimestamp = new Date(parsedExpiry).toISOString();
                        logger.info(`🕒 [BANNER TIMER] Set expiration for banner ${bannerId} to ${expirationTimestamp}`);
                    }
                }
            } catch (timerErr) {
                logger.warn('Failed to scan nearby banner timer', { error: timerErr.message });
            }

            const banner = {
                id: bannerId,
                url: imageUrl,
                clickRedirectUrl: finalRedirectUrl,
                isActive: true,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                expirationTimestamp: expirationTimestamp,
                targetDealId: "",
                platform: platformKey,
                category: classification.category,
                subcategory: classification.subcategory,
                bannerType: assignedBannerType,
                priority: assignedPriority,
                title: classification.title || altText || 'Banner',
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

            // Extract the actual target destination webpage URL on click!
            const clickRedirectUrl = await this.extractRedirectUrl(imageElement, platformKey);
            logger.debug(`Found clickRedirectUrl for image: ${clickRedirectUrl}`);

            if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                logger.debug(`Skipping direct image banner because no non-homepage destination redirect URL found`);
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
            const isAffiliatePortal = this.currentUrl && this.currentUrl.includes('affiliate-program.amazon.in');
            const assignedCategory = isAffiliatePortal ? 'hero' : category.category;
            const assignedPriority = isAffiliatePortal ? 1 : category.priority;
            
            // Generate banner data in the required format
            const bannerId = this.generateBannerId(platformKey, assignedCategory);
            const timestamp = this.generateBannerTimestamp();

            let finalRedirectUrl = clickRedirectUrl;
            if (platformKey === 'amazon' && finalRedirectUrl && !finalRedirectUrl.includes('tag=dealshubglo0c-21')) {
                try {
                    const parsedUrl = new URL(finalRedirectUrl);
                    parsedUrl.searchParams.set('tag', 'dealshubglo0c-21');
                    finalRedirectUrl = parsedUrl.href;
                } catch (_) {}
            }
            
            let expirationTimestamp = "";
            try {
                const nearbyTimerText = await this.findBannerTimer(imageElement);
                if (nearbyTimerText) {
                    const parsedExpiry = parseTimerText(nearbyTimerText);
                    if (parsedExpiry) {
                        expirationTimestamp = new Date(parsedExpiry).toISOString();
                        logger.info(`🕒 [BANNER TIMER] Set expiration for banner ${bannerId} to ${expirationTimestamp}`);
                    }
                }
            } catch (timerErr) {
                logger.warn('Failed to scan nearby banner timer', { error: timerErr.message });
            }

            const banner = {
                id: bannerId,
                url: imageUrl,
                clickRedirectUrl: finalRedirectUrl,
                isActive: true,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                expirationTimestamp: expirationTimestamp,
                targetDealId: "",
                platform: platformKey,
                category: assignedCategory,
                priority: assignedPriority,
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
            // await this.deactivateOldBanners(activeBannerIds);
            
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
