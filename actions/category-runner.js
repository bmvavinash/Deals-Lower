#!/usr/bin/env node
'use strict';

require('dotenv').config();

const CATEGORY = process.env.CATEGORY;

if (!CATEGORY) {
  console.error('ERROR: CATEGORY environment variable is required.');
  process.exit(1);
}

require('./setup-firebase');
const { runBatch } = require('../dataSources/batchProductExtractor');

const PLATFORM_SEEDS = {
  'electronics': [
    'https://www.amazon.in/s?k=laptop',
    'https://www.amazon.in/s?k=mobile+phones',
    'https://www.amazon.in/s?k=headphones',
    'https://www.amazon.in/s?k=smartwatch',
    'https://www.flipkart.com/search?q=laptop',
    'https://www.flipkart.com/search?q=mobile+phones',
    'https://www.flipkart.com/search?q=headphones',
    'https://www.flipkart.com/search?q=smartwatch'
  ],
  'fashion': [
    'https://www.amazon.in/s?k=men+shirts',
    'https://www.amazon.in/s?k=women+dresses',
    'https://www.amazon.in/s?k=shoes',
    'https://www.flipkart.com/search?q=men+shirts',
    'https://www.flipkart.com/search?q=women+dresses',
    'https://www.myntra.com/men-shirts',
    'https://www.myntra.com/women-dresses',
    'https://www.myntra.com/shoes',
    'https://www.ajio.com/search/?text=men%20shirts',
    'https://www.ajio.com/search/?text=women%20dresses'
  ],
  'home-kitchen': [
    'https://www.amazon.in/s?k=kitchen+appliances',
    'https://www.amazon.in/s?k=furniture',
    'https://www.flipkart.com/search?q=kitchen+appliances',
    'https://www.flipkart.com/search?q=furniture'
  ],
  'sports-fitness': [
    'https://www.amazon.in/s?k=fitness+equipment',
    'https://www.amazon.in/s?k=sports+shoes',
    'https://www.flipkart.com/search?q=fitness+equipment',
    'https://www.flipkart.com/search?q=sports+shoes',
    'https://www.myntra.com/sports-shoes',
    'https://www.ajio.com/search/?text=sports%20shoes'
  ],
  'beauty-personal-care': [
    'https://www.amazon.in/s?k=skincare',
    'https://www.amazon.in/s?k=makeup',
    'https://www.flipkart.com/search?q=skincare',
    'https://www.flipkart.com/search?q=makeup',
    'https://www.myntra.com/skincare',
    'https://www.myntra.com/makeup'
  ],
  'automotive': [
    'https://www.amazon.in/s?k=car+accessories',
    'https://www.flipkart.com/search?q=car+accessories'
  ],
  'baby-kids': [
    'https://www.amazon.in/s?k=baby+products',
    'https://www.amazon.in/s?k=kids+toys',
    'https://www.flipkart.com/search?q=baby+products',
    'https://www.flipkart.com/search?q=kids+toys',
    'https://www.myntra.com/kids-wear',
    'https://www.ajio.com/search/?text=kids%20wear'
  ],
  'grocery': [
    'https://www.amazon.in/s?k=grocery',
    'https://www.flipkart.com/search?q=grocery'
  ],
  'books-stationery': [
    'https://www.amazon.in/s?k=books',
    'https://www.amazon.in/s?k=stationery',
    'https://www.flipkart.com/search?q=books',
    'https://www.flipkart.com/search?q=stationery'
  ],
  'deals-trending': [
    'https://www.amazon.in/deals',
    'https://www.amazon.in/gp/bestsellers',
    'https://www.flipkart.com/offers-store',
    'https://www.myntra.com/shop/offers'
  ]
};

const { executionTracker } = require('../services/executionTracker');

/**
 * Runner script to scrape products for a specific category across all platforms
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting category-runner for category: ${CATEGORY}`);
  
  const seeds = PLATFORM_SEEDS[CATEGORY];
  if (!seeds || !Array.isArray(seeds)) {
    console.error(`ERROR: Unknown category "${CATEGORY}". Valid categories: ${Object.keys(PLATFORM_SEEDS).join(', ')}`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Processing ${seeds.length} seed URLs for category: ${CATEGORY}`);

  // Set 15-minute timeout
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] TIMEOUT: category-runner exceeded 15 minutes`);
    process.exit(1);
  }, 15 * 60 * 1000);

  try {
    await executionTracker.startBulkExecution('github-actions', 'deals', { origin: 'GitHub Actions', category: CATEGORY });
    const results = await runBatch(seeds, 'website', CATEGORY);
    await executionTracker.completeBulkExecution({ category: CATEGORY, ...results });
    console.log(`[${new Date().toISOString()}] Results summary:`, JSON.stringify(results, null, 2));
    console.log(`[${new Date().toISOString()}] Completed successfully.`);
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in category-runner:`, error);
    try { await executionTracker.completeBulkExecution({ status: 'failed', error: error.message }); } catch(e){}
    clearTimeout(timeoutId);
    process.exit(1);
  }
}

// Handle termination signals for graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, exiting gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, exiting gracefully...');
  process.exit(0);
});

main();
