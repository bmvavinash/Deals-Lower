#!/usr/bin/env node
'use strict';

/**
 * GitHub Actions Runner: Time-Slot Deals Notifier
 * Triggers at 12 PM, 3 PM, 6 PM, 8 PM IST
 * 
 * Flow:
 * 1. Checks if deals are present for the given slot on today's date in IST.
 * 2. If deals exist, dispatches:
 *    - Web Push Notification (redirects to https://lowerdeal.com/sale/<slot>)
 *    - Telegram Channel Alert (@dealshubglobal & @dealshubglobal2)
 *    - Global In-App Notification (bell dropdown on LowerDeal)
 * 3. Enforces idempotency so users aren't repeatedly notified multiple times in the same day.
 * 4. Older deals from past days are strictly excluded.
 */

require('dotenv').config();
require('./setup-firebase');

const {
  checkAndNotifySlotDeals,
  fetchSlotDeals
} = require('../services/slotDealsNotificationService');
const {
  getISTDateString,
  getISTHour,
  normalizeSlotName,
  getCurrentOrClosestSlot,
  SLOT_CONFIG
} = require('../utils/dealSlotUtils');

// Parse command-line flags
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    slot: process.env.DEAL_SLOT || 'auto',
    force: false,
    date: null
  };

  for (const arg of args) {
    if (arg.startsWith('--slot=')) {
      options.slot = arg.split('=')[1];
    } else if (arg.startsWith('--force=')) {
      options.force = arg.split('=')[1] === 'true';
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const todayIST = options.date || getISTDateString();
  const activeSlot = options.slot === 'auto'
    ? getCurrentOrClosestSlot()
    : (normalizeSlotName(options.slot) || getCurrentOrClosestSlot());

  const slotInfo = SLOT_CONFIG[activeSlot] || { label: `${activeSlot.toUpperCase()} Deals` };

  console.log(`[${new Date().toISOString()}] ==================================================`);
  console.log(`[${new Date().toISOString()}] ⚡ STARTING SLOT DEALS NOTIFIER RUNNER`);
  console.log(`[${new Date().toISOString()}] Target Slot : ${activeSlot.toUpperCase()} (${slotInfo.label})`);
  console.log(`[${new Date().toISOString()}] Target Date : ${todayIST} (IST)`);
  console.log(`[${new Date().toISOString()}] Current Hour: ${getISTHour()} IST`);
  console.log(`[${new Date().toISOString()}] Force Mode  : ${options.force ? 'ENABLED' : 'DISABLED'}`);
  console.log(`[${new Date().toISOString()}] ==================================================`);

  // Hard timeout guard (10 minutes)
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] ❌ TIMEOUT: slot-deals-runner exceeded 10 minutes.`);
    process.exit(1);
  }, 10 * 60 * 1000);

  try {
    const result = await checkAndNotifySlotDeals({
      slot: activeSlot,
      date: todayIST,
      force: options.force
    });

    console.log(`[${new Date().toISOString()}] 📊 RUNNER RESULT:`, JSON.stringify(result, null, 2));

    if (result.skipped) {
      if (result.reason === 'already_sent_today') {
        console.log(`[${new Date().toISOString()}] ℹ️ Notification was already sent earlier today for ${activeSlot.toUpperCase()}. Exiting cleanly.`);
      } else if (result.reason === 'no_deals_for_slot') {
        console.log(`[${new Date().toISOString()}] ℹ️ No deals found for ${activeSlot.toUpperCase()} on ${todayIST}. Notification held until deals are present.`);
      }
    } else if (result.success) {
      console.log(`[${new Date().toISOString()}] 🎉 SUCCESS: Dispatched notifications for ${result.count} deals in ${activeSlot.toUpperCase()}!`);
      console.log(`[${new Date().toISOString()}] 📢 Web Push: ${result.webPush?.sent || 0} delivered`);
      console.log(`[${new Date().toISOString()}] ✈️ Telegram: ${result.telegram?.success ? 'Delivered' : 'Failed/Skipped'}`);
      console.log(`[${new Date().toISOString()}] 📱 In-App  : ${result.inAppSuccess ? 'Recorded' : 'Failed/Skipped'}`);
      console.log(`[${new Date().toISOString()}] 🔗 Redirect: ${result.redirectUrl}`);
    }

    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ ERROR in slot-deals-runner:`, error);
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
