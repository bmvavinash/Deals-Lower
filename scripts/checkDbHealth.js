#!/usr/bin/env node
// scripts/checkDbHealth.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { databaseHealthService } = require('../services/databaseHealthService');

async function main() {
  const shouldNotify = process.argv.includes('--notify') || process.argv.includes('-n');
  console.log('====================================================');
  console.log('🏥 DEALS OPTIMISED - DATABASE & SYSTEM HEALTH AUDIT 🏥');
  console.log('====================================================\n');

  if (shouldNotify) {
    console.log('📡 Generating audit and sending Telegram notification to @notifyavi...\n');
    const { health, sendResult } = await databaseHealthService.sendTelegramHealthReport('@notifyavi');
    console.log(JSON.stringify(health, null, 2));
    console.log('\n📬 Telegram Alert Dispatch Result:', JSON.stringify(sendResult, null, 2));
  } else {
    const health = await databaseHealthService.getDatabaseHealth();
    console.log(JSON.stringify(health, null, 2));
    console.log('\n💡 Tip: Run with --notify to dispatch this report to Telegram (@notifyavi).');
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('Database health check failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
