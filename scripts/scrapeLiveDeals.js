const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");
const { initializeDriver, closeDriver, extractAndStoreFromUrl } = require("../dataSources/batchProductExtractor");
const { getModuleLogger } = require("../logger/logger");
const logger = getModuleLogger('scrapeLiveDeals');

async function scrapeLiveDeals() {
    let driver;
    try {
        logger.info('Initializing driver for live deals extraction...');
        driver = await initializeDriver();
        
        const dealUrls = [];
        
        // 1. AMAZON LIVE DEALS
        try {
            logger.info('Navigating to Amazon to find active deals banner...');
            await driver.get('https://www.amazon.in');
            await driver.sleep(4000);
            
            // Find main hero/promo deals banner link
            const links = await driver.findElements(By.css('a'));
            let amazonDealUrl = null;
            let amazonDealName = 'Prime Day Sale';
            
            for (const link of links) {
                try {
                    const href = await link.getAttribute('href');
                    if (href && (
                        href.includes('/events/') || 
                        href.includes('/dealofday') || 
                        href.includes('/deals') || 
                        href.includes('/gp/goldbox') ||
                        href.includes('/bestsellers')
                    ) && !href.includes('signin') && !href.includes('register')) {
                        amazonDealUrl = href;
                        if (href.includes('primeday')) amazonDealName = 'Prime Day Sale';
                        else if (href.includes('greatsummersale')) amazonDealName = 'Great Summer Sale';
                        else if (href.includes('goldbox') || href.includes('deals')) amazonDealName = 'Lightning Deals';
                        else amazonDealName = 'Amazon Hot Deals';
                        break;
                    }
                } catch (_) {}
            }
            
            if (amazonDealUrl) {
                logger.info(`Found Amazon deals URL from banner: ${amazonDealUrl} (${amazonDealName})`);
                dealUrls.push({ url: amazonDealUrl, platform: 'amazon', dealName: amazonDealName });
            } else {
                logger.info('No custom promo banner URL matched on Amazon home, using fallback deals page.');
                dealUrls.push({ url: 'https://www.amazon.in/deals', platform: 'amazon', dealName: 'Lightning Deals' });
            }
        } catch (e) {
            logger.error('Failed to get Amazon deals banner link:', e.message);
        }
        
        // 2. FLIPKART LIVE DEALS
        try {
            logger.info('Navigating to Flipkart to find active deals banner...');
            await driver.get('https://www.flipkart.com');
            await driver.sleep(4000);
            
            const links = await driver.findElements(By.css('a'));
            let flipkartDealUrl = null;
            let flipkartDealName = 'Big Saving Days';
            
            for (const link of links) {
                try {
                    const href = await link.getAttribute('href');
                    if (href && (
                        href.includes('/offers-list/') || 
                        href.includes('/sale-event/') || 
                        href.includes('_sale_') ||
                        href.includes('/tyy/')
                    )) {
                        flipkartDealUrl = href;
                        if (href.includes('saving-days') || href.includes('saving')) flipkartDealName = 'Big Saving Days';
                        else if (href.includes('big-billion')) flipkartDealName = 'Big Billion Days';
                        else flipkartDealName = 'Flipkart Super Deals';
                        break;
                    }
                } catch (_) {}
            }
            
            if (flipkartDealUrl) {
                logger.info(`Found Flipkart deals URL from banner: ${flipkartDealUrl} (${flipkartDealName})`);
                dealUrls.push({ url: flipkartDealUrl, platform: 'flipkart', dealName: flipkartDealName });
            } else {
                logger.info('No custom promo banner URL matched on Flipkart home, using fallback offers page.');
                dealUrls.push({ url: 'https://www.flipkart.com/offers', platform: 'flipkart', dealName: 'Flipkart Super Deals' });
            }
        } catch (e) {
            logger.error('Failed to get Flipkart deals banner link:', e.message);
        }
        
        // 3. SCRAPE THE LANDING PAGES
        logger.info(`Starting scraping for ${dealUrls.length} deals landing pages...`);
        const ctx = { noProductUrls: [], pageTypeHits: {}, missingFieldLogs: [], errors: [], dedupedCount: 0, skippedUnchangedCount: 0, failedCount: 0 };
        
        for (const item of dealUrls) {
            try {
                logger.info(`Scraping ${item.platform} live deals: ${item.url} (${item.dealName})`);
                await driver.get(item.url);
                await driver.sleep(3000);
                
                // Extract products
                await extractAndStoreFromUrl(driver, item.url, 'website', 'deals', ctx, 'deals', item.platform, 'deals', 0);
                
                // Update properties in DB
                const admin = require('firebase-admin');
                const db = admin.database();
                const targetRef = db.ref('deals');
                const snapshot = await targetRef.orderByChild('sourceUrl').equalTo(item.url).once('value');
                const val = snapshot.val();
                if (val) {
                    const updates = {};
                    Object.keys(val).forEach(key => {
                        updates[`${key}/isDeal`] = true;
                        updates[`${key}/dealName`] = item.dealName;
                    });
                    await targetRef.update(updates);
                    logger.info(`Successfully marked ${Object.keys(updates).length} products as deal products for ${item.dealName}`);
                }
            } catch (err) {
                logger.error(`Error scraping live deals page ${item.url}:`, err.message);
            }
        }
        
    } catch (e) {
        logger.error('Fatal error in scrapeLiveDeals:', e.message);
    } finally {
        if (driver) {
            try { await closeDriver(driver); } catch (_) {}
        }
    }
}

if (require.main === module) {
    scrapeLiveDeals().then(() => {
        console.log('Live deals scraping completed!');
        process.exit(0);
    });
}
