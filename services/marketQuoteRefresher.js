const { getModuleLogger } = require('../logger/logger');
const { getAllSignals, saveSignals } = require('../database/stocksMultiDB');
const { getLiveQuote, evaluateSignalWithCMP, clearQuoteCache } = require('./marketQuoteService');
const { evaluateAndDispatchBatch } = require('./stockAlertNotificationService');
const { generateBestInsights } = require('./stockInsightsAggregator');

const logger = getModuleLogger('marketQuoteRefresher');

let refreshIntervalTimer = null;
let isRefreshing = false;
let lastRefreshedAt = null;
let refreshCount = 0;
let currentIntervalMs = 30000; // default 30s
let lastError = null;

/**
 * Perform a complete quote refresh across all signals in Multi-DB
 */
async function refreshQuotesNow(forceRefresh = true) {
  if (isRefreshing) {
    logger.info('Quote refresh already in progress, skipping overlapping run.');
    return {
      status: 'already_running',
      lastRefreshedAt,
      refreshCount
    };
  }

  isRefreshing = true;
  const startTime = Date.now();

  try {
    if (forceRefresh) {
      clearQuoteCache();
    }

    const allSignals = await getAllSignals();
    if (!allSignals || allSignals.length === 0) {
      isRefreshing = false;
      return {
        status: 'no_signals',
        updatedCount: 0,
        durationMs: Date.now() - startTime
      };
    }

    // Collect distinct symbols
    const distinctSymbols = Array.from(new Set(
      allSignals.map(s => s.symbol).filter(Boolean)
    ));

    logger.info(`Refreshing live quotes for ${distinctSymbols.length} distinct stocks (${allSignals.length} signals)...`);

    // Fetch quotes in concurrent chunks of 6 to be gentle on Yahoo API
    const quoteMap = new Map();
    const CHUNK_SIZE = 6;
    for (let i = 0; i < distinctSymbols.length; i += CHUNK_SIZE) {
      const chunk = distinctSymbols.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (sym) => {
        try {
          const q = await getLiveQuote(sym, 'NS', forceRefresh);
          if (q) quoteMap.set(sym.toUpperCase(), q);
        } catch (e) {
          logger.debug(`Failed quote fetch for ${sym}:`, { error: e.message });
        }
      }));
    }

    // Re-evaluate signals with updated quotes
    const updatedSignals = [];
    for (const sig of allSignals) {
      const q = quoteMap.get(sig.symbol?.toUpperCase());
      if (q) {
        const evaluated = evaluateSignalWithCMP(sig, q) || sig;
        updatedSignals.push(evaluated);
      } else {
        updatedSignals.push(sig);
      }
    }

    // Persist updated signals with latest CMPs
    await saveSignals(updatedSignals);

    // Check conditions & dispatch grouped alerts if any stock crossed levels
    evaluateAndDispatchBatch(updatedSignals, 'stocks').catch(e => {
      logger.debug('Batch notification check note:', { error: e.message });
    });

    // Refresh best insights in background
    generateBestInsights().catch(e => {
      logger.debug('Insights regeneration note:', { error: e.message });
    });

    lastRefreshedAt = new Date().toISOString();
    refreshCount++;
    lastError = null;

    const durationMs = Date.now() - startTime;
    logger.info(`✅ Successfully refreshed CMP for ${quoteMap.size}/${distinctSymbols.length} stocks in ${durationMs}ms (Run #${refreshCount}).`);

    return {
      status: 'success',
      stocksRefreshed: quoteMap.size,
      totalSignalsUpdated: updatedSignals.length,
      durationMs,
      lastRefreshedAt,
      refreshCount
    };
  } catch (err) {
    lastError = err.message;
    logger.error('Error during quote refresh:', { error: err.message });
    return {
      status: 'error',
      error: err.message,
      lastRefreshedAt,
      refreshCount
    };
  } finally {
    isRefreshing = false;
  }
}

/**
 * Start background automatic CMP refresher timer
 */
function startAutoRefresher(intervalMs = 30000) {
  if (refreshIntervalTimer) {
    clearInterval(refreshIntervalTimer);
  }

  currentIntervalMs = Math.max(5000, Number(intervalMs) || 30000);
  logger.info(`Starting auto CMP refresher (Interval: ${currentIntervalMs / 1000}s)...`);

  // Initial trigger immediately
  refreshQuotesNow(false).catch(e => logger.warn('Initial refresh warning:', { error: e.message }));

  refreshIntervalTimer = setInterval(() => {
    refreshQuotesNow(false).catch(e => logger.warn('Interval refresh warning:', { error: e.message }));
  }, currentIntervalMs);

  return getRefresherStatus();
}

/**
 * Stop background automatic CMP refresher timer
 */
function stopAutoRefresher() {
  if (refreshIntervalTimer) {
    clearInterval(refreshIntervalTimer);
    refreshIntervalTimer = null;
    logger.info('Auto CMP refresher stopped.');
  }
  return getRefresherStatus();
}

/**
 * Get status of refresher
 */
function getRefresherStatus() {
  return {
    isRunning: Boolean(refreshIntervalTimer),
    isRefreshing,
    intervalSeconds: currentIntervalMs / 1000,
    lastRefreshedAt,
    refreshCount,
    lastError
  };
}

module.exports = {
  refreshQuotesNow,
  startAutoRefresher,
  stopAutoRefresher,
  getRefresherStatus
};
