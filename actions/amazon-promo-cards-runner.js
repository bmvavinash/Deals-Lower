#!/usr/bin/env node
'use strict';

require('dotenv').config();
require('./setup-firebase');
try {
  require('../database/firebaseDB/bannerDB');
} catch (e) {
  console.warn('Firebase bannerDB init warning:', e.message);
}
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { scrapeAmazonPromoCards } = require('../scripts/scrapeAmazonPromoCards');
const { executionTracker } = require('../services/executionTracker');

/**
 * GitHub Actions Runner to scrape Amazon promotional cards and store in Firebase & JSON
 */
async function main() {
  console.log(`[${new Date().toISOString()}] 🎯 Starting amazon-promo-cards-runner...`);

  // Set 15-minute timeout
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] TIMEOUT: amazon-promo-cards-runner exceeded 15 minutes`);
    process.exit(1);
  }, 15 * 60 * 1000);

  try {
    try {
      if (executionTracker && typeof executionTracker.startDbUpdateExecution === 'function') {
        await executionTracker.startDbUpdateExecution('amazon-promo-cards-fetch', 'github-actions', { origin: 'GitHub Actions' });
      }
    } catch (e) {
      console.warn('Execution tracker start skipped:', e.message);
    }

    const cards = await scrapeAmazonPromoCards();
    console.log(`[${new Date().toISOString()}] 📦 Obtained ${cards.length} promotional cards.`);

    // 1. Sync to Firebase Realtime Database
    if (cards && cards.length > 0) {
      try {
        if (admin.apps.length === 0) {
          const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON 
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
            : undefined;
          if (serviceAccount) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app'
            });
          }
        }
        if (admin.apps.length > 0) {
          const db = admin.database();
          await db.ref('amazon_promo_cards').set(cards);
          await db.ref('amazon_promo_cards_meta').set({
            count: cards.length,
            lastUpdated: new Date().toISOString(),
            source: 'github-actions'
          });
          console.log(`[${new Date().toISOString()}] ✅ Successfully synced ${cards.length} promo cards to Firebase Realtime Database (/amazon_promo_cards).`);
        } else {
          console.warn(`[${new Date().toISOString()}] ⚠️ Firebase admin app not initialized, skipping RTDB sync.`);
        }
      } catch (fbErr) {
        console.warn(`[${new Date().toISOString()}] Firebase RTDB sync error:`, fbErr.message);
      }
    }

    // 2. Ensure database/amazon_promo_cards.json is persisted
    const jsonPath = path.join(__dirname, '../database/amazon_promo_cards.json');
    if (cards && cards.length > 0) {
      fs.writeFileSync(jsonPath, JSON.stringify(cards, null, 2), 'utf8');
      console.log(`[${new Date().toISOString()}] ✅ Persisted cards to ${jsonPath}`);
    }

    try {
      if (executionTracker && typeof executionTracker.endDbUpdateExecution === 'function') {
        await executionTracker.endDbUpdateExecution('completed', { count: cards.length });
      }
    } catch (e) {}

    console.log(`[${new Date().toISOString()}] 🎉 Amazon promo cards runner completed successfully.`);
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ ERROR in amazon-promo-cards-runner:`, error);
    try {
      if (executionTracker && typeof executionTracker.endDbUpdateExecution === 'function') {
        await executionTracker.endDbUpdateExecution('failed', { error: error.message });
      }
    } catch (e) {}
    clearTimeout(timeoutId);
    process.exit(1);
  }
}

// Graceful signal handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, exiting gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, exiting gracefully...');
  process.exit(0);
});

main();
