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
const { executionTracker } = require('../services/executionTracker');
const { githubActionLogger } = require('../services/githubActionLogger');
const { categorySeedManager } = require('../services/categorySeedManager');

/**
 * Runner script to scrape products for a specific category across all platforms
 * using dynamic round-robin rotation across all subcategories and popular A-to-Z search terms.
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const targetQuery = process.env.TARGET_QUERY || null;
  const actionName = `category-${CATEGORY.toLowerCase()}`;
  
  console.log(`[${new Date().toISOString()}] Starting category-runner for action: ${actionName} (isDryRun: ${isDryRun}, targetQuery: "${targetQuery || 'none'}")`);

  // Resolve dynamic rotating seeds (or target query override) using auto store-count calibrated batch sizing
  const seedData = await categorySeedManager.getSeedsForCategory(CATEGORY, targetQuery);
  const seeds = seedData.seeds;
  const selectedQueries = seedData.selectedQueries;

  if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
    console.error(`ERROR: No seed URLs resolved for category "${CATEGORY}".`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Processing ${seeds.length} seed URLs across ${selectedQueries.length} queries for category: ${CATEGORY}`);
  console.log(`[${new Date().toISOString()}] Selected Queries for this run: ${selectedQueries.join(', ')}`);

  if (isDryRun) {
    console.log('[DRY-RUN] Resolved URLs:');
    seeds.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
    console.log('[DRY-RUN] Completed without scraping.');
    process.exit(0);
  }

  let isDone = false;
  // Safety internal watchdog timer: 45 minutes (matching the 50-minute workflow ceiling)
  const timeoutId = setTimeout(async () => {
    if (isDone) return;
    console.error(`[${new Date().toISOString()}] WATCHDOG TIMEOUT: category-runner reached 45 minutes. Gracefully finalizing.`);
    try {
      await githubActionLogger.failAction(actionName, new Error('Runner reached 45-minute watchdog ceiling'));
      await executionTracker.completeBulkExecution({ status: 'timeout', error: 'Runner reached 45-minute ceiling' });
    } catch (_) {}
    process.exit(0);
  }, 45 * 60 * 1000);

  // Start tracking across logging systems with rich metadata
  await githubActionLogger.startAction(actionName, {
    category: CATEGORY,
    seedsCount: seeds.length,
    selectedQueries,
    isOverride: seedData.isOverride,
    nextPointer: seedData.nextPointer
  });

  try {
    await executionTracker.startBulkExecution('github-actions', 'productdeals', {
      origin: 'GitHub Actions',
      category: CATEGORY,
      selectedQueries
    });
  } catch (trackerErr) {
    console.warn('Execution tracker start warning:', trackerErr.message);
  }

  try {
    // Run batch with targetDb: 'productdeals' so it updates productdeals & productdeals_static
    console.log(`[${new Date().toISOString()}] Launching runBatch for ${seeds.length} URLs...`);
    const results = await runBatch(seeds, 'website', CATEGORY, 'productdeals');

    // Collect any errors, blocked URLs (e.g. Ajio WAF), or failures to delegate to Oracle VM / localDaemon
    const failedItems = [];
    if (results && Array.isArray(results.errors)) {
      for (const err of results.errors) {
        failedItems.push({ url: err.url, reason: err.error || 'Scrape error' });
      }
    }

    // Complete tracking and auto-enqueue missed items to commandsQueue for Oracle Cloud / localDaemon
    await githubActionLogger.completeAction(actionName, {
      category: CATEGORY,
      selectedQueries,
      ...results
    }, failedItems);

    try {
      await executionTracker.completeBulkExecution({ category: CATEGORY, ...results });
    } catch (trackerErr) {
      console.warn('Execution tracker complete warning:', trackerErr.message);
    }

    console.log(`[${new Date().toISOString()}] Results summary:`, JSON.stringify(results, null, 2));
    console.log(`[${new Date().toISOString()}] Category runner finished successfully.`);
    isDone = true;
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in category-runner:`, error);
    await githubActionLogger.failAction(actionName, error);
    try { 
      await executionTracker.completeBulkExecution({ status: 'failed', error: error.message }); 
    } catch (_) {}
    isDone = true;
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
