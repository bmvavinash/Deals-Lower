const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const bannerConfig = require('../config/bannerConfig');
const { 
    generateBannerId,
    generateBannerTimestamp,
    isProductCarousel
} = require('../utils/commonUtils');
const { ImprovedBannerValidator } = require('../utils/improvedBannerValidator');
const { getModuleLogger } = require('../logger/logger');
const { bannerDB } = require('../database/firebaseDB/bannerDB');
const { bannerUrlFixer } = require('../services/bannerUrlFixer');

const logger = getModuleLogger('bannerExtractor');

class BannerExtractor {
    constructor(options = {}) {
        this.driver = null;
        this.extractedBanners = [];
        this.validator = new ImprovedBannerValidator();
        // For banner extraction, always use normal headless browser (no login needed)
        // Only use existing Chrome if explicitly requested AND requires login
        // Banners don't need login, so default to false
        this.useExistingChrome = options.useExistingChrome === true && options.requiresLogin === true;
        this.debuggerAddress = options.debuggerAddress || process.env.DEBUGGER_ADDRESS || '127.0.0.1:9222';
        // Store default visibility setting
        this.defaultVisibility = options.visibility !== undefined 
            ? options.visibility 
            : (bannerConfig.global.defaultVisibility !== undefined 
                ? bannerConfig.global.defaultVisibility 
                : false);
    }

    /**
     * Start Chrome with remote debugging if needed (for login scenarios)
     * For banners, this should not be needed as no login is required
     */
    async startChromeDebuggerIfNeeded() {
        if (!this.useExistingChrome) {
            return false; // Not needed for headless mode
        }

        const { spawn } = require('child_process');
        const http = require('http');
        const fs = require('fs');
        
        // Check if Chrome debugger is already running
        return new Promise((resolve) => {
            const checkConnection = () => {
                const req = http.get('http://127.0.0.1:9222/json', { timeout: 1000 }, (res) => {
                    resolve(true); // Chrome debugger is running
                });
                req.on('error', () => {
                    // Chrome debugger not running, try to start it
                    logger.info('Chrome debugger not running, attempting to start it...');
                    const os = require('os');
                    const platform = os.platform();
                    let chromePath = process.env.CHROME_PATH;
                    if (!chromePath) {
                        if (platform === 'win32') {
                            const possiblePaths = [
                                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                                path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
                            ];
                            for (const p of possiblePaths) {
                                if (fs.existsSync(p)) {
                                    chromePath = p;
                                    break;
                                }
                            }
                        } else if (platform === 'darwin') {
                            chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                        } else {
                            const possiblePaths = [
                                '/usr/bin/google-chrome',
                                '/usr/bin/chromium-browser',
                                '/usr/bin/chromium'
                            ];
                            for (const p of possiblePaths) {
                                if (fs.existsSync(p)) {
                                    chromePath = p;
                                    break;
                                }
                            }
                        }
                    }
                    if (!chromePath) {
                        chromePath = platform === 'win32' ? 'chrome.exe' : 'google-chrome';
                    }

                    let userDataDir = process.env.CHROME_USER_DATA;
                    if (!userDataDir) {
                        userDataDir = platform === 'win32' ? 'C:\\selenum\\ChromeProfile' : path.join(os.homedir(), '.selenium/ChromeProfile');
                    }
                    
                    if (fs.existsSync(chromePath)) {
                        const args = [
                            '--remote-debugging-port=9222',
                            `--user-data-dir="${userDataDir}"`,
                            '--no-first-run',
                            '--no-default-browser-check'
                        ];
                        
                        spawn(chromePath, args, {
                            detached: true,
                            stdio: 'ignore',
                            shell: false
                        }).unref();
                        
                        logger.info('Chrome started with debugger, waiting for connection...');
                        setTimeout(() => {
                            const retryReq = http.get('http://127.0.0.1:9222/json', { timeout: 2000 }, () => {
                                logger.info('Chrome debugger is now accessible');
                                resolve(true);
                            });
                            retryReq.on('error', () => {
                                logger.warn('Chrome debugger still not accessible, falling back to headless mode');
                                this.useExistingChrome = false; // Fallback to headless
                                resolve(false);
                            });
                        }, 3000);
                    } else {
                        logger.warn('Chrome not found, falling back to headless mode');
                        this.useExistingChrome = false;
                        resolve(false);
                    }
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });
            };
            checkConnection();
        });
    }

    async initializeDriver() {
        try {
            // For banners, always use headless mode (no login needed)
            // Only try Chrome debugger if explicitly required for login scenarios
            if (this.useExistingChrome) {
                // Try to start Chrome debugger if not running
                const chromeReady = await this.startChromeDebuggerIfNeeded();
                if (!chromeReady) {
                    logger.info('Falling back to headless mode for banner extraction');
                    this.useExistingChrome = false;
                }
            }

            const options = new chrome.Options();
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');
            // Add User-Agent to avoid headless browser detection
            options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            if (this.useExistingChrome) {
                // Attach to an already running Chrome with remote debugging (only for login scenarios)
                try {
                    options.options_.debuggerAddress = this.debuggerAddress;
                    logger.info('Attaching to existing Chrome via debugger', { debuggerAddress: this.debuggerAddress });
                } catch (debugError) {
                    logger.warn('Failed to set debugger address, falling back to headless', { error: debugError.message });
                    this.useExistingChrome = false;
                }
            }
            
            // Always use headless for banner extraction (no login needed)
            if (!this.useExistingChrome) {
                options.addArguments('--headless=new'); // Use new headless mode
                logger.info('Using headless browser for banner extraction (no login required)');
            }

            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            logger.info('Banner extractor driver initialized successfully', { 
                mode: this.useExistingChrome ? 'existing-chrome' : 'headless' 
            });
        } catch (error) {
            logger.error('Failed to initialize driver:', { error: error.message });
            // If connection to existing Chrome fails, retry with headless
            if (this.useExistingChrome && error.message.includes('cannot connect to chrome')) {
                logger.info('Retrying with headless mode instead of existing Chrome');
                this.useExistingChrome = false;
                return await this.initializeDriver(); // Retry with headless
            }
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

    // Enhanced product image detection for all platforms
    isLikelyProductImage(imageUrl, altText, platformKey) {
        try {
            if (!imageUrl) return true;
            const lowerUrl = imageUrl.toLowerCase();
            const lowerAlt = (altText || '').toLowerCase();
            
            // Platform-specific product image patterns
            if (platformKey === 'flipkart') {
                return this.isLikelyFlipkartProductImage(imageUrl, altText);
            }
            
            // Amazon product image patterns
            if (platformKey === 'amazon') {
                // Amazon product image patterns
                const amazonProductPatterns = [
                    '/images/i/', // Amazon product images
                    '/images/g/', // Amazon product gallery
                    '._ac_', // Amazon product image format
                    '/media/images/', // Amazon media images
                ];
                // Product keywords in alt text
                const productKeywords = [
                    'product', 'item', 'buy now', 'add to cart', 'price', '₹', 'rs.',
                    'mobile', 'phone', 'laptop', 'watch', 'shirt', 'shoes', 'bag'
                ];
                if (amazonProductPatterns.some(p => lowerUrl.includes(p)) && 
                    productKeywords.some(k => lowerAlt.includes(k))) {
                    return true;
                }
            }
            
            // Myntra product image patterns
            if (platformKey === 'myntra') {
                const myntraProductPatterns = [
                    '/images/', // Myntra product images
                    '/product/', // Product image paths
                ];
                const productKeywords = [
                    'men', 'women', 'boys', 'girls', 'shirt', 'dress', 'jeans', 'shoes',
                    'price', '₹', 'buy', 'add to bag'
                ];
                if (myntraProductPatterns.some(p => lowerUrl.includes(p)) && 
                    productKeywords.some(k => lowerAlt.includes(k))) {
                    return true;
                }
            }
            
            // Ajio product image patterns
            if (platformKey === 'ajio') {
                const ajioProductPatterns = [
                    '/medias/', // Ajio product images
                    '/product/', // Product image paths
                ];
                const productKeywords = [
                    'men', 'women', 'boys', 'girls', 'shirt', 'dress', 'jeans', 'shoes',
                    'price', '₹', 'buy', 'add to bag'
                ];
                if (ajioProductPatterns.some(p => lowerUrl.includes(p)) && 
                    productKeywords.some(k => lowerAlt.includes(k))) {
                    return true;
                }
            }
            
            // Generic product image detection (small square images are usually products)
            const smallImagePatterns = [
                '/150x150', '/200x200', '/250x250', '/300x300',
                'w=150', 'h=150', 'w=200', 'h=200',
                'thumbnail', 'thumb', 'small'
            ];
            if (smallImagePatterns.some(p => lowerUrl.includes(p))) {
                // Check if alt text contains product-related words
                const productIndicators = [
                    'product', 'item', 'buy', 'price', '₹', 'rs.', 'add to cart',
                    'mobile', 'phone', 'laptop', 'watch', 'shirt', 'shoes'
                ];
                if (productIndicators.some(indicator => lowerAlt.includes(indicator))) {
                    return true;
                }
            }
            
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
            let retries = 1;
            while (retries >= 0) {
                try {
                    logger.debug(`Extracting banners from: ${url}`);
                    await this.driver.get(url);
                    
                    // Wait for page to load
                    await this.driver.wait(until.elementLocated(By.css('body')), 10000);
                    
                    // Extract banners from this URL
                    const urlBanners = await this.extractBannersFromUrl(platformKey, selectors, validation);
                    banners.push(...urlBanners);
                    
                    logger.info(`Extracted ${urlBanners.length} banners from ${url}`);
                    break; // Success, exit retry loop
                } catch (error) {
                    const isSessionError = error.message.includes('invalid session id') || 
                                           error.message.includes('disconnected') || 
                                           error.message.includes('no such session') ||
                                           error.message.includes('chrome not reachable') ||
                                           error.message.includes('ECONNREFUSED') ||
                                           error.message.includes('ECONNRESET');
                    
                    if (isSessionError && retries > 0) {
                        logger.warn(`Driver session crashed/invalidated during get(${url}). Re-initializing driver and retrying...`, {
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

    async extractRedirectUrl(element, platformKey) {
        try {
            const baseUrl = bannerConfig.platforms[platformKey]?.baseUrl || `https://www.${platformKey}.com`;
            const rawUrl = await this.driver.executeScript(`
                var el = arguments[0];
                if (!el) return null;
                function isValid(u) {
                    if (!u || typeof u !== 'string') return false;
                    u = u.trim();
                    if (!u || u === '#' || u.startsWith('javascript:') || u === 'about:blank') return false;
                    return true;
                }
                function isHome(u) {
                    if (!isValid(u)) return false;
                    try {
                        var parsed = new URL(u, window.location.origin);
                        var path = parsed.pathname.replace(/\\/+$/, '');
                        return path === '' || path === '/';
                    } catch(e) { return false; }
                }
                function clean(u) {
                    if (!isValid(u)) return null;
                    try { return new URL(u, window.location.origin).href; } catch(e) { return u; }
                }
                if (el.tagName && el.tagName.toLowerCase() === 'a') {
                    var h = clean(el.getAttribute('href') || el.href);
                    if (h && !isHome(h)) return h;
                }
                var closestA = el.closest ? el.closest('a') : null;
                if (closestA) {
                    var h2 = clean(closestA.getAttribute('href') || closestA.href);
                    if (h2 && !isHome(h2)) return h2;
                }
                var curr = el;
                for (var i = 0; i < 6; i++) {
                    if (!curr || curr === document.body) break;
                    var d = curr.getAttribute('data-href') || curr.getAttribute('data-url') || curr.getAttribute('data-link');
                    if (d) { var fd = clean(d); if (fd && !isHome(fd)) return fd; }
                    curr = curr.parentElement;
                }
                var container = el.closest ? el.closest('[class*="slide"], [class*="card"], [class*="banner"], [class*="carousel"], [class*="item"], [class*="promo"], [class*="hero"], li, section') : null;
                if (container) {
                    var links = container.querySelectorAll('a[href]');
                    for (var j = 0; j < links.length; j++) {
                        var cand = clean(links[j].getAttribute('href') || links[j].href);
                        if (cand && !isHome(cand)) return cand;
                    }
                }
                if (closestA) {
                    var lastHref = clean(closestA.getAttribute('href') || closestA.href);
                    if (lastHref && !isHome(lastHref)) return lastHref;
                }
                return null;
            `, element);

            if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
                const resolved = new URL(rawUrl.trim(), baseUrl).href;
                if (!this.isHomePageUrl(resolved, platformKey)) {
                    return resolved;
                }
            }
        } catch (e) {
            logger.debug('Error extracting redirect URL:', { error: e.message });
        }
        return null;
    }

    async extractFromBannerImages(platformKey, selectors, validation) {
        const banners = [];
        
        try {
            let bannerImages = await this.driver.findElements(By.css(selectors.bannerImage));
            logger.debug(`Found ${bannerImages.length} banner images directly`);
            
            if (bannerImages.length === 0 && selectors.alternativeBannerImage) {
                bannerImages = await this.driver.findElements(By.css(selectors.alternativeBannerImage));
                logger.debug(`Found ${bannerImages.length} banner images with alternative selector`);
            }
            
            for (const imageElement of bannerImages) {
                try {
                    const imageUrl = await imageElement.getAttribute('src');
                    const altText = await imageElement.getAttribute('alt');
                    
                    if (this.extractedUrls.has(imageUrl)) {
                        continue;
                    }

                    let width = 0, height = 0;
                    try {
                        const dims = await this.driver.executeScript(
                            "return [arguments[0].naturalWidth || arguments[0].width || 0, arguments[0].naturalHeight || arguments[0].height || 0];", 
                            imageElement
                        );
                        width = dims[0];
                        height = dims[1];
                    } catch (dimErr) {
                        logger.debug(`Could not extract natural dimensions for element:`, { error: dimErr.message });
                    }

                    const clickRedirectUrl = await this.extractRedirectUrl(imageElement, platformKey);
                    if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                        continue;
                    }

                    const bannerData = {
                        imageUrl,
                        altText,
                        title: null,
                        clickUrl: clickRedirectUrl,
                        element: imageElement,
                        width,
                        height
                    };
                    
                    const validationResult = this.validator.validateBanner(bannerData);
                    if (!validationResult.isValid) {
                        continue;
                    }

                    this.extractedUrls.add(imageUrl);

                    // Generate banner data
                    const timestamp = generateBannerTimestamp();
                    const banner = {
                        id: generateBannerId(platformKey, validationResult.category),
                        url: imageUrl,
                        clickRedirectUrl: clickRedirectUrl,
                        isActive: this.defaultVisibility,
                        order: 0,
                        creationTimestamp: timestamp,
                        updateTimestamp: timestamp,
                        platform: platformKey,
                        category: validationResult.category,
                        priority: validationResult.category === 'hero' ? 1 : (validationResult.category === 'seasonal' ? 2 : (validationResult.category === 'promotional' ? 3 : 4)),
                        title: altText || 'Banner',
                        description: altText,
                        confidence: validationResult.confidence,
                        validationReasons: validationResult.reasons
                    };
                    
                    banners.push({
                        ...banner,
                        isValid: true
                    });
                    
                    logger.debug(`Successfully extracted direct banner: ${banner.id} (${validationResult.category})`);
                    
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
            // Extract destination link URL
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
            logger.debug(`Found image: ${imageUrl}, alt: ${altText}`);

            if (this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                const imgRedirect = await this.extractRedirectUrl(imageElement, platformKey);
                if (imgRedirect && !this.isHomePageUrl(imgRedirect, platformKey)) {
                    clickRedirectUrl = imgRedirect;
                }
            }

            // Get browser-level natural dimensions of the image element
            let width = 0, height = 0;
            try {
                const dims = await this.driver.executeScript(
                    "return [arguments[0].naturalWidth || arguments[0].width || 0, arguments[0].naturalHeight || arguments[0].height || 0];", 
                    imageElement
                );
                width = dims[0];
                height = dims[1];
            } catch (dimErr) {
                logger.debug(`Could not extract natural dimensions for element:`, { error: dimErr.message });
            }

            if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                const imgRedirect = await this.extractRedirectUrl(imageElement, platformKey);
                if (imgRedirect && !this.isHomePageUrl(imgRedirect, platformKey)) {
                    clickRedirectUrl = imgRedirect;
                }
            }

            if (!clickRedirectUrl || this.isHomePageUrl(clickRedirectUrl, platformKey)) {
                logger.debug(`Skipping link element because no non-homepage destination redirect URL found`);
                return null;
            }

            const bannerData = {
                imageUrl,
                altText,
                title: null,
                clickUrl: clickRedirectUrl,
                element: imageElement,
                width,
                height
            };
            
            const validationResult = this.validator.validateBanner(bannerData);
            if (!validationResult.isValid) {
                logger.debug(`Banner validation failed:`, { 
                    reasons: validationResult.reasons,
                    imageUrl: imageUrl?.substring(0, 100),
                    width,
                    height
                });
                return null;
            }
            
            // Generate banner data
            const timestamp = generateBannerTimestamp();
            const banner = {
                id: generateBannerId(platformKey, validationResult.category),
                url: imageUrl,
                clickRedirectUrl: clickRedirectUrl,
                isActive: this.defaultVisibility,
                order: 0,
                creationTimestamp: timestamp,
                updateTimestamp: timestamp,
                platform: platformKey,
                category: validationResult.category,
                priority: validationResult.category === 'hero' ? 1 : (validationResult.category === 'seasonal' ? 2 : (validationResult.category === 'promotional' ? 3 : 4)),
                title: altText || 'Banner',
                description: altText,
                confidence: validationResult.confidence,
                validationReasons: validationResult.reasons
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
            // await this.deactivateOldBanners(activeBannerIds);
            
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
