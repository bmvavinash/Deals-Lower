let cron;
try {
  cron = require('node-cron');
} catch {
  // Graceful fallback to setInterval if node-cron is not directly in path
  cron = {
    schedule: (expr, fn) => {
      let ms = 60000;
      const match = expr.match(/^\*\/(\d+)/);
      if (match) ms = parseInt(match[1], 10) * 60000;
      const timer = setInterval(fn, ms);
      return { stop: () => clearInterval(timer) };
    }
  };
}
const { extractActiveWhatsAppChat } = require('./whatsappLiveExtractor');
const { extractGoogleSheetSignals } = require('./googleSheetLiveExtractor');
const { refreshQuotesNow } = require('./marketQuoteRefresher');
const { startTelegramIngestion, getTelegramIngestionStatus } = require('./telegramTradeIngestionService');
const { getAllSignals, getBestInsights } = require('../database/stocksMultiDB');
const { dispatchToTopic, getTelegramConfig } = require('./genericTelegramDispatcher');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stocksMasterScheduler');

let isSchedulerRunning = false;
let cronTasks = [];
let localIntervals = [];

// Runtime health state
const schedulerState = {
  startedAt: null,
  isMasterActive: false,
  environment: 'idle',
  whatsappPoller: {
    enabled: true,
    intervalMinutes: 3,
    lastRunAt: null,
    lastSuccessAt: null,
    totalRuns: 0,
    signalsExtracted: 0,
    lastStatus: 'idle',
    lastError: null
  },
  cmpRefresher: {
    enabled: true,
    intervalMinutes: 2,
    lastRunAt: null,
    isMarketHours: false,
    totalRuns: 0,
    stocksUpdated: 0,
    lastStatus: 'idle'
  },
  sheetsSync: {
    enabled: true,
    intervalMinutes: 15,
    lastRunAt: null,
    totalRuns: 0,
    signalsSynced: 0,
    lastStatus: 'idle'
  },
  telegramIngestion: {
    enabled: true,
    mode: '24/7 continuous listener'
  }
};

/**
 * Check if current time is within Indian Stock Market Trading Hours
 * Mon-Fri 09:15 to 15:30 IST (UTC+5:30)
 */
function isIndianMarketOpen() {
  const now = new Date();
  // Get time in IST
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
  
  const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return false; // Weekend
  }

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const currentTotalMin = hours * 60 + minutes;

  const marketOpenMin = 9 * 60 + 15;  // 09:15 IST
  const marketCloseMin = 15 * 60 + 30; // 15:30 IST

  return currentTotalMin >= marketOpenMin && currentTotalMin <= marketCloseMin;
}

/**
 * 1. WhatsApp Scheduled Ingestion Job (Every 3 minutes)
 */
async function runWhatsAppScheduledJob() {
  const jobState = schedulerState.whatsappPoller;
  if (!jobState.enabled) return;

  jobState.lastRunAt = new Date().toISOString();
  jobState.totalRuns++;
  jobState.lastStatus = 'running';

  logger.info(`[Scheduler] ⏰ Running 3-min WhatsApp Poller on Chrome Port 9223 (Run #${jobState.totalRuns})...`);

  try {
    const result = await extractActiveWhatsAppChat({ port: 9223 });
    if (result.success) {
      jobState.lastSuccessAt = new Date().toISOString();
      jobState.signalsExtracted += (result.signalsFound || 0);
      jobState.lastStatus = `success (${result.signalsFound || 0} signals from "${result.chatTitle}")`;
      jobState.lastError = null;
      logger.info(`[Scheduler] ✅ WhatsApp poller finished: ${result.signalsFound} signals found in "${result.chatTitle}".`);
    } else {
      jobState.lastStatus = result.message || 'no_active_chat';
      jobState.lastError = result.error || result.message;
      logger.debug(`[Scheduler] WhatsApp poller note: ${jobState.lastStatus}`);
    }
  } catch (err) {
    jobState.lastStatus = 'error';
    jobState.lastError = err.message;
    logger.warn(`[Scheduler] WhatsApp poller warning: ${err.message}`);
  }
}

/**
 * 2. Live CMP Quote Refresher Job (Every 2 min in market hours, 15 min outside)
 */
async function runCMPRefresherJob() {
  const jobState = schedulerState.cmpRefresher;
  if (!jobState.enabled) return;

  const marketOpen = isIndianMarketOpen();
  jobState.isMarketHours = marketOpen;
  jobState.lastRunAt = new Date().toISOString();
  jobState.totalRuns++;
  jobState.lastStatus = 'running';

  logger.info(`[Scheduler] ⚡ Running CMP Refresher Job (Market Open: ${marketOpen}, Run #${jobState.totalRuns})...`);

  try {
    const res = await refreshQuotesNow(false);
    jobState.stocksUpdated = res.stocksRefreshed || 0;
    jobState.lastStatus = `success (${jobState.stocksUpdated} stocks refreshed)`;
    logger.info(`[Scheduler] ✅ CMP Refresher complete: ${jobState.stocksUpdated} stocks refreshed.`);
  } catch (err) {
    jobState.lastStatus = 'error';
    logger.warn(`[Scheduler] CMP Refresher warning: ${err.message}`);
  }
}

/**
 * 3. Google Sheets Sync Job (Every 15 minutes)
 */
async function runGoogleSheetsScheduledJob() {
  const jobState = schedulerState.sheetsSync;
  if (!jobState.enabled) return;

  jobState.lastRunAt = new Date().toISOString();
  jobState.totalRuns++;
  jobState.lastStatus = 'running';

  logger.info(`[Scheduler] 📊 Running 15-min Google Sheet Sync on Chrome Port 9223 (Run #${jobState.totalRuns})...`);

  try {
    const result = await extractGoogleSheetSignals({ port: 9223 });
    if (result.success) {
      jobState.signalsSynced += (result.extractedSignals?.length || 0);
      jobState.lastStatus = `success (${result.extractedSignals?.length || 0} signals from ${result.tabsProcessed || 3} tabs)`;
      logger.info(`[Scheduler] ✅ Google Sheets sync complete: ${result.extractedSignals?.length || 0} signals processed.`);
    } else {
      jobState.lastStatus = result.message || 'skipped';
    }
  } catch (err) {
    jobState.lastStatus = 'error';
    logger.warn(`[Scheduler] Google Sheets sync warning: ${err.message}`);
  }
}

/**
 * 4. Morning Market Open Digest (09:15 IST)
 */
async function runMarketOpenDigest() {
  logger.info('[Scheduler] 🔔 Triggering 09:15 AM IST Market Open Digest...');
  try {
    const config = getTelegramConfig();
    if (!config.stocks?.channelId) return;

    const allSignals = await getAllSignals();
    const highConvictionNearBuy = allSignals.filter(s => 
      s.action === 'BUY' && 
      Number(s.rating || 0) >= 4 && 
      (s.status === 'IN_BUY_RANGE' || s.status === 'ACTIVE')
    ).slice(0, 5);

    if (highConvictionNearBuy.length === 0) return;

    let text = `🔔 *Indian Market Open — High Conviction Watchlist (09:15 AM)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Top 4-5★ trades positioned in/near buy entry range:\n\n`;

    highConvictionNearBuy.forEach((s, idx) => {
      text += `${idx + 1}. *${s.symbol}* (${'⭐'.repeat(Math.round(s.rating || 4))})\n` +
        `   • Target/Entry: ₹${s.entryPrice || '-'} | CMP: ₹${s.currentCMP || 'Syncing...'}\n` +
        `   • Horizon: _${s.callType || 'Positional'}_\n\n`;
    });

    text += `_Tracking live CMPs across Yahoo / NSE feeds._`;

    await dispatchToTopic('stocks', 'high_conviction', text);
  } catch (err) {
    logger.warn('Market open digest warning:', { error: err.message });
  }
}

/**
 * 5. Market Close Daily Performance Wrap-up (15:30 IST)
 */
async function runMarketCloseDigest() {
  logger.info('[Scheduler] 📊 Triggering 03:30 PM IST Market Close Wrap-up...');
  try {
    const config = getTelegramConfig();
    if (!config.stocks?.channelId) return;

    const allSignals = await getAllSignals();
    const triggeredExits = allSignals.filter(s => s.status === 'TRIGGERED');
    const inBuyZone = allSignals.filter(s => s.status === 'IN_BUY_RANGE');

    let text = `📊 *Market Close Performance Wrap-up (03:30 PM)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Total Tracked Signals*: ${allSignals.length}\n` +
      `• *Targets Met / Exits Today*: ${triggeredExits.length}\n` +
      `• *Stocks in Buy Zone*: ${inBuyZone.length}\n\n`;

    if (triggeredExits.length > 0) {
      text += `🎯 *Target Exits Hit Today:*\n`;
      triggeredExits.slice(0, 5).forEach((t, i) => {
        text += `  ${i + 1}. *${t.symbol}* hit target ₹${t.target1 || t.entryPrice} (CMP: ₹${t.currentCMP})\n`;
      });
      text += '\n';
    }

    text += `_Automated multi-engine insights aggregator active._`;

    await dispatchToTopic('stocks', 'daily_insights', text);
  } catch (err) {
    logger.warn('Market close digest warning:', { error: err.message });
  }
}

/**
 * Start the Master Stocks Scheduler
 */
function startMasterScheduler(options = {}) {
  if (isSchedulerRunning) {
    logger.info('Stocks Master Scheduler is already running.');
    return { success: true, status: 'already_running', state: getSchedulerState() };
  }

  const isCloud = Boolean(options.isCloud || process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.IS_CLOUD);

  isSchedulerRunning = true;
  schedulerState.isMasterActive = true;
  schedulerState.startedAt = new Date().toISOString();
  schedulerState.environment = isCloud ? 'cloud (Render 24/7)' : 'local (PC Port 9223)';

  logger.info(`🚀 Starting Stocks Master Scheduler in [${schedulerState.environment}] mode:`);
  logger.info('  • Live CMP Refresher: Every 2 minutes (Market hours: Mon-Fri 09:15-15:30 IST)');
  logger.info('  • Telegram Ingestion Poller: 24/7 continuous (Listening for forwarded trades in @dealsequity)');

  // A. Start 24/7 Telegram Ingestion Listener
  startTelegramIngestion();

  // B. CMP Refresher (every 2 minutes during market hours)
  const cmpTask = cron.schedule('*/2 * * * *', () => {
    runCMPRefresherJob().catch(e => logger.warn('CMP job warning:', { error: e.message }));
  });
  cronTasks.push(cmpTask);

  // C. Market Open Digest (09:15 IST Mon-Fri = 03:45 UTC)
  const openTask = cron.schedule('45 3 * * 1-5', () => {
    runMarketOpenDigest().catch(e => logger.warn('Market open warning:', { error: e.message }));
  });
  cronTasks.push(openTask);

  // D. Market Close Digest (15:30 IST Mon-Fri = 10:00 UTC)
  const closeTask = cron.schedule('0 10 * * 1-5', () => {
    runMarketCloseDigest().catch(e => logger.warn('Market close warning:', { error: e.message }));
  });
  cronTasks.push(closeTask);

  // E. Local-Only Browser Scrapers (WhatsApp & Google Sheets via Chrome 9223)
  if (!isCloud) {
    logger.info('  • WhatsApp Ingestion: Every 3 minutes (Port 9223)');
    logger.info('  • Google Sheets Sync: Every 15 minutes (Port 9223)');

    schedulerState.whatsappPoller.enabled = true;
    schedulerState.sheetsSync.enabled = true;

    const waTask = cron.schedule('*/3 * * * *', () => {
      runWhatsAppScheduledJob().catch(e => logger.warn('WA job warning:', { error: e.message }));
    });
    cronTasks.push(waTask);

    const sheetsTask = cron.schedule('*/15 * * * *', () => {
      runGoogleSheetsScheduledJob().catch(e => logger.warn('Sheets job warning:', { error: e.message }));
    });
    cronTasks.push(sheetsTask);

    // Warm-up WhatsApp poller after 5s
    setTimeout(() => {
      runWhatsAppScheduledJob().catch(() => {});
    }, 5000);
  } else {
    logger.info('  • WhatsApp & Sheets: Skipped in Cloud mode (runs on local PC via Port 9223)');
    schedulerState.whatsappPoller.enabled = false;
    schedulerState.whatsappPoller.lastStatus = 'runs_on_local_pc_only';
    schedulerState.sheetsSync.enabled = false;
    schedulerState.sheetsSync.lastStatus = 'runs_on_local_pc_only';
  }

  // Initial warm-up execution for CMP after 5 seconds
  setTimeout(() => {
    runCMPRefresherJob().catch(() => {});
  }, 5000);

  return { success: true, status: 'started', state: getSchedulerState() };
}

/**
 * Stop the Master Stocks Scheduler
 */
function stopMasterScheduler() {
  cronTasks.forEach(task => {
    try { task.stop(); } catch (_) {}
  });
  cronTasks = [];

  localIntervals.forEach(t => clearInterval(t));
  localIntervals = [];

  isSchedulerRunning = false;
  schedulerState.isMasterActive = false;
  schedulerState.whatsappPoller.lastStatus = 'stopped';
  schedulerState.cmpRefresher.lastStatus = 'stopped';
  schedulerState.sheetsSync.lastStatus = 'stopped';

  logger.info('🛑 Stocks Master Scheduler stopped.');
  return { success: true, status: 'stopped', state: getSchedulerState() };
}

/**
 * Get comprehensive scheduler status and metrics
 */
function getSchedulerState() {
  const telegramState = getTelegramIngestionStatus();
  return {
    ...schedulerState,
    isIndianMarketOpen: isIndianMarketOpen(),
    telegramIngestionStatus: telegramState
  };
}

module.exports = {
  startMasterScheduler,
  stopMasterScheduler,
  getSchedulerState,
  runWhatsAppScheduledJob,
  runCMPRefresherJob,
  runGoogleSheetsScheduledJob,
  isIndianMarketOpen
};
