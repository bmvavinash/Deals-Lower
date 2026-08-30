#!/usr/bin/env node
'use strict';

require('dotenv').config();
require('./setup-firebase');
const { extractBanners, BannerExtractor } = require('../dataSources/bannerExtractor');
const bannerDB = require('../database/firebaseDB/bannerDB');

const { executionTracker } = require('../services/executionTracker');

/**
 * Runner script to extract banners from all platform homepages and store in Firebase
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting banners-runner...`);
  
  // Set 15-minute timeout
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] TIMEOUT: banners-runner exceeded 15 minutes`);
    process.exit(1);
  }, 15 * 60 * 1000);

  try {
    let results;
    await executionTracker.startDbUpdateExecution('banners-fetch', 'github-actions', { origin: 'GitHub Actions' });
    
    if (typeof extractBanners === 'function') {
      const extractor = new (BannerExtractor || function(){ this.extractBanners = extractBanners; })();
      if (BannerExtractor && typeof extractor.extractBanners === 'function') {
        extractor.useExistingChrome = false;
        results = await extractor.extractBanners();
      } else {
        results = await extractBanners({ useExistingChrome: false });
      }
    } else if (BannerExtractor) {
      const extractor = new BannerExtractor({ useExistingChrome: false });
      results = await extractor.extractBanners();
    } else {
      throw new Error("Could not find extractBanners or BannerExtractor in ../dataSources/bannerExtractor");
    }
    
    await executionTracker.endDbUpdateExecution('completed', results);
    console.log(`[${new Date().toISOString()}] Results summary:`, JSON.stringify(results, null, 2));
    console.log(`[${new Date().toISOString()}] Completed successfully.`);
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in banners-runner:`, error);
    try { await executionTracker.endDbUpdateExecution('failed', { error: error.message }); } catch(e){}
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
