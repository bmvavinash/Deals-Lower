const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
// Lazy-loaded getGoogleSheetRecommendations to prevent blocking server boot
let _cachedGoogleSheetRecommendations = null;
function getGoogleSheetRecommendations() {
  if (!_cachedGoogleSheetRecommendations) {
    _cachedGoogleSheetRecommendations = require('../../../Stock/Scheduler/getGoogleSheetRecommendations');
  }
  return _cachedGoogleSheetRecommendations(...arguments);
}
const { getAllSignals, updateSignal, getPendingClarifications, resolveClarification, saveSignals } = require('../../../database/stocksMultiDB');
const { getLiveQuote, evaluateSignalWithCMP } = require('../../../services/marketQuoteService');
const { parseStockMessage } = require('../../../services/stockSignalParser');
const { generateBestInsights } = require('../../../services/stockInsightsAggregator');
const { extractActiveWhatsAppChat } = require('../../../services/whatsappLiveExtractor');
const { extractGoogleSheetSignals } = require('../../../services/googleSheetLiveExtractor');
const { 
  checkAndTriggerSignalNotification, 
  evaluateAllSignalAlerts, 
  getTriggeredNotifications 
} = require('../../../services/stockAlertNotificationService');
const { 
  refreshQuotesNow, 
  startAutoRefresher, 
  stopAutoRefresher, 
  getRefresherStatus 
} = require('../../../services/marketQuoteRefresher');
const { 
  getTelegramConfig, 
  saveTelegramConfig, 
  sendRawTelegramMessage, 
  resolveDestination,
  dispatchGroupedTradeAlerts
} = require('../../../services/genericTelegramDispatcher');

const logger = getModuleLogger('stocks-api');

// ─────────────────────────────────────────────────────────────
// EQUITY HUB ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/stocks/equity/signals
 * Get all parsed trade signals enriched with real-time CMP
 */
router.get('/equity/signals', async (req, res, next) => {
  try {
    const { action, status, source } = req.query;
    const rawSignals = await getAllSignals({ action, status, source });

    // Refresh live CMP for top 30 active signals
    const enriched = await Promise.all(
      rawSignals.slice(0, 30).map(async (sig) => {
        try {
          const quote = await getLiveQuote(sig.symbol);
          const evaluated = evaluateSignalWithCMP(sig, quote) || sig;

          // Pure read-only endpoint: alerts are evaluated exclusively by scheduled CMP refresher
          return evaluated;
        } catch (e) {
          return sig;
        }
      })
    );

    // Combine with remaining signals without blocking
    const combined = [...enriched, ...rawSignals.slice(30)];

    res.json({
      success: true,
      count: combined.length,
      data: combined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching equity signals', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/stocks/equity/insights
 * Get top high-conviction "Best Insights" across recommendation engines
 */
router.get('/equity/insights', async (req, res, next) => {
  try {
    const insights = await generateBestInsights();
    res.json({
      success: true,
      count: insights.length,
      data: insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error generating equity insights', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/stocks/equity/extract-whatsapp
 * Trigger live extraction from WhatsApp Web active chat on Chrome port 9223 (or custom)
 */
router.post('/equity/extract-whatsapp', async (req, res, next) => {
  try {
    const port = req.body.port ? parseInt(req.body.port, 10) : 9223;
    const result = await extractActiveWhatsAppChat({ port });
    res.json(result);
  } catch (error) {
    logger.error('Error in WhatsApp live extraction endpoint', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/stocks/equity/extract-sheets
 * Trigger live extraction from Google Sheet open on Chrome port 9223 (or custom)
 */
router.post('/equity/extract-sheets', async (req, res, next) => {
  try {
    const port = req.body.port ? parseInt(req.body.port, 10) : 9223;
    const result = await extractGoogleSheetSignals({ port });
    res.json(result);
  } catch (error) {
    logger.error('Error in Google Sheet live extraction endpoint', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/stocks/equity/parse-text
 * Test-parse raw text and optionally store to database
 */
router.post('/equity/parse-text', async (req, res, next) => {
  try {
    const { text, source, saveToDB } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text field is required' });
    }

    const parseResult = parseStockMessage(text, {
      source: source || 'Manual Input',
      timestamp: new Date().toISOString()
    });

    if (parseResult.isTradeSignal && parseResult.signals.length > 0) {
      // Enrich with CMP
      const enriched = await Promise.all(
        parseResult.signals.map(async (sig) => {
          const quote = await getLiveQuote(sig.symbol);
          return evaluateSignalWithCMP(sig, quote) || sig;
        })
      );

      if (saveToDB) {
        await saveSignals(enriched);
      }

      return res.json({
        success: true,
        isTradeSignal: true,
        signals: enriched,
        rawText: text
      });
    }

    res.json({
      success: true,
      isTradeSignal: false,
      reason: parseResult.reason || 'No stock signal patterns recognized',
      signals: [],
      rawText: text
    });
  } catch (error) {
    logger.error('Error parsing text endpoint', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/stocks/equity/clarifications
 * Get pending doubts/unclear stock names
 */
router.get('/equity/clarifications', async (req, res, next) => {
  try {
    const doubts = await getPendingClarifications();
    res.json({
      success: true,
      count: doubts.length,
      data: doubts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/stocks/equity/resolve-clarification
 * Resolve a doubt question by mapping to correct NSE symbol
 */
router.post('/equity/resolve-clarification', async (req, res, next) => {
  try {
    const { signalId, symbol, notes } = req.body;
    if (!signalId || !symbol) {
      return res.status(400).json({ success: false, message: 'signalId and symbol are required' });
    }

    const updated = await resolveClarification(signalId, symbol, notes || 'Resolved via web dashboard');
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stocks/equity/quote/:symbol
 * Get live market quote from Yahoo Finance
 */
router.get('/equity/quote/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const quote = await getLiveQuote(symbol);
    if (!quote) {
      return res.status(404).json({ success: false, message: `Could not fetch quote for ${symbol}` });
    }
    res.json({ success: true, data: quote });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stocks/equity/notifications
 * Get real-time triggered alerts (where CMP crossed exit level or buy range)
 */
router.get('/equity/notifications', async (req, res, next) => {
  try {
    const notifications = await getTriggeredNotifications(50);
    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching equity notifications', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/stocks/equity/trigger-check
 * Force real-time CMP evaluation across all stored signals and dispatch alerts
 */
router.post('/equity/trigger-check', async (req, res, next) => {
  try {
    const rawSignals = await getAllSignals();
    // Refresh live CMP for all active signals
    const enriched = await Promise.all(
      rawSignals.map(async (sig) => {
        try {
          const quote = await getLiveQuote(sig.symbol);
          return evaluateSignalWithCMP(sig, quote) || sig;
        } catch (e) {
          return sig;
        }
      })
    );

    const triggered = await evaluateAllSignalAlerts(enriched);
    const allNotifications = await getTriggeredNotifications(50);

    res.json({
      success: true,
      triggeredNowCount: triggered.length,
      triggeredNow: triggered,
      notifications: allNotifications,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering equity check', { error: error.message });
    next(error);
  }
});

/**
 * PUT /api/stocks/equity/signals/:id/status
 * Manually update status of a signal (e.g. CLOSED, ACTIVE, TGT1_HIT)
 */
router.put('/equity/signals/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const updated = await updateSignal(id, { status, manualNote: note });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// LEGACY / PORTAL ENDPOINTS (Preserved for compatibility)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/stocks/zerodha
 * Get Zerodha holdings data
 */
router.get('/zerodha', async (req, res, next) => {
  try {
    const admin = require('firebase-admin');
    try {
      const db = admin.database();
      const snapshot = await db.ref('stocks/zerodha').once('value');
      const data = snapshot.val();
      
      if (data) {
        return res.json({
          success: true,
          data: Array.isArray(data) ? data : Object.values(data),
          source: 'firebase',
          timestamp: new Date().toISOString()
        });
      }
    } catch (firebaseError) {
      logger.warn('Could not fetch from Firebase', { error: firebaseError.message });
    }

    res.json({
      success: false,
      message: 'Zerodha data requires active driver session or stored Firebase data.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stocks/recommendations
 * Get stock recommendations from Google Sheets / Firebase
 */
router.get('/recommendations', async (req, res, next) => {
  try {
    const admin = require('firebase-admin');
    try {
      const db = admin.database();
      const snapshot = await db.ref('stocks/recommendations').once('value');
      const data = snapshot.val();
      
      if (data) {
        return res.json({
          success: true,
          data: Array.isArray(data) ? data : Object.values(data),
          source: 'firebase',
          timestamp: new Date().toISOString()
        });
      }
    } catch (firebaseError) {
      logger.warn('Could not fetch recommendations from Firebase', { error: firebaseError.message });
    }

    try {
      const recommendations = await getGoogleSheetRecommendations();
      return res.json({
        success: true,
        data: recommendations,
        source: 'google-sheets',
        timestamp: new Date().toISOString()
      });
    } catch (gsError) {
      logger.warn('Google Sheets not available, falling back to empty list', { error: gsError.message });
      return res.json({ success: true, data: [], source: 'fallback' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stocks
 * Overview summary of all stocks data
 */
router.get('/', async (req, res, next) => {
  try {
    const signals = await getAllSignals();
    const insights = await generateBestInsights();
    res.json({
      success: true,
      data: {
        totalSignals: signals.length,
        totalInsights: insights.length,
        recentSignals: signals.slice(0, 5),
        topInsights: insights.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// CMP REFRESHER & TELEGRAM TOPICS ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/stocks/equity/refresh-quotes
 * Force instant quote refresh for all stocks in Multi-DB
 */
router.post('/equity/refresh-quotes', async (req, res, next) => {
  try {
    const force = req.body?.force !== false;
    const result = await refreshQuotesNow(force);
    res.json({
      success: result.status === 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error in refresh-quotes endpoint', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/stocks/equity/refresher-status
 * Get status of background quote refresher
 */
router.get('/equity/refresher-status', (req, res) => {
  try {
    const status = getRefresherStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stocks/equity/refresher-start
 * Start background automatic quote refresher
 */
router.post('/equity/refresher-start', (req, res) => {
  try {
    const intervalSec = Number(req.body?.intervalSeconds) || 30;
    const status = startAutoRefresher(intervalSec * 1000);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stocks/equity/refresher-stop
 * Stop background automatic quote refresher
 */
router.post('/equity/refresher-stop', (req, res) => {
  try {
    const status = stopAutoRefresher();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stocks/equity/telegram-config
 * Get current Telegram topics configuration
 */
router.get('/equity/telegram-config', (req, res) => {
  try {
    const config = getTelegramConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stocks/equity/telegram-config
 * Update Telegram topics / channel configuration
 */
router.post('/equity/telegram-config', (req, res) => {
  try {
    const { domain = 'stocks', channelId, topics, batching, alertThresholds } = req.body;
    const config = getTelegramConfig();

    if (!config[domain]) {
      config[domain] = {};
    }

    if (channelId !== undefined) {
      // Ensure never set to @dealshubglobal for stocks
      if (domain === 'stocks' && channelId === '@dealshubglobal') {
        return res.status(400).json({
          success: false,
          message: 'Cannot set stocks channel to @dealshubglobal. Please provide your dedicated stocks group/channel ID.'
        });
      }
      config[domain].channelId = channelId.trim();
    }

    if (topics && typeof topics === 'object') {
      config[domain].topics = {
        ...config[domain].topics,
        ...topics
      };
    }

    if (batching && typeof batching === 'object') {
      config[domain].batching = {
        ...config[domain].batching,
        ...batching
      };
    }

    if (alertThresholds && typeof alertThresholds === 'object') {
      config[domain].alertThresholds = {
        ...config[domain].alertThresholds,
        ...alertThresholds
      };
    }

    const saved = saveTelegramConfig(config);
    if (!saved) {
      return res.status(500).json({ success: false, message: 'Failed to write configuration file.' });
    }

    res.json({ success: true, data: config[domain] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stocks/equity/telegram-test
 * Send a test message or sample trade digest to specified topic
 */
router.post('/equity/telegram-test', async (req, res) => {
  try {
    const { domain = 'stocks', topic = 'high_conviction', customText } = req.body;
    const dest = resolveDestination(domain, topic);

    if (!dest.isConfigured) {
      return res.status(400).json({
        success: false,
        message: `Telegram target for "${domain}" is not configured yet. Please enter your Group/Channel ID first.`
      });
    }

    const sampleText = customText || (
      `🧪 *TEST MESSAGE - EQUITY HUB TOPIC TEST*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Target Topic: *${topic}*\n` +
      `• Thread ID: \`${dest.threadId || 'Default'}\`\n` +
      `• Routing System: Generic Multi-Domain Dispatcher\n` +
      `• Status: Connection & Topic Routing Successful! ✅\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🕒 _${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}_`
    );

    const sendRes = await sendRawTelegramMessage(dest.targetChatId, sampleText, dest.threadId);
    res.json(sendRes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// STOCKS MASTER SCHEDULER & TELEGRAM INGESTION ENDPOINTS
// ─────────────────────────────────────────────────────────────
const {
  startMasterScheduler,
  stopMasterScheduler,
  getSchedulerState,
  runWhatsAppScheduledJob,
  runCMPRefresherJob,
  runGoogleSheetsScheduledJob
} = require('../../../services/stocksMasterScheduler');

/**
 * GET /api/stocks/scheduler/status
 */
router.get('/scheduler/status', (req, res) => {
  res.json({
    success: true,
    data: getSchedulerState()
  });
});

/**
 * POST /api/stocks/scheduler/start
 */
router.post('/scheduler/start', (req, res) => {
  const result = startMasterScheduler();
  res.json(result);
});

/**
 * POST /api/stocks/scheduler/stop
 */
router.post('/scheduler/stop', (req, res) => {
  const result = stopMasterScheduler();
  res.json(result);
});

/**
 * POST /api/stocks/scheduler/trigger-whatsapp
 */
router.post('/scheduler/trigger-whatsapp', async (req, res) => {
  try {
    await runWhatsAppScheduledJob();
    res.json({ success: true, state: getSchedulerState() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stocks/scheduler/trigger-cmp
 */
router.post('/scheduler/trigger-cmp', async (req, res) => {
  try {
    await runCMPRefresherJob();
    res.json({ success: true, state: getSchedulerState() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stocks/scheduler/trigger-sheets
 */
router.post('/scheduler/trigger-sheets', async (req, res) => {
  try {
    await runGoogleSheetsScheduledJob();
    res.json({ success: true, state: getSchedulerState() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
