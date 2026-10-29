/**
 * Standalone runner for the Stocks Master Scheduler
 * Runs locally on your PC:
 *  - 3-min WhatsApp poller on Chrome Port 9223
 *  - 2-min CMP live quote refresher & alert evaluator
 *  - 15-min Google Sheets sync on Chrome Port 9223
 *  - 24/7 Telegram Ingestion listener for reposted/forwarded trade calls
 */

const { startMasterScheduler, getSchedulerState } = require('../services/stocksMasterScheduler');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('runStocksScheduler');

console.log('===============================================================');
console.log('   🚀 STOCKS MASTER SCHEDULER & TELEGRAM INGESTION DAEMON      ');
console.log('===============================================================');
console.log('• WhatsApp Scheduler: Every 3 minutes (Chrome Port 9223)');
console.log('• Google Sheets Sync: Every 15 minutes (Chrome Port 9223)');
console.log('• Live CMP Refresher: Every 2 minutes (Market hours)');
console.log('• Telegram Ingestion: Active 24/7 (Forward trades anytime)');
console.log('===============================================================\n');

const res = startMasterScheduler();
console.log('Master Scheduler Started:', res.status);

// Log heartbeat every 60 seconds
setInterval(() => {
  const state = getSchedulerState();
  console.log(`\n[${new Date().toLocaleTimeString('en-IN')}] 💓 Scheduler Heartbeat:`);
  console.log(`  - WA Poller: ${state.whatsappPoller.lastStatus} (Runs: ${state.whatsappPoller.totalRuns}, Signals: ${state.whatsappPoller.signalsExtracted})`);
  console.log(`  - CMP Refresher: ${state.cmpRefresher.lastStatus} (Market Open: ${state.isIndianMarketOpen})`);
  console.log(`  - Sheets Sync: ${state.sheetsSync.lastStatus}`);
  console.log(`  - TG Ingestion: Polling active (Messages: ${state.telegramIngestionStatus?.stats?.messagesReceived || 0}, Signals: ${state.telegramIngestionStatus?.stats?.signalsIngested || 0})`);
}, 60000);

process.on('SIGINT', () => {
  console.log('\nShutting down Stocks Scheduler...');
  process.exit(0);
});
