const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { scrapeProduct } = require("../scrappers/amazon");
const { getAccessToken } = require("../database/getAccessToken");
const constants = require("../config/constants");
const config = require("../config/config");
const updateProduct = require("../database/firebaseDB/firebaseUpdate");
const { storeMap } = require("../config/const");
const { getModuleLogger } = require("../logger/logger");
const { getformattedDate } = require("../utils/commonUtils");
const { areSpecsMatching } = require("../utils/specMatcher");

const logger = getModuleLogger('live-competitor-scraper');

// Helper to normalize platform name (e.g. 'amazon' -> 'Amazon')
function formatPlatformName(platform) {
  if (!platform) return '';
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

// Helper to extract category Group
function extractCategory(product) {
  if (product.categoryGroup) return product.categoryGroup;
  if (product.hierarchicalCategory && product.hierarchicalCategory.mainCategory) {
    return product.hierarchicalCategory.mainCategory;
  }
  if (product.category && product.category.mainCategory) {
    return product.category.mainCategory;
  }
  return 'Unknown';
}

// Initialize Selenium WebDriver
async function getWebDriver() {
  logger.info('Initializing clean headless WebDriver...');
  
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1920,1080');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  options.excludeSwitches(['enable-automation']);
  
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
  return driver;
}


// Search product on competitor platform
async function searchCompetitorProduct(driver, platform, query) {
  let searchUrl = "";
  if (platform === "amazon") {
    searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  } else if (platform === "flipkart") {
    searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  } else if (platform === "myntra") {
    searchUrl = `https://www.myntra.com/search?rawQuery=${encodeURIComponent(query)}`;
  } else if (platform === "ajio") {
    searchUrl = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
  } else {
    throw new Error(`Unsupported search platform: ${platform}`);
  }

  logger.info(`[${platform}] Navigating to search: ${searchUrl}`);
  await driver.get(searchUrl);
  
  // Wait for content load
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  let firstHref = null;
  try {
    if (platform === "amazon") {
      const links = await driver.findElements(By.css('div[data-component-type="s-search-result"] h2 a, div[data-component-type="s-search-result"] a.a-link-normal.s-no-outline'));
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && href.includes('/dp/')) {
          firstHref = href;
          break;
        }
      }
    } else if (platform === "flipkart") {
      const links = await driver.findElements(By.css('a[href*="/p/"]'));
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && href.includes('/p/')) {
          firstHref = href;
          break;
        }
      }
    } else if (platform === "myntra") {
      const links = await driver.findElements(By.css('.product-base a'));
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href) {
          firstHref = href;
          break;
        }
      }
    } else if (platform === "ajio") {
      const links = await driver.findElements(By.css('a.rilrtl-products-list__link, a[href*="/p/"], .preview a'));
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && href.includes('/p/')) {
          firstHref = href;
          break;
        }
      }
    }
  } catch (err) {
    logger.error(`Error during search link extraction: ${err.message}`);
  }
  
  // Resolve relative URLs
  if (firstHref && !firstHref.startsWith('http')) {
    let domain = "";
    if (platform === "amazon") domain = "https://www.amazon.in";
    else if (platform === "flipkart") domain = "https://www.flipkart.com";
    else if (platform === "myntra") domain = "https://www.myntra.com";
    else if (platform === "ajio") domain = "https://www.ajio.com";
    firstHref = domain + (firstHref.startsWith('/') ? '' : '/') + firstHref;
  }
  
  return firstHref;
}

// Main execution function
async function runLiveCompetitorScraper() {
  logger.info("Starting Active Live-Scraping & Competitor Matching...");
  
  let driver = null;
  try {
    // 1. Fetch matching config rules
    logger.info("Fetching category matching rules...");
    const accessToken = await getAccessToken(constants.env);
    const DB_Name = config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
    const baseUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    const configUrl = `${baseUrl}/config/categoryMatchingRules.json?access_token=${accessToken}`;
    
    const configRes = await fetch(configUrl);
    const matchingRules = await configRes.json();
    
    if (!matchingRules || Object.keys(matchingRules).length === 0) {
      logger.info("No category matching rules found in DB. Exiting.");
      return;
    }
    
    logger.info("Matching Rules loaded:", matchingRules);

    // 2. Fetch all products (shallow) from DB to get keys safely
    logger.info("Fetching product keys (shallow) from DB...");
    const keysUrl = `${baseUrl}/deals.json?access_token=${accessToken}&shallow=true`;
    const keysRes = await fetch(keysUrl);
    const keysData = await keysRes.json() || {};
    const allKeys = Object.keys(keysData);
    logger.info(`Found ${allKeys.length} total keys in DB.`);

    // Take the 150 most recent keys to avoid timeouts and download overhead
    const recentKeys = allKeys.slice(-150);
    logger.info(`Fetching details for the ${recentKeys.length} most recent products...`);

    const productsData = {};
    const batchSize = 30;
    for (let i = 0; i < recentKeys.length; i += batchSize) {
      const batchKeys = recentKeys.slice(i, i + batchSize);
      const batchPromises = batchKeys.map(async (key) => {
        try {
          const prodUrl = `${baseUrl}/deals/${key}.json?access_token=${accessToken}`;
          const res = await fetch(prodUrl);
          const data = await res.json();
          if (data) {
            productsData[key] = data;
          }
        } catch (err) {
          logger.warn(`Failed to fetch product details for ${key}: ${err.message}`);
        }
      });
      await Promise.all(batchPromises);
    }
    const productKeys = Object.keys(productsData);
    logger.info(`Successfully fetched details for ${productKeys.length} products.`);


    // 3. Find candidates for active scraping
    const candidates = [];
    for (const key of productKeys) {
      const product = productsData[key];
      if (!product) continue;
      
      const category = extractCategory(product);
      const ruleKey = Object.keys(matchingRules).find(k => k.toLowerCase() === category.toLowerCase());
      if (!ruleKey) continue;
      
      const allowedPlatforms = matchingRules[ruleKey].map(p => p.toLowerCase());
      const storeType = (product.storeType || '').toLowerCase();
      
      if (!allowedPlatforms.includes(storeType)) continue;
      
      // Check if this product is missing any of the other allowed platforms in competitorMatches
      const currentMatches = product.competitorMatches || {};
      const missingPlatforms = allowedPlatforms.filter(plat => plat !== storeType && !currentMatches[formatPlatformName(plat)]);
      
      if (missingPlatforms.length > 0) {
        candidates.push({
          key,
          product,
          category: ruleKey,
          missingPlatforms
        });
      }
    }
    
    logger.info(`Found ${candidates.length} candidate products missing competitor matches.`);
    
    if (candidates.length === 0) {
      logger.info("No missing competitor matches found. System is fully matched.");
      return;
    }
    
    // Group candidates by category to pick one or a few from each category
    const candidatesByCategory = {};
    for (const cand of candidates) {
      if (!candidatesByCategory[cand.category]) {
        candidatesByCategory[cand.category] = [];
      }
      candidatesByCategory[cand.category].push(cand);
    }
    
    // Select batch to scrape (up to 2 products per category to prevent overloading/timeouts)
    const selectedBatch = [];
    const maxProductsPerCategory = 2;
    for (const category in candidatesByCategory) {
      const selected = candidatesByCategory[category].slice(0, maxProductsPerCategory);
      selectedBatch.push(...selected);
    }
    
    logger.info(`Selected ${selectedBatch.length} products for active competitor scraping.`);

    // 4. Initialize Selenium WebDriver
    driver = await getWebDriver();
    
    let successCount = 0;
    
    // 5. Loop and process selected batch
    for (let index = 0; index < selectedBatch.length; index++) {
      const cand = selectedBatch[index];
      const originalKey = cand.key;
      const originalProd = cand.product;
      const category = cand.category;
      
      logger.info(`[Product ${index + 1}/${selectedBatch.length}] Processing "${originalProd.title?.substring(0, 40)}" (${formatPlatformName(originalProd.storeType)}) in category: ${category}`);
      
      // Determine search query: prioritize model, fallback to brand + title prefix
      let query = "";
      if (originalProd.model && originalProd.model.trim() !== "") {
        query = `${originalProd.brand || ''} ${originalProd.model}`.trim();
      } else {
        const brand = originalProd.brand || "";
        const titleWords = (originalProd.title || "").split(/\s+/).slice(0, 4).join(" ");
        query = `${brand} ${titleWords}`.trim();
      }
      
      for (const targetPlat of cand.missingPlatforms) {
        logger.info(`Attempting to find match on [${formatPlatformName(targetPlat)}] using query: "${query}"`);
        
        try {
          const compUrl = await searchCompetitorProduct(driver, targetPlat, query);
          if (!compUrl) {
            logger.warn(`No product match found for query on [${formatPlatformName(targetPlat)}]`);
            continue;
          }
          
          logger.info(`Found competitor URL: ${compUrl}. Scraping product details...`);
          
          await driver.get(compUrl);
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          const storeKey = targetPlat;
          const storeInfo = storeMap[storeKey];
          if (!storeInfo) {
            logger.error(`Store configuration not found for platform: ${targetPlat}`);
            continue;
          }
          
          const compCode = storeInfo.getCode(compUrl);
          if (!compCode) {
            logger.error(`Could not extract product code from URL: ${compUrl}`);
            continue;
          }
          
          // Scrape the competitor product details
          const scrapedProd = await scrapeProduct(compUrl, storeKey, driver, "", false, "", true, "");
          if (!scrapedProd || !scrapedProd.title) {
            logger.warn(`Scraped competitor product is invalid (missing title). Skipping.`);
            continue;
          }
          
          const isUnavailable = !scrapedProd.price || Number(String(scrapedProd.price).replace(/[^0-9.]/g, '')) === 0;
          if (isUnavailable) {
            logger.info(`Scraped competitor product is currently unavailable/out of stock. Setting price to 0.`);
            scrapedProd.price = 0;
          }
          
          // Enrich scraped product properties
          scrapedProd.productCode = scrapedProd.productCode || compCode;
          scrapedProd.storeType = storeInfo.storeType;
          scrapedProd.categoryGroup = category;
          scrapedProd.date = String(getformattedDate());
          scrapedProd.updatedatetime = Date.now();
          scrapedProd.datetime = Date.now();
          scrapedProd.productType = "Affiliate";
          scrapedProd.isOutOfStock = isUnavailable || (scrapedProd.stockStatus ? scrapedProd.stockStatus.includes("OUT OF STOCK") : false);
          if (!scrapedProd.links) scrapedProd.links = {};
          
          // Strict spec verification before linking
          if (!areSpecsMatching(originalProd, scrapedProd, category)) {
            logger.warn(`Spec mismatch between original ${originalKey} ("${originalProd.title}") and scraped ${compCode} ("${scrapedProd.title}"). Skipping link.`);
            continue;
          }
          
          // Construct the competitorMatches object to link them together
          const competitorMatches = {
            ...(originalProd.competitorMatches || {}),
            [formatPlatformName(originalProd.storeType)]: {
              key: originalKey,
              price: originalProd.price || 0,
              link: originalProd.links?.avinashbmv || originalProd.links?.avinashbmvINR || originalProd.productUrl || ''
            },
            [formatPlatformName(targetPlat)]: {
              key: compCode,
              price: scrapedProd.price || 0,
              link: scrapedProd.links?.avinashbmv || scrapedProd.links?.avinashbmvINR || scrapedProd.productUrl || ''
            }
          };
          
          // Update matches on competitor product
          scrapedProd.competitorMatches = competitorMatches;
          
          // Update matches on original product in our local cache so future iterations see it
          originalProd.competitorMatches = competitorMatches;
          
          // Save competitor product to Firebase
          logger.info(`Saving scraped competitor product ${compCode} to Firebase...`);
          await updateProduct(compCode, scrapedProd, accessToken, constants.env, 'deals');
          
          // Save updated original product to Firebase
          logger.info(`Saving updated original product ${originalKey} to Firebase...`);
          await updateProduct(originalKey, originalProd, accessToken, constants.env, 'deals');
          
          logger.info(`✅ Successfully matched and linked ${originalKey} (${formatPlatformName(originalProd.storeType)}) with ${compCode} (${formatPlatformName(targetPlat)})`);
          successCount++;
          
        } catch (scrapErr) {
          logger.error(`Error processing match for competitor platform ${targetPlat}: ${scrapErr.message}`, { stack: scrapErr.stack });
        }
      }
    }
    
    logger.info(`Active live-scraping completed successfully. Matched ${successCount} products.`);
    
  } catch (error) {
    logger.error('Error during active live competitor matching:', { error: error.message, stack: error.stack });
  } finally {
    if (driver) {
      try {
        await driver.quit();
        logger.info("Driver session closed.");
      } catch (err) {
        logger.error(`Failed to close driver: ${err.message}`);
      }
    }
  }
}

// Standalone execution check
if (require.main === module) {
  // Set TLS reject unauthorized to 0 for local execution behind proxies
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  runLiveCompetitorScraper().then(() => {
    logger.info("Process finished.");
    process.exit(0);
  });
}

module.exports = {
  runLiveCompetitorScraper
};
