#!/usr/bin/env node
'use strict';

require('dotenv').config();
process.env.IS_CI = 'true';

require('./setup-firebase');
const { favoritesNotificationService } = require('../services/favoritesNotificationService');
const { executionTracker } = require('../services/executionTracker');
const { githubActionLogger } = require('../services/githubActionLogger');

/**
 * Runner script to check user favorites against current deals and send notifications
 */
async function main() {
  const actionName = 'favorites-check';
  console.log(`[${new Date().toISOString()}] Starting favorites-runner...`);
  
  // Set 10-minute timeout
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] TIMEOUT: favorites-runner exceeded 10 minutes`);
    process.exit(1);
  }, 10 * 60 * 1000);
  
  await githubActionLogger.startAction(actionName, { type: 'favorites' });
  try {
    await executionTracker.startDbUpdateExecution('favorites-check', 'github-actions', { origin: 'GitHub Actions' });
  } catch (_) {}

  try {
    const results = await favoritesNotificationService.processFavoritesAndNotifications('github-actions');
    
    await githubActionLogger.completeAction(actionName, results || {});
    try {
      await executionTracker.endDbUpdateExecution('completed', results);
    } catch (_) {}

    console.log(`[${new Date().toISOString()}] Results summary:`, JSON.stringify(results, null, 2));
    console.log(`[${new Date().toISOString()}] Completed successfully.`);
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in favorites-runner:`, error);
    await githubActionLogger.failAction(actionName, error);
    try {
      await executionTracker.endDbUpdateExecution('failed', { error: error.message });
    } catch (_) {}
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
