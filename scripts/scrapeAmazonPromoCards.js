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
  
  if (!fs.existsSync(DEALS_BANNERS_DIR)) {
    try { fs.mkdirSync(DEALS_BANNERS_DIR, { recursive: true }); } catch {}
  }
  if (!fs.existsSync(path.dirname(OUTPUT_JSON_FILE))) {
    try { fs.mkdirSync(path.dirname(OUTPUT_JSON_FILE), { recursive: true }); } catch {}
  }
  if (fs.existsSync(path.dirname(AFFILIATE_BANNERS_DIR))) {
    try { fs.mkdirSync(AFFILIATE_BANNERS_DIR, { recursive: true }); } catch {}
  }

  const options = new chrome.Options();
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--device-scale-factor=2',
    '--disable-blink-features=AutomationControlled',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  options.excludeSwitches(['enable-automation']);

  // Set headless unless explicitly disabled
  if (process.env.HEADLESS !== 'false' && process.env.HEADFUL !== 'true') {
    options.addArguments('--headless=new');
  }

  let driver;
  try {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    console.log('✅ Chrome WebDriver initialized');

    console.log('📡 Navigating to Amazon India homepage (https://www.amazon.in)...');
    await driver.get('https://www.amazon.in');
    await driver.sleep(4000);

    let gwmWindow = null;
    try {
      gwmWindow = await driver.findElement(By.id('gwm-window'));
      await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', gwmWindow);
      await driver.sleep(1500);
    } catch (e) {
      console.warn('⚠️ #gwm-window carousel element not found directly on homepage:', e.message);
    }

    let tiles = [];
    if (gwmWindow) {
      tiles = await driver.findElements(By.css('#gwm-window .gwm-window-tile'));
    }
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

      try {
        const b64 = await tile.takeScreenshot();
        const buf = Buffer.from(b64, 'base64');
        try { fs.writeFileSync(dealsPath, buf); } catch {}
        if (fs.existsSync(AFFILIATE_BANNERS_DIR)) {
          try { fs.writeFileSync(path.join(AFFILIATE_BANNERS_DIR, filename), buf); } catch {}
        }

        let title = text.replace(/(\*T&C apply|Free Delivery|Easy Returns|Wide Selection|Pause)/gi, '').trim();
        const lines = title.split(/\s{2,}|\n/).map(s => s.trim()).filter(Boolean);
        let cleanTitle = lines.slice(0, 2).join(' ') || `Amazon Festival Deal ${i + 1}`;
        let priceBadge = cleanTitle.match(/(?:Under|Starting|From|Up to|Min\.?)\s*₹?\s*[\d,]+%?/i)?.[0] || 'Live Now';

        // Check if this is an animated/video promo tile (e.g. Handpicked deals)
        const videos = await tile.findElements(By.css('video, source'));
        let videoSrc = '';
        if (videos.length > 0) {
          try { videoSrc = await videos[0].getAttribute('src'); } catch {}
        }
        const isVideoCard = videos.length > 0 || text.toLowerCase().includes('handpicked');
        let cardImageUrl = `/banners/${filename}`;

        if (isVideoCard) {
          cleanTitle = 'Handpicked Deals - 3 PM Picks';
          priceBadge = 'Up to 80% off';
          cardImageUrl = '/banners/amazon_promo_handpicked.gif';
        }

        const cardObj = {
          id: isVideoCard ? 'amazon_handpicked_promo' : `amazon_promo_scraped_${i + 1}`,
          title: cleanTitle,
          priceBadge,
          imageUrl: cardImageUrl,
          clickRedirectUrl: href,
          platform: 'amazon'
        };

        if (videoSrc) {
          cardObj.videoUrl = videoSrc;
        }

        scrapedCards.push(cardObj);

        console.log(`📸 [${i + 1}/${tiles.length}] Captured "${cleanTitle}" -> ${cardImageUrl}`);
      } catch (err) {
        console.warn(`⚠️ Failed to capture tile ${i + 1}:`, err.message);
      }
    }

    if (scrapedCards.length > 0) {
      fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(scrapedCards, null, 2));
      console.log(`\n🎉 Successfully scraped ${scrapedCards.length} promotional cards!`);
      console.log(`📁 Saved metadata to ${OUTPUT_JSON_FILE}`);

      // Sync to Firebase RTDB if available
      try {
        let admin;
        try { admin = require('firebase-admin'); } catch {}
        if (admin && admin.apps && admin.apps.length > 0) {
          await admin.database().ref('amazon_promo_cards').set(scrapedCards);
          await admin.database().ref('amazon_promo_cards_meta').set({
            count: scrapedCards.length,
            lastUpdated: new Date().toISOString(),
            source: 'scraper'
          });
          console.log(`🔥 Synced ${scrapedCards.length} promo cards to Firebase Realtime Database (/amazon_promo_cards)`);
        }
      } catch (fbErr) {
        console.warn('Firebase RTDB sync warning:', fbErr.message);
      }

      return scrapedCards;
    } else {
      console.warn('⚠️ No cards scraped; preserving existing card dataset.');
      if (fs.existsSync(OUTPUT_JSON_FILE)) {
        return JSON.parse(fs.readFileSync(OUTPUT_JSON_FILE, 'utf8'));
      }
      return [];
    }
  } catch (error) {
    console.error('❌ Error during Amazon card scraping:', error.message);
    if (fs.existsSync(OUTPUT_JSON_FILE)) {
      console.log('Returning existing cached cards from file.');
      return JSON.parse(fs.readFileSync(OUTPUT_JSON_FILE, 'utf8'));
    }
    throw error;
  } finally {
    if (driver) {
      try { await driver.quit(); } catch {}
    }
  }
}

if (require.main === module) {
  scrapeAmazonPromoCards().catch(() => process.exit(1));
}

module.exports = { scrapeAmazonPromoCards };
