const puppeteer = require('puppeteer');
const { getModuleLogger } = require('./logger/logger');
const constModule = require('./config/const');
const storeMap = constModule.storeMap;
// const { extractText } = require('./helper/helperFunction');
const { By } = require('selenium-webdriver');
const fs = require('fs').promises;
const logger = getModuleLogger('pageScheduler');

// Validate storeMap at module load time
if (!storeMap || typeof storeMap !== 'object') {
    const errorMsg = `CRITICAL: storeMap is not available in pageScheduler.js. constModule: ${JSON.stringify(constModule)}, storeMap type: ${typeof storeMap}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
}

// Validate storeMap at module load time
if (!storeMap || typeof storeMap !== 'object') {
    logger.error('CRITICAL: storeMap is not available at module load time', { 
        storeMapType: typeof storeMap,
        storeMapValue: storeMap,
        constModuleKeys: Object.keys(constModule || {})
    });
}

// Load configuration for a specific platform
async function loadConfigJson(configPath) {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
}

async function loadConfig(configPath) {
    const path = require('path');
    if (path.isAbsolute(configPath)) {
        return require(configPath);
    }
    return require(path.resolve(__dirname, configPath)); // Resolve relative to this file's directory
}

async function scrapePage(url, driver, config, pageType) {
    const products = [];
    let newPageConfig;
    try {
        logger.info('Starting page scraping', { url, pageType });
        
        // Validate storeMap is available
        if (!storeMap || typeof storeMap !== 'object') {
            logger.error('storeMap is not available or invalid', { 
                storeMapType: typeof storeMap, 
                storeMapValue: storeMap,
                url 
            });
            throw new Error("storeMap configuration is not available");
        }
        
        const { resolvePlatformFromUrl } = require('./utils/platformUtils');
        const storeKey = resolvePlatformFromUrl(url) || Object.keys(storeMap).find(key => url.includes(key.toLowerCase()));
        if (!storeKey) {
            logger.error('Platform not detected from URL', { 
                url, 
                availablePlatforms: Object.keys(storeMap),
                storeMapKeys: Object.keys(storeMap || {})
            });
            throw new Error("Platform not supported or URL is invalid.");
        }

        logger.info('Platform detected', { storeKey, url, availablePlatforms: Object.keys(storeMap) });

        // Validate storeMap[storeKey] exists
        if (!storeMap[storeKey]) {
            logger.error('Platform configuration not found in storeMap', { 
                storeKey, 
                availableKeys: Object.keys(storeMap),
                url 
            });
            throw new Error(`Platform configuration not found for: ${storeKey}`);
        }

        // Extract platform configuration
        const { getCode, storeType } = storeMap[storeKey];
        if (!getCode || !storeType) {
            logger.error('Invalid platform configuration', { 
                storeKey, 
                hasGetCode: !!getCode, 
                hasStoreType: !!storeType,
                config: storeMap[storeKey]
            });
            throw new Error(`Invalid platform configuration for: ${storeKey}`);
        }
        
        const platformConfig = { getCode, storeType };

        logger.info("Platform Config loaded", { platformConfig });
        // Dynamically import the PageConfig based on platform
        const pageConfigModule = `./PageConfig/${storeKey.toLowerCase()}PageConfig.js`;
        platformConfig.pageConfig = require(pageConfigModule);

        const { pageConfig } = platformConfig;
        if (!pageConfig) throw new Error(`PageConfig not found for store: ${storeKey}`);

        // Assign the configuration for the specific page type
        newPageConfig = pageConfig?.[pageType];
        if (!newPageConfig) {
            // Gracefully skip unsupported page types for this platform
            logger.debug(`PageConfig missing for pageType='${pageType}' on store='${storeKey}', skipping`);
            return [];
        }

        logger.info("Page Config loaded successfully", { 
            storeKey, 
            pageType, 
            hasSelectors: !!newPageConfig.selectors,
            hasRowColConfig: !!newPageConfig.rowColConfig 
        });

        // Flipkart-specific or general scraping logic
        const isFlipkart = storeKey.toLowerCase() === 'flipkart';
        const hasBaseSelector = !!newPageConfig.baseSelector;
        if (isFlipkart && !hasBaseSelector) {
            logger.info('Using Flipkart-specific scraping logic');
            const result = await scrapeFlipkart(driver, newPageConfig, storeKey);  // Isolated function for Flipkart
            logger.info('Page scraping completed', { url, pageType, storeKey, productsFound: result.length });
            return result;
        } else {
            logger.info('Using general scraping logic');
            const result = await scrapeGeneral(driver, newPageConfig, storeKey);  // General case for other platforms
            logger.info('Page scraping completed', { url, pageType, storeKey, productsFound: result.length });
            return result;
        }
    } catch (error) {
        logger.error("Critical error in scrapePage", { functionName: 'scrapePage', url, error: error?.message || String(error), stack: error?.stack });
        return [];
        // return null;
    }
}

async function scrapeFlipkart(driver, pageConfig, storeKey) {
    const products = [];
    const { startRow, maxRows, maxCols } = pageConfig.rowColConfig;
    const { selectors } = pageConfig;
    
    logger.info('Starting Flipkart scraping', { startRow, maxRows, maxCols, selectorsCount: Object.keys(selectors).length });

    for (let row = startRow; row <= startRow + maxRows - 1; row++) {
        for (let col = 1; col <= maxCols; col++) {
            logger.debug('Processing Flipkart product', { row, col });
            const productData = await extractFlipkartProduct(driver, selectors, row, col, storeKey);
            if (productData) {
                products.push(productData);
                logger.debug('Product added to results', { row, col, productsCount: products.length });
            } else {
                logger.debug('No product data extracted', { row, col });
            }
        }
    }
    
    logger.info('Flipkart scraping completed', { totalProducts: products.length });
    return products;
}

async function extractFlipkartProduct(driver, selectors, row, col, storeKey) {
    const productData = {};
    logger.debug('Extracting Flipkart product', { row, col, storeKey });
    
    for (const [key, selectorConfig] of Object.entries(selectors)) {
        const { type, selector, validate, attribute, value } = selectorConfig;
        try {
            if (type === "static") {
                // Handle static values
                productData[key] = value || "";
                logger.debug('Static value extracted', { key, value: productData[key] });
            } else if (type === "xpath") {
                if (key === "productUrl") {
                // Special handling for product URLs
                const linkElement = await driver.findElement(By.xpath(selector(row, col)));
                const rawValue = await linkElement.getAttribute("href");
                const baseUrl = "https://www.flipkart.com/";
                productData[key] = rawValue.startsWith("http")
                    ? rawValue
                    : new URL(rawValue, baseUrl).href;
                    logger.debug('Product URL extracted', { key, value: productData[key] });
                } else if (key === "photo" || key === "images") {
                    // Handle image attributes
                    const imgElement = await driver.findElement(By.xpath(selector(row, col)));
                    const rawValue = await imgElement.getAttribute("src");
                    productData[key] = rawValue || "";
                    logger.debug('Image extracted', { key, value: productData[key] });
                } else {
                    // General data extraction for text content
                    const element = await driver.findElement(By.xpath(selector(row, col)));
                    const rawValue = await element.getText();
                    
                    // Apply validation if provided
                    if (validate && rawValue) {
                        const validationResult = validate(rawValue);
                        productData[key] = validationResult.isValid ? validationResult.value : "";
                        logger.debug('Validated value extracted', { key, rawValue, validatedValue: productData[key] });
            } else {
                productData[key] = rawValue || "";
                        logger.debug('Raw value extracted', { key, value: productData[key] });
                    }
                }
            }
        } catch (error) {
            productData[key] = '';
            logger.debug('Failed to extract value', { key, error: error.message });
        }
    }
    
    // Extract productCode from URL using getCode function
    if (productData.productUrl && productData.productUrl !== "N/A") {
        try {
            // Validate storeMap and storeKey before accessing
            if (!storeMap || !storeMap[storeKey]) {
                logger.warn('storeMap or platform config not available for productCode extraction', { 
                    storeKey, 
                    hasStoreMap: !!storeMap,
                    storeMapKeys: storeMap ? Object.keys(storeMap) : []
                });
                return productData;
            }
            const { getCode } = storeMap[storeKey];
            if (getCode) {
                const extractedCode = getCode(productData.productUrl);
                if (extractedCode) {
                    productData.productCode = extractedCode;
                    logger.debug('Product code extracted from URL', { productCode: extractedCode, url: productData.productUrl });
                } else {
                    logger.debug('No product code found in URL', { url: productData.productUrl });
                }
            }
        } catch (error) {
            productData.productCode = "";
            logger.debug('Failed to extract product code', { error: error.message });
        }
    }
    
    // Post-process the data to ensure consistency
    const processedData = postProcessProductData(productData, storeKey);
    logger.debug('Product data processed', { 
        row, 
        col, 
        fields: Object.keys(processedData).length,
        hasProductCode: !!processedData.productCode && processedData.productCode !== "N/A"
    });
    
    return processedData;
}

async function scrapeGeneral(driver, pageConfig, storeKey) {
    const products = [];
    const workingSelectorCache = {};
    
    try {
        const curUrl = await driver.getCurrentUrl();
        const curTitle = await driver.getTitle();
        logger.info('Page loaded for scraping:', { storeKey, url: curUrl, title: curTitle });
    } catch (e) {
        logger.warn('Failed to get page details before scraping:', { error: e.message });
    }
    
    logger.info('Starting general scraping', { storeKey, baseSelector: pageConfig.baseSelector });
    
    // Clear memory at start
    try {
        await driver.executeScript('if (window.gc) window.gc();');
    } catch {}
    
    try {
        // Wait for base selector to appear (handles lazy/dom injection)
        logger.info('Waiting for base selector to appear', { baseSelector: pageConfig.baseSelector, timeout: 15000 });
        await driver.wait(async () => {
            const els = await driver.findElements(By.css(pageConfig.baseSelector));
            const hasElements = els && els.length > 0;
            if (!hasElements) {
                // Try alternative common selectors if base selector fails
                const altSelectors = [
                    'div[data-component-type="s-search-result"]',
                    'div.s-result-item',
                    'div[data-asin]',
                    'div.s-card-container',
                    'div.puis-card-container'
                ];
                for (const altSelector of altSelectors) {
                    const altEls = await driver.findElements(By.css(altSelector));
                    if (altEls && altEls.length > 0) {
                        logger.info('Found products with alternative selector', { altSelector, count: altEls.length });
                        return true;
                    }
                }
            }
            return hasElements;
        }, 15000);
        let initialEls = await driver.findElements(By.css(pageConfig.baseSelector));
        logger.info('Initial product tiles located', { storeKey, baseSelector: pageConfig.baseSelector, count: initialEls.length });
        
        // If base selector found nothing, try alternative selectors for Amazon
        if (initialEls.length === 0 && storeKey.toLowerCase() === 'amazon') {
            logger.warn('Base selector found no elements, trying alternatives', { baseSelector: pageConfig.baseSelector, storeKey });
            const altSelectors = [
                'div[data-component-type="s-search-result"]',
                'div.s-result-item[data-asin]',
                'div[data-asin]:not([data-asin=""])',
                'div.s-card-container[data-asin]',
                'div.puis-card-container[data-asin]',
                'div.puis-card-container',
                'div[data-asin]',
                'div.s-result-item'
            ];
            for (const altSelector of altSelectors) {
                try {
                    const altEls = await driver.findElements(By.css(altSelector));
                    if (altEls && altEls.length > 0) {
                        logger.info('✅ Found products with alternative selector', { 
                            altSelector, 
                            count: altEls.length,
                            originalSelector: pageConfig.baseSelector
                        });
                        pageConfig.baseSelector = altSelector;
                        initialEls = altEls;
                        break;
                    }
                } catch (e) {
                    logger.debug('Alternative selector failed', { altSelector, error: e?.message });
                }
            }
            
            if (initialEls.length === 0) {
                const currentUrl = await driver.getCurrentUrl();
                logger.error('❌ All alternative selectors failed, no products found', { 
                    url: currentUrl,
                    storeKey,
                    attemptedSelectors: altSelectors
                });
            } else {
                logger.info('✅ Using alternative selector successfully', { 
                    newSelector: pageConfig.baseSelector, 
                    count: initialEls.length 
                });
            }
        }
        // Also wait for at least one link inside a product card (common signal that content populated)
        try {
            await driver.wait(async () => {
                const els = await driver.findElements(By.css(`${pageConfig.baseSelector} a`));
                return els && els.length > 0;
            }, 8000);
            const linkEls = await driver.findElements(By.css(`${pageConfig.baseSelector} a`));
            logger.debug('Initial links under tiles', { count: linkEls.length });
        } catch {}
    } catch {}
    // Trigger lazy loading: scroll until count stabilizes or cap reached
    const loadVisibleTiles = async () => {
        try {
            let prevCount = 0;
            let stableTicks = 0;
            for (let i = 0; i < 15; i++) { // Reduced from 20 to 15
                const els = await driver.findElements(By.css(pageConfig.baseSelector));
                const count = els.length;
                logger.debug('Scroll iteration count', { iteration: i + 1, count });
                if (count > prevCount) {
                    prevCount = count;
                    stableTicks = 0;
                } else {
                    stableTicks += 1;
                }
                if (stableTicks >= 3) break; // Reduced from 4 to 3
                await driver.executeScript('window.scrollBy(0, Math.min(800, window.innerHeight))'); // Reduced scroll distance
                await driver.sleep(300); // Reduced sleep time
                
                // Force garbage collection if available
                try {
                    await driver.executeScript('if (window.gc) window.gc();');
                } catch {}
            }
            // Small upward jiggle to ensure last batch attached
            await driver.executeScript('window.scrollBy(0, -200)'); // Reduced from -400
            await driver.sleep(100); // Reduced from 200
            const finalEls = await driver.findElements(By.css(pageConfig.baseSelector));
            logger.info('Post-scroll product tiles count', { count: finalEls.length });
        } catch {}
    };

    await loadVisibleTiles();

    let baseElements = await driver.findElements(By.css(pageConfig.baseSelector));
    logger.info('Extracting from current page', { tiles: baseElements.length, storeKey });

    let pageExtracted = 0;
    for (const element of baseElements) {
        const productData = await extractGeneralProduct(element, pageConfig.selectors, storeKey, workingSelectorCache);
        if (productData) {
            products.push(productData);
            pageExtracted += 1;
        }
        
        // Force garbage collection every 15 products to prevent memory buildup
        if (pageExtracted % 15 === 0) {
            try {
                await driver.executeScript('if (window.gc) window.gc();');
            } catch {}
        }
    }
    logger.info('Extraction complete for current page', { extracted: pageExtracted, totalSoFar: products.length });
    
    // Clear baseElements to free memory
    baseElements = null;

    // Try simple pagination (up to 2 pages) using common next selectors - reduced to save memory
    const nextSelectors = [
        'a[rel="next"]',
        'a[aria-label*="Next" i]',
        'a.pagination-next',
        'button[aria-label*="Next" i]',
        'li.pagination-next' // Myntra specific
    ];
    const maxPagesToScrape = (require('./config/constants').generaltype === 'bulkUpdate') ? 0 : 1;
    for (let page = 0; page < maxPagesToScrape; page++) {
        let nextEl = null;
        for (const sel of nextSelectors) {
            const found = await driver.findElements(By.css(sel));
            if (found && found.length > 0) {
                // Skip disabled items
                try {
                    const cls = await found[0].getAttribute('class');
                    if (cls && /pagination-disabled/i.test(cls)) {
                        continue;
                    }
                } catch {}
                nextEl = found[0];
                break;
            }
        }
        if (!nextEl) break;
        try {
            logger.info('Attempting pagination to next page', { page: page + 2 });
            await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', nextEl);
            await driver.sleep(200);
            // Some sites use <li> wrappers without direct click handlers; click child if present
            try {
                await nextEl.click();
            } catch {
                const child = (await nextEl.findElements(By.css('a,button,span')))[0];
                if (child) { await child.click(); }
            }
            await driver.sleep(800); // Reduced from 1200
            await driver.wait(async () => {
                const els = await driver.findElements(By.css(pageConfig.baseSelector));
                return els && els.length > 0;
            }, 5000); // Reduced from 8000
            await loadVisibleTiles();
            baseElements = await driver.findElements(By.css(pageConfig.baseSelector));
            logger.info('Extracting after pagination', { tiles: baseElements.length, page: page + 2 });
            let extractedThisPage = 0;
            for (const element of baseElements) {
                const productData = await extractGeneralProduct(element, pageConfig.selectors, storeKey, workingSelectorCache);
                if (productData) { products.push(productData); extractedThisPage += 1; }
                
                // Force garbage collection every 10 products to prevent memory buildup
                if (extractedThisPage % 10 === 0) {
                    try {
                        await driver.executeScript('if (window.gc) window.gc();');
                    } catch {}
                }
            }
            logger.info('Pagination page extraction complete', { page: page + 2, extracted: extractedThisPage, totalSoFar: products.length });
            
            // Clear baseElements to free memory
            baseElements = null;
        } catch {}
    }

    logger.info('General scraping completed', { storeKey, totalProducts: products.length });
    
    // Generate extraction summary
    const summary = generateExtractionSummary(products, storeKey);
    logger.info(`Extraction summary for ${storeKey}:`, summary);

    return products;
}

function generateExtractionSummary(products, storeKey) {
    const summary = {
        totalProducts: products.length,
        fieldStats: {},
        mandatoryFields: {
            photo: 0,
            productCode: 0,
            price: 0,
            productUrl: 0,
            brand: 0,
            title: 0
        }
    };
    
    if (products.length === 0) {
        return summary;
    }
    
    // Get all possible fields from the first product
    const allFields = Object.keys(products[0]);
    
    // Count populated fields
    allFields.forEach(field => {
        let populatedCount = 0;
        products.forEach(product => {
            if (product[field] && product[field] !== "" && product[field] !== "N/A") {
                populatedCount++;
            }
        });
        
        summary.fieldStats[field] = {
            populated: populatedCount,
            empty: products.length - populatedCount,
            percentage: Math.round((populatedCount / products.length) * 100)
        };
    });
    
    // Check mandatory fields specifically
    summary.mandatoryFields.photo = summary.fieldStats.photo?.populated || 0;
    summary.mandatoryFields.productCode = summary.fieldStats.productCode?.populated || 0;
    summary.mandatoryFields.price = summary.fieldStats.price?.populated || 0;
    summary.mandatoryFields.productUrl = summary.fieldStats.productUrl?.populated || 0;
    summary.mandatoryFields.brand = summary.fieldStats.brand?.populated || 0;
    summary.mandatoryFields.title = summary.fieldStats.title?.populated || 0;
    
    return summary;
}

async function extractGeneralProduct(element, selectors, storeKey, cache = {}) {
    const productData = {};
    
    logger.debug(`Starting extraction for ${storeKey} product`);
    
    for (const [key, selectorConfigs] of Object.entries(selectors)) {
        try {
            let extracted = false;
            
            // Handle array of selector configs
            const configs = Array.isArray(selectorConfigs) ? selectorConfigs : [selectorConfigs];
            
            // Try the cached working selector first
            const cachedIndex = cache[key];
            if (cachedIndex !== undefined && cachedIndex < configs.length) {
                const config = configs[cachedIndex];
                const result = await extractWithConfig(element, config, storeKey);
                
                if (result.isValid && result.value) {
                    if (result.value === "FALLBACK_NEEDED" && config.type === "fallback") {
                        const fallbackValue = productData[config.field];
                        if (fallbackValue && fallbackValue !== "N/A" && fallbackValue !== "") {
                            if (config.validate && typeof config.validate === 'function') {
                                const validationResult = config.validate(fallbackValue);
                                if (validationResult && validationResult !== 'N/A') {
                                    productData[key] = validationResult;
                                    extracted = true;
                                }
                            } else {
                                productData[key] = fallbackValue;
                                extracted = true;
                            }
                        }
                    } else {
                        productData[key] = result.value;
                        extracted = true;
                    }
                }
            }
            
            // If the cached selector didn't work (or wasn't cached yet), try all selectors in order
            if (!extracted) {
                for (let i = 0; i < configs.length; i++) {
                    if (i === cachedIndex) continue; // Already tried
                    const config = configs[i];
                    const result = await extractWithConfig(element, config, storeKey);
                    
                    if (result.isValid && result.value) {
                        if (result.value === "FALLBACK_NEEDED" && config.type === "fallback") {
                            // Handle fallback to another field
                            const fallbackValue = productData[config.field];
                            if (fallbackValue && fallbackValue !== "N/A" && fallbackValue !== "") {
                                // Apply validation if specified
                                if (config.validate && typeof config.validate === 'function') {
                                    const validationResult = config.validate(fallbackValue);
                                    if (validationResult && validationResult !== 'N/A') {
                                        productData[key] = validationResult;
                                        extracted = true;
                                        cache[key] = i; // Cache this working selector index
                                        break;
                                    }
                                } else {
                                    productData[key] = fallbackValue;
                                    extracted = true;
                                    cache[key] = i; // Cache this working selector index
                                    break;
                                }
                            }
                        } else {
                            productData[key] = result.value;
                            extracted = true;
                            cache[key] = i; // Cache this working selector index
                            break;
                        }
                    }
                }
            }
            
            if (!extracted) {
                productData[key] = "";
                logger.debug(`Failed to extract ${key} for ${storeKey} - no valid selectors found`);
            }
            
        } catch (error) {
            logger.error(`Error extracting ${key} for ${storeKey}:`, error);
            productData[key] = "";
        }
    }
    
    // Get product code using getCode utility
    try {
        if (productData.productUrl) {
            const codeResult = getCode(productData.productUrl, storeKey);
            if (codeResult.isValid) {
                productData.productCode = codeResult.value;
                logger.debug(`Product code extracted for ${storeKey}:`, { code: codeResult.value });
            } else {
                logger.debug(`Failed to extract product code for ${storeKey}:`, { url: productData.productUrl });
            }
        }
    } catch (error) {
        logger.debug(`Error getting product code for ${storeKey}:`, { error: error.message });
    }
    
    // Generate productUrl using productCode if missing (especially for Amazon)
    try {
        if (!productData.productUrl || productData.productUrl === "N/A") {
            if (productData.productCode && productData.productCode !== "N/A") {
                if (storeKey.toLowerCase() === 'amazon') {
                    // For Amazon: https://www.amazon.in/dp/{productCode}?tag=dealshubglo0c-21
                    productData.productUrl = `https://www.amazon.in/dp/${productData.productCode}?tag=dealshubglo0c-21`;
                    logger.debug(`Generated Amazon productUrl using productCode:`, { 
                        productCode: productData.productCode, 
                        productUrl: productData.productUrl 
                    });
                } else if (storeKey.toLowerCase() === 'flipkart') {
                    // For Flipkart: https://www.flipkart.com/p/{productCode}
                    productData.productUrl = `https://www.flipkart.com/p/${productData.productCode}`;
                    logger.debug(`Generated Flipkart productUrl using productCode:`, { 
                        productCode: productData.productCode, 
                        productUrl: productData.productUrl 
                    });
                } else if (storeKey.toLowerCase() === 'myntra') {
                    // For Myntra: https://www.myntra.com/{productCode}/buy
                    productData.productUrl = `https://www.myntra.com/${productData.productCode}/buy`;
                    logger.debug(`Generated Myntra productUrl using productCode:`, { 
                        productCode: productData.productCode, 
                        productUrl: productData.productUrl 
                    });
                } else if (storeKey.toLowerCase() === 'ajio') {
                    // For Ajio: https://www.ajio.com/p/{productCode}
                    productData.productUrl = `https://www.ajio.com/p/${productData.productCode}`;
                    logger.debug(`Generated Ajio productUrl using productCode:`, { 
                        productCode: productData.productCode, 
                        productUrl: productData.productUrl 
                    });
                }
            }
        }
    } catch (error) {
        logger.debug(`Error generating productUrl for ${storeKey}:`, { error: error.message });
    }
    
    logger.debug(`Extraction completed for ${storeKey} product:`, { 
        fields: Object.keys(productData).length,
        hasPhoto: !!productData.photo,
        hasProductUrl: !!productData.productUrl,
        hasProductCode: !!productData.productCode,
        hasPrice: !!productData.price
    });
    
    return productData;
}

async function extractWithConfig(element, selectorConfig, storeKey) {
    try {
        let extractedValue = "";
        
        if (selectorConfig.type === "static") {
            extractedValue = selectorConfig.value;
            logger.debug(`Static value extracted for ${storeKey}:`, { value: extractedValue });
            return { isValid: true, value: extractedValue };
        }
        
        if (selectorConfig.type === "css") {
            try {
                const childElement = await element.findElement(By.css(selectorConfig.selector));
                if (selectorConfig.attribute) {
                    extractedValue = await childElement.getAttribute(selectorConfig.attribute);
                    if (selectorConfig.extractImageFromStyle && extractedValue) {
                        const match = extractedValue.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            extractedValue = match[1];
                        }
                    }
                } else {
                    extractedValue = await childElement.getText();
                }
                
                logger.debug(`CSS extraction for ${storeKey}:`, { 
                    selector: selectorConfig.selector, 
                    attribute: selectorConfig.attribute,
                    rawValue: extractedValue 
                });
                
            } catch (error) {
                logger.debug(`CSS selector not found for ${storeKey}:`, { 
                    selector: selectorConfig.selector, 
                    error: error.message 
                });
                return { isValid: false, value: "" };
            }
        } else if (selectorConfig.type === "xpath") {
            try {
                const childElement = await element.findElement(By.xpath(selectorConfig.selector));
                if (selectorConfig.attribute) {
                    extractedValue = await childElement.getAttribute(selectorConfig.attribute);
                    if (selectorConfig.extractImageFromStyle && extractedValue) {
                        const match = extractedValue.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            extractedValue = match[1];
                        }
                    }
                } else {
                    extractedValue = await childElement.getText();
                }
                
                logger.debug(`XPath extraction for ${storeKey}:`, { 
                    selector: selectorConfig.selector, 
                    attribute: selectorConfig.attribute,
                    rawValue: extractedValue 
                });
                
            } catch (error) {
                logger.debug(`XPath selector not found for ${storeKey}:`, { 
                    selector: selectorConfig.selector, 
                    error: error.message 
                });
                return { isValid: false, value: "" };
            }
        } else if (selectorConfig.type === "fallback") {
            // Fallback to another field value
            logger.debug(`Fallback extraction for ${storeKey}:`, { 
                fallbackField: selectorConfig.field 
            });
            return { isValid: true, value: "FALLBACK_NEEDED" };
        }
        
        // Apply validation if specified
        if (selectorConfig.validate && typeof selectorConfig.validate === 'function') {
            const validationResult = selectorConfig.validate(extractedValue);
            logger.debug(`Validation result for ${storeKey}:`, { 
                rawValue: extractedValue, 
                validationResult 
            });
            return validationResult;
        }
        
        // Return raw value if no validation
        return { isValid: true, value: extractedValue };
        
    } catch (error) {
        logger.error(`Error in extractWithConfig for ${storeKey}:`, error);
        return { isValid: false, value: "" };
    }
}

// Helper function to get base URL for different platforms
function getBaseUrl(storeKey) {
    const baseUrls = {
        'amazon': 'https://www.amazon.in/',
        'flipkart': 'https://www.flipkart.com/',
        'myntra': 'https://www.myntra.com/',
        'ajio': 'https://www.ajio.com/'
    };
    return baseUrls[storeKey.toLowerCase()] || 'https://www.example.com/';
}

// Helper function to post-process product data for consistency
function postProcessProductData(productData, storeKey) {
    const processed = { ...productData };
    
    // Ensure required fields exist
    processed.brand = processed.brand || "";
    processed.title = processed.title || "";
    processed.shortText = processed.shortText || processed.title || "";
    processed.urltext = processed.urltext || processed.title || "";
    processed.price = processed.price || "";
    processed.mrp = processed.mrp || "";
    processed.discount = processed.discount || "";
    processed.rating = processed.rating || "";
    processed.ratingsCount = processed.ratingsCount || "";
    processed.reviewsCount = processed.reviewsCount || processed.ratingsCount || "";
    processed.productUrl = processed.productUrl || "";
    processed.photo = processed.photo || "";
    processed.images = processed.images || processed.photo || "";
    processed.storeType = processed.storeType || storeKey;
    processed.productCode = processed.productCode || "";
    
    // Convert images to array if it's a single string
    if (typeof processed.images === 'string') {
        processed.images = [processed.images];
    }
    
    // Set default values for boolean fields
    processed.isDeal = processed.isDeal || false;
    processed.isDisplay = processed.isDisplay || false;
    processed.isOffer = processed.isOffer || false;
    processed.isOutOfStock = processed.isOutOfStock || false;
    
    // Set default values for other fields
    processed.asin = processed.asin || "";
    processed.category = processed.category || { c1: "", c2: "", c3: "", c4: "", c5: "", mainCategory: "" };
    processed.color = processed.color || "";
    processed.materialCare = processed.materialCare || "";
    processed.seller = processed.seller || "";
    processed.sizeFit = processed.sizeFit || "";
    processed.timer = processed.timer || "";
    processed.dealProgress = processed.dealProgress || "";
    processed.extraOffers = processed.extraOffers || "";
    processed.promoInfo = processed.promoInfo || [];
    processed.offers = processed.offers || [];
    
    // Normalize and compute missing price/mrp/discount when any two are present
    const toNumber = (val) => {
        if (val === undefined || val === null) return NaN;
        if (typeof val === 'number') return val;
        const num = String(val).replace(/[^0-9.]/g, '');
        return num ? parseFloat(num) : NaN;
    };
    const toPercentNumber = (val) => {
        if (val === undefined || val === null) return NaN;
        const str = String(val);
        // Only treat as percentage if it contains '%' or doesn't look like a currency/flat amount
        if (str.includes('%')) {
            const m = str.match(/([0-9]{1,3})(?:\.[0-9]+)?/);
            return m ? parseFloat(m[1]) : NaN;
        }
        return NaN;
    };

    let priceNum = toNumber(processed.price);
    let mrpNum = toNumber(processed.mrp);
    let discPct = toPercentNumber(processed.discount);

    // If MRP is less than price, correct it to be equal to price
    if (!isNaN(priceNum) && !isNaN(mrpNum) && mrpNum < priceNum) {
        processed.mrp = String(priceNum);
        mrpNum = priceNum;
    }

    // If price and mrp present, compute/correct discount
    if (!isNaN(priceNum) && !isNaN(mrpNum) && mrpNum > 0 && priceNum <= mrpNum) {
        const pct = Math.round((1 - (priceNum / mrpNum)) * 100);
        if (pct >= 0 && pct <= 100) {
            processed.discount = `${pct}%`;
            discPct = pct;
        }
    }
    // If price and discount present, compute mrp
    if (!isNaN(priceNum) && isNaN(mrpNum) && !isNaN(discPct) && discPct >= 0 && discPct < 100) {
        const denom = (1 - (discPct / 100));
        if (denom > 0) {
            const mrpCalc = Math.round(priceNum / denom);
            if (mrpCalc > 0) {
                processed.mrp = String(mrpCalc);
                mrpNum = mrpCalc;
            }
        }
    }
    // Default fallback: if mrp is still missing but price is present, set mrp to price and discount to 0%
    if (!isNaN(priceNum) && isNaN(mrpNum)) {
        processed.mrp = String(priceNum);
        mrpNum = priceNum;
        if (isNaN(discPct)) {
            processed.discount = "0%";
            discPct = 0;
        }
    }
    // If mrp and discount present, compute price
    if (isNaN(priceNum) && !isNaN(mrpNum) && !isNaN(discPct) && discPct >= 0 && discPct <= 100) {
        const priceCalc = Math.round(mrpNum * (1 - discPct / 100));
        if (priceCalc > 0) {
            processed.price = String(priceCalc);
            priceNum = priceCalc;
        }
    }
    
    // Add current date
    const now = new Date();
    processed.date = now.toISOString().split('T')[0];
    processed.datetime = now.getTime();
    processed.updatedatetime = now.getTime();
    
    return processed;
}

async function extractDataUsingXPath(driver, xpath, type) {
    if (type === 'xpath') {
        return await driver.findElement(By.xpath(xpath)).getText();
    }
    return null;
}

async function extractText(element, type, selector) {
    try {
        if (type === "css") {
            return await element.findElement(By.css(selector)).getText();
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Export the functions for use in other files
module.exports = {
    loadConfig,
    scrapePage,
    postProcessProductData
};
