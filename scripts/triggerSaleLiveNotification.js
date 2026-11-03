#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { triggerSaleLiveNotifications } = require('../services/saleLiveNotificationService');

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  
  const titleArg = args.find(a => a.startsWith('--title='));
  const badgeArg = args.find(a => a.startsWith('--badge='));
  
  let targetCard = null;
  
  if (titleArg) {
    targetCard = {
      id: 'manual_' + Date.now(),
      title: titleArg.replace('--title=', '').trim(),
      badge: badgeArg ? badgeArg.replace('--badge=', '').trim() : 'Live Now',
      platform: 'Amazon'
    };
  } else {
    // Read from database/amazon_promo_cards.json
    const jsonPath = path.join(__dirname, '../database/amazon_promo_cards.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const cards = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        targetCard = cards.find(c => c.isActive !== false && (
          c.title?.toLowerCase().includes('live') ||
          c.badge?.toLowerCase().includes('live') ||
          c.category?.toLowerCase().includes('festive') ||
          c.dealType === 'live_sale' ||
          c.isLiveSale === true
        )) || cards[0];
      } catch (e) {
        console.warn('Could not read existing promo cards:', e.message);
      }
    }
  }

  if (!targetCard) {
    targetCard = {
      id: 'amazon_promo_live',
      title: 'Amazon Great Indian Festival Live Deals',
      badge: 'Limited-Time Exclusive Drops',
      platform: 'Amazon'
    };
  }

  console.log(`🚀 Triggering sale live alert for: "${targetCard.title}" (force: ${force})...`);
  const result = await triggerSaleLiveNotifications(targetCard, { force });
  console.log('\n📊 Alert Execution Summary:');
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Failed to trigger sale live alert:', err);
  process.exit(1);
});
