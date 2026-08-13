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
    'https://www.amazon.in/s?k=tablets',
    'https://www.amazon.in/s?k=cameras'
  ],
  'fashion': [
    'https://www.amazon.in/s?k=men+shirts',
    'https://www.amazon.in/s?k=women+dresses',
    'https://www.amazon.in/s?k=shoes',
    'https://www.amazon.in/s?k=watches',
    'https://www.amazon.in/s?k=handbags'
  ],
  'home-kitchen': [
    'https://www.amazon.in/s?k=kitchen+appliances',
    'https://www.amazon.in/s?k=furniture',
    'https://www.amazon.in/s?k=home+decor',
    'https://www.amazon.in/s?k=cookware'
  ],
  'sports-fitness': [
    'https://www.amazon.in/s?k=fitness+equipment',
    'https://www.amazon.in/s?k=sports+shoes',
    'https://www.amazon.in/s?k=gym+equipment'
  ],
  'beauty-personal-care': [
    'https://www.amazon.in/s?k=skincare',
    'https://www.amazon.in/s?k=makeup',
    'https://www.amazon.in/s?k=hair+care'
  ],
  'automotive': [
    'https://www.amazon.in/s?k=car+accessories',
    'https://www.amazon.in/s?k=automotive+parts'
  ],
  'baby-kids': [
    'https://www.amazon.in/s?k=baby+products',
    'https://www.amazon.in/s?k=kids+toys'
  ],
  'grocery': [
    'https://www.amazon.in/s?k=grocery',
    'https://www.amazon.in/s?k=food+items'
  ],
  'books-stationery': [
    'https://www.amazon.in/s?k=books',
    'https://www.amazon.in/s?k=stationery',
    'https://www.amazon.in/s?k=office+supplies'
  ],
  'deals-trending': [
    'https://www.amazon.in/deals',
    'https://www.amazon.in/gp/bestsellers'
  ]
};

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
    const results = await runBatch(seeds, 'website', CATEGORY);
    console.log(`[${new Date().toISOString()}] Results summary:`, JSON.stringify(results, null, 2));
    console.log(`[${new Date().toISOString()}] Completed successfully.`);
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in category-runner:`, error);
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
