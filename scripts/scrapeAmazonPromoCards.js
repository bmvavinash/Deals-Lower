#!/usr/bin/env node

/**
 * Automated Amazon Promotional Cards Scraper
 * 
 * Scrapes the Amazon Great Indian Festival / Event horizontal card carousel (#gwm-window).
 * Captures pixel-perfect card screenshots and extracts click URLs, titles, and price badges.
 * 
 * Includes Deduplication & Upsert Logic:
 * Checks if a card is already present by Image/GIF URL or Click Redirect URL.
 * If already present, updates the existing card in place rather than creating duplicates.
 */

const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { upsertPromoCard, deduplicatePromoCards, isSamePromoCard, applyPlatformTimedSlotRules } = require('../services/promoCardManager');

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

  // Load existing cards to update them in place rather than creating duplicates
  let masterCards = [];
  if (fs.existsSync(OUTPUT_JSON_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(OUTPUT_JSON_FILE, 'utf8'));
      masterCards = deduplicatePromoCards(raw);
      console.log(`📦 Loaded ${masterCards.length} existing cards for deduplication & upsert`);
    } catch (e) {
      console.warn('⚠️ Could not parse existing cards JSON:', e.message);
    }
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

        // Check if this is an animated/video promo tile (e.g. 8PM deals or Handpicked deals)
        // Strictly inspect video elements (do NOT match picture > source)
        const videos = await tile.findElements(By.css('video'));
        let videoSrc = '';
        if (videos.length > 0) {
          try {
            videoSrc = await videos[0].getAttribute('src');
            if (!videoSrc) {
              const srcEl = await videos[0].findElements(By.css('source'));
              if (srcEl.length > 0) videoSrc = await srcEl[0].getAttribute('src');
            }
          } catch {}
        }

        const is8PM = text.includes('8PM') || text.includes('8 PM') || (href && href.includes('ref_=wd8PM')) || (videoSrc && videoSrc.includes('B1nvkccQ3cL'));
        const isHandpicked = text.toLowerCase().includes('handpicked') || text.includes('3 PM') || text.includes('3PM');
        let cardImageUrl = `/banners/${filename}`;
        let cardId = `amazon_promo_scraped_${i + 1}`;

        if (is8PM) {
          cleanTitle = '8PM Deals Live Now';
          priceBadge = 'Live Now';
          cardImageUrl = '/banners/amazon_8pm_deals.gif';
          cardId = 'amazon_8pm_promo';
        } else if (isHandpicked) {
          cleanTitle = 'Handpicked Deals - 3 PM Picks';
          priceBadge = 'Up to 80% off';
          cardImageUrl = '/banners/amazon_promo_handpicked.gif';
          cardId = 'amazon_handpicked_promo';
        }

        const cardObj = {
          id: cardId,
          title: cleanTitle,
          priceBadge,
          imageUrl: cardImageUrl,
          clickRedirectUrl: href,
          platform: 'amazon'
        };

        if (videoSrc) {
          cardObj.videoUrl = videoSrc;
        }

        // UPSERT: Match by GIF url or redirect url. If already present -> update; else create.
        const { isUpdated } = upsertPromoCard(masterCards, cardObj);
        if (isUpdated) {
          console.log(`🔄 [${i + 1}/${tiles.length}] Updated existing card: "${cleanTitle}" (${cardImageUrl})`);
        } else {
          console.log(`📸 [${i + 1}/${tiles.length}] Created new card: "${cleanTitle}" (${cardImageUrl})`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to capture tile ${i + 1}:`, err.message);
      }
    }

    // Always ensure the 8PM promo card (with its labeled GIF and destination URL) is present & updated
    upsertPromoCard(masterCards, {
      id: 'amazon_8pm_promo',
      title: '8PM Deals Live Now',
      tagline: 'Powered by SAMSUNG Galaxy | intel Core ULTRA',
      priceBadge: 'Live Now',
      category: 'Festive Deals',
      imageUrl: '/banners/amazon_8pm_deals.gif',
      clickRedirectUrl: 'https://www.amazon.in/events/greatindianfestival/15/?_encoding=UTF8&ref_=wd8PM',
      platform: 'amazon',
      videoUrl: 'https://m.media-amazon.com/images/I/B1nvkccQ3cL.mp4'
    });

    // Position 8PM promo card at index 0 as featured prime-time tile
    const p8Idx = masterCards.findIndex(c => c.id === 'amazon_8pm_promo' || c.imageUrl?.includes('amazon_8pm_deals.gif'));
    if (p8Idx > 0) {
      const [p8Card] = masterCards.splice(p8Idx, 1);
      masterCards.unshift(p8Card);
    }

    // Final deduplication pass to ensure strictly 0 duplicate GIF or redirect URLs
    masterCards = deduplicatePromoCards(masterCards);
    // Platform timed-slot rules: e.g. when 8PM is live on Amazon, 3PM is disabled & removed from display
    masterCards = applyPlatformTimedSlotRules(masterCards, { filterForDisplay: true });

    if (masterCards.length > 0) {
      fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(masterCards, null, 2));
      console.log(`\n🎉 Successfully processed & deduplicated ${masterCards.length} promotional cards!`);
      console.log(`📁 Saved metadata to ${OUTPUT_JSON_FILE}`);

      // Sync to Firebase RTDB if available
      try {
        let admin;
        try { admin = require('firebase-admin'); } catch {}
        if (admin && (!admin.apps || admin.apps.length === 0)) {
          try { require('../database/firebaseDB/productDealsDB'); } catch {}
        }
        if (admin && admin.apps && admin.apps.length > 0) {
          await admin.database().ref('amazon_promo_cards').set(masterCards);
          await admin.database().ref('amazon_promo_cards_meta').set({
            count: masterCards.length,
            lastUpdated: new Date().toISOString(),
            source: 'scraper_upsert'
          });
          console.log(`🔥 Synced ${masterCards.length} deduplicated promo cards to Firebase Realtime Database (/amazon_promo_cards)`);
        }
      } catch (fbErr) {
        console.warn('Firebase RTDB sync warning:', fbErr.message);
      }

      return masterCards;
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
