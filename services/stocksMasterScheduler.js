let cron;
try {
  cron = require('node-cron');
} catch {
  // Graceful fallback to setInterval if node-cron is not directly in path
  cron = {
    schedule: (expr, fn) => {
      const match = expr.match(/^\*\/(\d+)/);
      if (!match) return { stop: () => {} };
      const ms = parseInt(match[1], 10) * 60000;
      const timer = setInterval(fn, ms);
      if (timer.unref) timer.unref();
      return { stop: () => clearInterval(timer) };
    }
  };
}
const { refreshQuotesNow } = require('./marketQuoteRefresher');
const { startTelegramIngestion, getTelegramIngestionStatus } = require('./telegramTradeIngestionService');
const { getAllSignals, getBestInsights } = require('../database/stocksMultiDB');
const { dispatchToTopic, getTelegramConfig } = require('./genericTelegramDispatcher');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stocksMasterScheduler');

let isSchedulerRunning = false;
let explicitlyPausedByUser = false;
let cronTasks = [];
let localIntervals = [];
let marketStartWatcherTimer = null;
let lastAutoWakeDateIST = null;

function isCloudEnv() {
  return Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.IS_CLOUD);
}

// Runtime health state
const schedulerState = {
  startedAt: null,
  isMasterActive: false,
  explicitlyPaused: false,
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
 * Get current Date adjusted to IST (UTC+5:30) regardless of host OS timezone
 */
function getISTDate() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffsetMs);
}

/**
 * Format IST calendar date (YYYY-MM-DD) for once-per-day market start triggers
 */
function getISTDateKey(istDate = getISTDate()) {
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if current time is within Indian Stock Market Trading Hours
 * Mon-Fri 09:00 to 15:30 IST (UTC+5:30)
 */
function isIndianMarketOpen() {
  const istDate = getISTDate();

  const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return false; // Weekend
  }

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const currentTotalMin = hours * 60 + minutes;

  const marketOpenMin = 9 * 60;        // 09:00 IST
  const marketCloseMin = 15 * 60 + 30; // 15:30 IST

  return currentTotalMin >= marketOpenMin && currentTotalMin <= marketCloseMin;
}

/**
 * 1. WhatsApp Scheduled Ingestion Job (Every 3 minutes on Local PC)
 */
async function runWhatsAppScheduledJob() {
  const jobState = schedulerState.whatsappPoller;
  if (!jobState.enabled || isCloudEnv()) return;

  jobState.lastRunAt = new Date().toISOString();
  jobState.totalRuns++;
  jobState.lastStatus = 'running';

  logger.info(`[Scheduler] ⏰ Running 3-min WhatsApp Poller on Chrome Port 9223 (Run #${jobState.totalRuns})...`);

  try {
    // Lazy-loaded only on local PC so cloud never imports puppeteer
    const { extractActiveWhatsAppChat } = require('./whatsappLiveExtractor');
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
 * 2. Live CMP Quote Refresher Job (Every 2 min in market hours 09:00-15:30 IST, 30 min outside)
 */
async function runCMPRefresherJob(forceMarketCheck = false) {
  const jobState = schedulerState.cmpRefresher;
  if (!jobState.enabled) return;

  const marketOpen = isIndianMarketOpen();
  jobState.isMarketHours = marketOpen;

  // Gate high-frequency quote polling outside market hours while keeping master scheduler active
  if (!forceMarketCheck && !marketOpen && jobState.totalRuns > 0 && jobState.totalRuns % 15 !== 0) {
    jobState.totalRuns++;
    jobState.lastStatus = 'standby_outside_market_hours';
    logger.debug('[Scheduler] Outside 09:00-15:30 IST market window. Keeping scheduler active in low-frequency standby.');
    return;
  }

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
 * 3. Google Sheets Sync Job (Every 15 minutes on Local PC)
 */
async function runGoogleSheetsScheduledJob() {
  const jobState = schedulerState.sheetsSync;
  if (!jobState.enabled || isCloudEnv()) return;

  jobState.lastRunAt = new Date().toISOString();
  jobState.totalRuns++;
  jobState.lastStatus = 'running';

  logger.info(`[Scheduler] 📊 Running 15-min Google Sheet Sync on Chrome Port 9223 (Run #${jobState.totalRuns})...`);

  try {
    // Lazy-loaded only on local PC so cloud never imports puppeteer
    const { extractGoogleSheetSignals } = require('./googleSheetLiveExtractor');
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
 * Pure snapshot builder without side effects
 */
function buildSchedulerSnapshot() {
  return {
    ...schedulerState,
    explicitlyPaused: explicitlyPausedByUser,
    isIndianMarketOpen: isIndianMarketOpen(),
    telegramIngestionStatus: getTelegramIngestionStatus()
  };
}

/**
 * Trigger morning market open warmup at 09:00 IST Mon-Fri
 */
function triggerMorningMarketStart() {
  const todayKey = getISTDateKey();
  lastAutoWakeDateIST = todayKey;
  logger.info(`[Scheduler] 🔔 09:00 AM IST Market Start triggered (${todayKey}). Ensuring active monitoring...`);

  explicitlyPausedByUser = false;
  schedulerState.explicitlyPaused = false;

  if (!isSchedulerRunning) {
    startMasterScheduler({ force: true });
    return;
  }

  runCMPRefresherJob(true).catch(e => logger.warn('09:00 AM CMP warmup warning:', { error: e.message }));
  if (!isCloudEnv()) {
    runWhatsAppScheduledJob().catch(() => {});
    runGoogleSheetsScheduledJob().catch(() => {});
  }
}

/**
 * Persistent lightweight watcher that guarantees auto-start at 09:00 AM IST Mon-Fri
 * even if the scheduler was manually paused on a previous day.
 */
function ensureMarketStartWatcher() {
  if (marketStartWatcherTimer) return;
  marketStartWatcherTimer = setInterval(() => {
    try {
      const istDate = getISTDate();
      const day = istDate.getDay();
      if (day === 0 || day === 6) return;

      const totalMin = istDate.getHours() * 60 + istDate.getMinutes();
      const todayKey = getISTDateKey(istDate);

      // Between 09:00 and 09:10 IST, guarantee scheduler is awake and warm once per trading day
      if (totalMin >= 9 * 60 && totalMin <= 9 * 60 + 10 && lastAutoWakeDateIST !== todayKey) {
        triggerMorningMarketStart();
      }
    } catch (_) {}
  }, 60 * 1000);
  if (marketStartWatcherTimer.unref) marketStartWatcherTimer.unref();
}

/**
 * Start the Master Stocks Scheduler
 */
function startMasterScheduler(options = {}) {
  explicitlyPausedByUser = false;
  schedulerState.explicitlyPaused = false;
  ensureMarketStartWatcher();

  if (isSchedulerRunning) {
    logger.info('Stocks Master Scheduler is already running.');
    return { success: true, status: 'already_running', state: buildSchedulerSnapshot() };
  }

  const isCloud = Boolean(options.isCloud || isCloudEnv());

  isSchedulerRunning = true;
  schedulerState.isMasterActive = true;
  schedulerState.startedAt = new Date().toISOString();
  schedulerState.environment = isCloud ? 'cloud (Render 24/7)' : 'local (PC Port 9223)';
  lastAutoWakeDateIST = isIndianMarketOpen() ? getISTDateKey() : lastAutoWakeDateIST;

  logger.info(`🚀 Starting Stocks Master Scheduler in [${schedulerState.environment}] mode:`);
  logger.info('  • Live CMP Refresher: Every 2 minutes (Market hours: Mon-Fri 09:00-15:30 IST)');
  logger.info('  • Morning Auto-Wake: Every weekday at 09:00 AM IST');
  logger.info('  • Telegram Ingestion Poller: 24/7 continuous (Listening for forwarded trades in @dealsequity)');

  // A. Start 24/7 Telegram Ingestion Listener
  startTelegramIngestion();

  // B. CMP Refresher (every 2 minutes; high-frequency during 09:00-15:30 IST, 30-min standby off-hours)
  const cmpTask = cron.schedule('*/2 * * * *', () => {
    runCMPRefresherJob().catch(e => logger.warn('CMP job warning:', { error: e.message }));
  });
  cronTasks.push(cmpTask);

  // C. Guaranteed 09:00 AM IST Market Start Wakeup (Mon-Fri Asia/Kolkata)
  const marketStartTask = cron.schedule('0 9 * * 1-5', () => {
    triggerMorningMarketStart();
  }, { timezone: 'Asia/Kolkata' });
  cronTasks.push(marketStartTask);

  // D. Market Open Digest (09:15 IST Mon-Fri Asia/Kolkata)
  const openTask = cron.schedule('15 9 * * 1-5', () => {
    runMarketOpenDigest().catch(e => logger.warn('Market open warning:', { error: e.message }));
  }, { timezone: 'Asia/Kolkata' });
  cronTasks.push(openTask);

  // E. Market Close Digest (15:30 IST Mon-Fri Asia/Kolkata)
  const closeTask = cron.schedule('30 15 * * 1-5', () => {
    runMarketCloseDigest().catch(e => logger.warn('Market close warning:', { error: e.message }));
  }, { timezone: 'Asia/Kolkata' });
  cronTasks.push(closeTask);

  // F. Local-Only Browser Scrapers (WhatsApp & Google Sheets via Chrome 9223)
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
    runCMPRefresherJob(true).catch(() => {});
  }, 5000);

  const state = buildSchedulerSnapshot();
  syncSchedulerStateToFirebase(state);
  return { success: true, status: 'started', state };
}

/**
 * Sync scheduler state to Firebase RTDB so cloud & frontend instances stay coordinated
 */
function syncSchedulerStateToFirebase(state) {
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length > 0) {
      admin.database().ref('stocks/scheduler').set(JSON.parse(JSON.stringify(state))).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Stop/Pause the Master Stocks Scheduler (auto-resumes at 09:00 AM IST next market open)
 */
function stopMasterScheduler() {
  cronTasks.forEach(task => {
    try { task.stop(); } catch (_) {}
  });
  cronTasks = [];

  localIntervals.forEach(t => clearInterval(t));
  localIntervals = [];

  explicitlyPausedByUser = true;
  isSchedulerRunning = false;
  schedulerState.isMasterActive = false;
  schedulerState.explicitlyPaused = true;
  schedulerState.whatsappPoller.lastStatus = 'paused';
  schedulerState.cmpRefresher.lastStatus = 'paused';
  schedulerState.sheetsSync.lastStatus = 'paused';

  ensureMarketStartWatcher();

  logger.info('⏸️ Stocks Master Scheduler paused manually (will auto-resume at 09:00 AM IST market open).');
  const state = buildSchedulerSnapshot();
  syncSchedulerStateToFirebase(state);
  return { success: true, status: 'stopped', state };
}

/**
 * Get comprehensive scheduler status and metrics
 */
function getSchedulerState() {
  // Always auto-start if not running unless explicitly paused by user
  if (!isSchedulerRunning && !explicitlyPausedByUser) {
    try {
      startMasterScheduler();
    } catch (e) {
      logger.warn('Auto-starting master scheduler on state inquiry', { error: e.message });
    }
  }

  const state = buildSchedulerSnapshot();
  syncSchedulerStateToFirebase(state);
  return state;
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
