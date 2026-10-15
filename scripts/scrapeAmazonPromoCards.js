#!/usr/bin/env node

/**
 * Automated Amazon Promotional Cards Scraper
 * 
 * Scrapes the Amazon Great Indian Festival / Event horizontal card carousel (#gwm-window)
 * Captures pixel-perfect card screenshots and extracts click URLs, titles, and price badges.
 */

const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

const DEALS_BANNERS_DIR = path.join(__dirname, '../frontend/public/banners');
const AFFILIATE_BANNERS_DIR = path.resolve(__dirname, '../../Affiliate/amazon_layout_carousels_alignment/public/banners');
const OUTPUT_JSON_FILE = path.join(__dirname, '../database/amazon_promo_cards.json');

async function scrapeAmazonPromoCards() {
  console.log('🚀 Starting Amazon Promotional Cards Scraper...');
  
  [DEALS_BANNERS_DIR, AFFILIATE_BANNERS_DIR, path.dirname(OUTPUT_JSON_FILE)].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920,1080',
    '--device-scale-factor=2',
    '--disable-blink-features=AutomationControlled',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  options.excludeSwitches(['enable-automation']);

  let driver;
  try {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    console.log('✅ Chrome WebDriver initialized');

    console.log('📡 Navigating to Amazon India homepage (https://www.amazon.in)...');
    await driver.get('https://www.amazon.in');
    await driver.sleep(4000);

    const gwmWindow = await driver.findElement(By.id('gwm-window'));
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', gwmWindow);
    await driver.sleep(1500);

    let tiles = await driver.findElements(By.css('#gwm-window .gwm-window-tile'));
    console.log(`🔍 Detected ${tiles.length} cards in #gwm-window carousel`);

    const scrapedCards = [];

    for (let i = 0; i < tiles.length; i++) {
      tiles = await driver.findElements(By.css('#gwm-window .gwm-window-tile'));
      if (i >= tiles.length) break;

      const tile = tiles[i];
      await driver.executeScript('arguments[0].scrollIntoView({inline: "center", block: "nearest"});', tile);
      await driver.sleep(600);

      const text = (await tile.getText()).replace(/\s+/g, ' ').trim();
      const links = await tile.findElements(By.css('a[href]'));
      let href = '';
      if (links.length > 0) {
        href = await links[0].getAttribute('href');
      }

      if (!href && text.length < 3) continue;

      const filename = `card_scraped_${i + 1}.png`;
      const dealsPath = path.join(DEALS_BANNERS_DIR, filename);
      const affiliatePath = path.join(AFFILIATE_BANNERS_DIR, filename);

      try {
        const b64 = await tile.takeScreenshot();
        const buf = Buffer.from(b64, 'base64');
        fs.writeFileSync(dealsPath, buf);
        try { fs.writeFileSync(affiliatePath, buf); } catch {}

        let title = text.replace(/(\*T&C apply|Free Delivery|Easy Returns|Wide Selection|Pause)/gi, '').trim();
        const lines = title.split(/\s{2,}|\n/).map(s => s.trim()).filter(Boolean);
        const cleanTitle = lines.slice(0, 2).join(' ') || `Amazon Festival Deal ${i + 1}`;
        const priceBadge = cleanTitle.match(/(?:Under|Starting|From|Up to|Min\.?)\s*₹?\s*[\d,]+%?/i)?.[0] || 'Live Now';

        scrapedCards.push({
          id: `amazon_promo_scraped_${i + 1}`,
          title: cleanTitle,
          priceBadge,
          imageUrl: `/banners/${filename}`,
          clickRedirectUrl: href,
          platform: 'amazon'
        });

        console.log(`📸 [${i + 1}/${tiles.length}] Captured "${cleanTitle}" -> ${filename}`);
      } catch (err) {
        console.warn(`⚠️ Failed to capture tile ${i + 1}:`, err.message);
      }
    }

    fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(scrapedCards, null, 2));
    console.log(`\n🎉 Successfully scraped ${scrapedCards.length} promotional cards!`);
    console.log(`📁 Saved metadata to ${OUTPUT_JSON_FILE}`);

    return scrapedCards;
  } catch (error) {
    console.error('❌ Error during Amazon card scraping:', error.message);
    throw error;
  } finally {
    if (driver) await driver.quit();
  }
}

if (require.main === module) {
  scrapeAmazonPromoCards().catch(() => process.exit(1));
}

module.exports = { scrapeAmazonPromoCards };
