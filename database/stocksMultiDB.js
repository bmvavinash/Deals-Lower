const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('stocksMultiDB');

// Local fallback file path
const LOCAL_DB_PATH = path.join(__dirname, 'backups', 'stocks_local_db.json');

// In-memory data store with disk persistence
let memoryDB = {
  signals: {},
  rawMessages: {},
  clarifications: {},
  insights: [],
  notifications: [],
  sheetSnapshots: {},
  meta: {
    lastUpdated: new Date().toISOString(),
    primaryDB: 'firebase'
  }
};

// Ensure backup directory exists and load local backup
try {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(LOCAL_DB_PATH)) {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    memoryDB = { ...memoryDB, ...JSON.parse(raw) };
  }
} catch (e) {
  logger.warn('Could not initialize local stocks DB backup file', { error: e.message });
}

function persistLocalDB() {
  try {
    memoryDB.meta.lastUpdated = new Date().toISOString();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf8');
  } catch (e) {
    logger.error('Failed to persist local stocks DB', { error: e.message });
  }
}

// Get Firebase admin database reference if initialized
function getFirebaseDB() {
  try {
    const admin = require('firebase-admin');
    if (admin.apps && admin.apps.length > 0) {
      return admin.database();
    }
  } catch (e) {
    // Firebase not initialized yet
  }
  return null;
}

/**
 * Run a promise against an enforced timeout to prevent network hangs on Render/cloud
 */
function safeFirebaseRead(promise, timeoutMs = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Firebase read timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Source of Truth Priority Rank:
 * 1: WhatsApp (Realtime Advisor Calls - 1st Priority / Source of Truth)
 * 2: Google Sheets (Watchlist & Stock list - 2nd Priority / Curated Baseline)
 * 3: Telegram (Channel Ingestion - Supplementary)
 * 4: Other / General
 */
function getSourcePriority(source = '') {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) return 1;
  if (s.includes('google sheet') || s.includes('sheet') || s.includes('gs:')) return 2;
  if (s.includes('telegram')) return 3;
  return 4;
}

/**
 * Sort raw messages descending by real message timestamp (newest first),
 * falling back to domIndex & storedAt when timestamps tie.
 */
function sortRawMessagesDesc(list) {
  return (list || []).sort((a, b) => {
    const tA = new Date(a.timestamp || a.storedAt || 0).getTime() || 0;
    const tB = new Date(b.timestamp || b.storedAt || 0).getTime() || 0;
    if (tB !== tA) return tB - tA;
    const dA = Number(a.domIndex || 0);
    const dB = Number(b.domIndex || 0);
    if (dB !== dA) return dB - dA;
    const sA = new Date(a.storedAt || 0).getTime() || 0;
    const sB = new Date(b.storedAt || 0).getTime() || 0;
    return sB - sA;
  });
}

/**
 * Save raw inbound message for permanent audit trail (deduplicated to avoid redundant writes)
 */
async function saveRawMessage(msgData) {
  const id = msgData.id || `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const existing = memoryDB.rawMessages ? memoryDB.rawMessages[id] : null;
  const nextTimestamp = msgData.timestamp || existing?.timestamp || new Date().toISOString();

  // Skip redundant disk/Firebase writes when deterministic message payload hasn't changed
  if (
    existing &&
    existing.text === msgData.text &&
    existing.header === msgData.header &&
    existing.timestamp === nextTimestamp &&
    JSON.stringify(existing.matchedSymbols || []) === JSON.stringify(msgData.matchedSymbols || [])
  ) {
    return existing;
  }

  const record = {
    ...(existing || {}),
    ...msgData,
    id,
    timestamp: nextTimestamp,
    storedAt: existing?.storedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!memoryDB.rawMessages) memoryDB.rawMessages = {};
  memoryDB.rawMessages[id] = record;

  // Prune memory cache to latest 200 raw messages
  const allRaw = Object.values(memoryDB.rawMessages);
  if (allRaw.length > 200) {
    const kept = sortRawMessagesDesc(allRaw).slice(0, 200);
    memoryDB.rawMessages = {};
    for (const item of kept) {
      memoryDB.rawMessages[item.id] = item;
    }
  }
  persistLocalDB();

  // Sync to Firebase
  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref(`stocks/raw_messages/${id}`).set(record);
    } catch (fbErr) {
      logger.warn('Firebase raw_messages write failed, saved to local fallback', { error: fbErr.message });
    }
  }

  return record;
}

/**
 * Fetch raw inbound messages sorted strictly descending by timestamp (latest first).
 * Filters out legacy random MSG_* duplicates when deterministic WA_MSG_* records exist.
 */
async function getRawMessages(limit = 60, sourceFilter = null) {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(
        fb.ref('stocks/raw_messages').orderByChild('timestamp').limitToLast(Math.max(limit * 2, 160)).once('value'),
        2500
      );
      const val = snap ? snap.val() : null;
      if (val && typeof val === 'object') {
        memoryDB.rawMessages = { ...(memoryDB.rawMessages || {}), ...val };
      }
    } catch (e) {
      logger.warn('Could not read raw_messages from Firebase, returning memory cache', { error: e.message });
    }
  }

  let list = Object.values(memoryDB.rawMessages || {});
  const hasDeterministicWA = list.some(m => String(m.id || '').startsWith('WA_MSG_'));
  if (hasDeterministicWA) {
    list = list.filter(m => !String(m.id || '').startsWith('MSG_'));
  }

  if (sourceFilter) {
    const q = sourceFilter.toLowerCase();
    list = list.filter(m =>
      (m.source && m.source.toLowerCase().includes(q)) ||
      (m.sourceType && m.sourceType.toLowerCase().includes(q))
    );
  }
  return sortRawMessagesDesc(list).slice(0, limit);
}

/**
 * Save captured Google Sheet tab screenshots & metadata
 */
async function saveSheetSnapshots(snapshotsMap = {}) {
  if (!memoryDB.sheetSnapshots) memoryDB.sheetSnapshots = {};
  const updatedAt = new Date().toISOString();
  const payload = {
    ...memoryDB.sheetSnapshots,
    ...snapshotsMap,
    updatedAt
  };
  memoryDB.sheetSnapshots = payload;
  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref('stocks/sheet_snapshots').set(payload);
    } catch (fbErr) {
      logger.warn('Firebase sheet_snapshots write failed, saved to local fallback', { error: fbErr.message });
    }
  }
  return payload;
}

/**
 * Retrieve captured Google Sheet screenshots & metadata
 */
async function getSheetSnapshots() {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(fb.ref('stocks/sheet_snapshots').once('value'), 2500);
      const val = snap ? snap.val() : null;
      if (val && typeof val === 'object') {
        memoryDB.sheetSnapshots = { ...(memoryDB.sheetSnapshots || {}), ...val };
      }
    } catch (e) {
      logger.warn('Could not read sheet_snapshots from Firebase, returning memory cache', { error: e.message });
    }
  }
  return memoryDB.sheetSnapshots || {};
}

/**
 * Compute the WhatsApp trade lifecycle state for each symbol:
 * - hasExit: boolean (true if latest WhatsApp message is SELL, EXIT, COMPLETE_EXIT, PARTIAL_EXIT)
 * - isExpired: boolean (true if latest WhatsApp message is an exit AND no newer reinitiate/buy message has arrived)
 * - isReinitiated: boolean (true if a newer WhatsApp BUY / REINITIATE message came after the exit)
 * - latestExit: { action, price, timestamp, rawText }
 * - latestReinitiate: { action, price, timestamp, rawText }
 */
function getWhatsAppStockStates(signals) {
  const allSignals = signals || Object.values(memoryDB.signals || {});
  const waSignals = allSignals.filter(s => 
    s.source && s.source.toLowerCase().includes('whatsapp') && s.symbol
  );

  const bySymbol = new Map();
  waSignals.forEach(s => {
    const sym = s.symbol.toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym).push(s);
  });

  const states = new Map();

  for (const [sym, symSignals] of bySymbol.entries()) {
    // Sort chronologically ascending
    symSignals.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    let latestExit = null;
    let latestReinitiate = null;
    let latestBuy = null;

    for (const s of symSignals) {
      const act = (s.action || '').toUpperCase();
      const isExit = act.includes('SELL') || act.includes('EXIT') || s.isExitCall;
      const isReinit = act.includes('REINITIATE') || s.isReinitiateCall || /reinitiate|re-initiate|re-enter|fresh\s+buy/i.test(s.rawText || '');
      const isBuy = act === 'BUY' || isReinit;

      if (isExit) {
        latestExit = {
          action: s.action,
          price: s.entryPrice || s.target1 || null,
          timestamp: s.timestamp,
          rawText: s.rawText,
          id: s.id
        };
      } else if (isBuy) {
        latestBuy = {
          action: isReinit ? 'REINITIATE' : 'BUY',
          price: s.entryPrice || s.entryMax || null,
          timestamp: s.timestamp,
          rawText: s.rawText,
          id: s.id
        };
        if (latestExit && new Date(s.timestamp) > new Date(latestExit.timestamp)) {
          latestReinitiate = latestBuy;
        }
      }
    }

    if (latestExit) {
      const hasReinitAfterExit = latestBuy && new Date(latestBuy.timestamp) > new Date(latestExit.timestamp);
      states.set(sym, {
        symbol: sym,
        hasExit: true,
        isExpired: !hasReinitAfterExit, // Buy expired unless reinitiated in WhatsApp
        isReinitiated: Boolean(hasReinitAfterExit),
        latestExit,
        latestReinitiate: hasReinitAfterExit ? latestBuy : null,
        activeAction: hasReinitAfterExit ? latestBuy.action : latestExit.action,
        activePrice: hasReinitAfterExit ? latestBuy.price : latestExit.price
      });
    } else if (latestBuy) {
      states.set(sym, {
        symbol: sym,
        hasExit: false,
        isExpired: false,
        isReinitiated: false,
        latestExit: null,
        latestReinitiate: null,
        activeAction: 'BUY',
        activePrice: latestBuy.price
      });
    }
  }

  return states;
}

/**
 * Deterministic Signal ID generator: guarantees exactly 1 record per stock per source.
 * - WhatsApp: WA_SOIC_${symbol}
 * - Google Sheet Watchlist: GS_WATCHLIST_${symbol}
 * - Google Sheet Stock list: GS_STOCKLIST_${symbol}
 * - Telegram: TG_${symbol}
 */
function getDeterministicSignalId(sig) {
  const sym = (sig.symbol || '').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
  const src = (sig.source || '').toLowerCase();
  if (src.includes('whatsapp')) return `WA_SOIC_${sym}`;
  if (src.includes('watchlist')) return `GS_WATCHLIST_${sym}`;
  if (src.includes('stock list')) return `GS_STOCKLIST_${sym}`;
  if (src.includes('telegram')) return `TG_${sym}`;
  return `STOCK_${sym}`;
}

/**
 * Save array of parsed signals (UPSERT - updates existing rather than recreating)
 */
async function saveSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return [];
  const saved = [];

  const fb = getFirebaseDB();
  const waStockStates = getWhatsAppStockStates();

  for (const sig of signals) {
    if (!sig.symbol) continue;
    const sym = (sig.symbol || '').toUpperCase().trim();
    if (isBogusTicker(sym)) continue;
    if ((sig.source || '').includes('Deals Global') || /loot|flipkart|amazon|combo\s+pack|\bmrp\s*:/i.test(sig.rawText || '')) continue;

    const id = getDeterministicSignalId(sig);
    const priority = sig.sourcePriority || getSourcePriority(sig.source);
    const isSourceOfTruth = priority === 1;

    // Check if incoming signal itself is from WhatsApp
    const isIncomingWA = isSourceOfTruth || (sig.source && sig.source.toLowerCase().includes('whatsapp'));
    const isIncomingExit = ['SELL', 'EXIT', 'COMPLETE_EXIT', 'PARTIAL_EXIT'].includes((sig.action || '').toUpperCase()) || sig.isExitCall;

    // If incoming message from WhatsApp is an EXIT, immediately expire ALL existing BUY signals for this symbol
    if (isIncomingWA && isIncomingExit) {
      Object.values(memoryDB.signals || {}).forEach(existing => {
        if (existing.symbol?.toUpperCase() === sym && (existing.action === 'BUY' || existing.action === 'ACCUMULATE')) {
          existing.isExpired = true;
          existing.status = 'EXPIRED';
          existing.statusReason = `Buy expired: WhatsApp exit call issued (${sig.action} @ ₹${sig.entryPrice || sig.target1 || 'market'}) unless reinitiated in WhatsApp`;
          if (fb) {
            fb.ref(`stocks/signals/${existing.id}/status`).set('EXPIRED').catch(() => {});
            fb.ref(`stocks/signals/${existing.id}/statusReason`).set(existing.statusReason).catch(() => {});
            fb.ref(`stocks/signals/${existing.id}/isExpired`).set(true).catch(() => {});
          }
        }
      });
    }

    let finalEntryPrice = sig.entryPrice;
    let finalEntryMax = sig.entryMax;
    let finalAction = sig.action || 'BUY';
    let finalTarget1 = sig.target1;
    let finalStopLoss = sig.stopLoss;

    // Aarti Pharmalabs user rule: strictly ₹770 recommended buy ceiling
    if (sym === 'AARTIPHARM') {
      finalEntryPrice = 770;
      finalEntryMax = 770;
    }

    // Determine WhatsApp Expiry state
    const currentWAState = waStockStates.get(sym);
    let isExpired = Boolean(sig.isExpired);
    let isReinitiated = Boolean(sig.isReinitiated);
    let status = sig.status;
    let statusReason = sig.statusReason;

    if (currentWAState) {
      if (currentWAState.isExpired && (finalAction === 'BUY' || finalAction === 'ACCUMULATE') && !isIncomingWA) {
        isExpired = true;
        status = 'EXPIRED';
        statusReason = `Buy expired: WhatsApp exit call issued (${currentWAState.latestExit.action} @ ₹${currentWAState.latestExit.price || 'market'}) unless reinitiated in WhatsApp`;
      } else if (currentWAState.isReinitiated) {
        isExpired = false;
        isReinitiated = true;
      }
    }

    // UPSERT: If record already exists under this deterministic ID, update it rather than recreating it
    const existing = memoryDB.signals[id];
    const newStatus = status || (existing ? existing.status : 'ACTIVE');
    const prevStatus = existing ? existing.status : null;
    const isStateChanged = Boolean(existing && prevStatus && newStatus && prevStatus !== newStatus);

    const record = {
      ...(existing || {}),
      ...sig,
      id,
      symbol: sym,
      sourcePriority: priority,
      isSourceOfTruth,
      sourceLabel: isSourceOfTruth ? 'WhatsApp (Source of Truth)' : (priority === 2 ? 'Google Sheet (Secondary)' : 'Telegram'),
      entryPrice: finalEntryPrice !== undefined && finalEntryPrice !== null ? finalEntryPrice : (existing ? existing.entryPrice : null),
      entryMax: finalEntryMax !== undefined && finalEntryMax !== null ? finalEntryMax : (existing ? existing.entryMax : null),
      action: finalAction || (existing ? existing.action : 'BUY'),
      target1: finalTarget1 !== undefined && finalTarget1 !== null ? finalTarget1 : (existing ? existing.target1 : null),
      stopLoss: finalStopLoss !== undefined && finalStopLoss !== null ? finalStopLoss : (existing ? existing.stopLoss : null),
      rating: sig.rating !== null && sig.rating !== undefined ? sig.rating : (existing ? existing.rating : null),
      status: newStatus,
      statusReason: statusReason || (existing ? existing.statusReason : null),
      previousStatus: isStateChanged ? prevStatus : (existing ? existing.previousStatus : null),
      lastStatusChangedAt: isStateChanged ? new Date().toISOString() : (existing ? existing.lastStatusChangedAt : null),
      statusChanged: isStateChanged,
      lastNotifiedStatus: sig.lastNotifiedStatus || (existing ? existing.lastNotifiedStatus : null),
      lastNotifiedAt: sig.lastNotifiedAt || (existing ? existing.lastNotifiedAt : null),
      lastNotifiedMsgHash: sig.lastNotifiedMsgHash || (existing ? existing.lastNotifiedMsgHash : null),
      isExpired,
      isReinitiated,
      currentCMP: sig.currentCMP || (existing ? existing.currentCMP : null),
      dayChangePercent: sig.dayChangePercent !== undefined && sig.dayChangePercent !== null ? sig.dayChangePercent : (existing ? existing.dayChangePercent : null),
      pnlPercent: sig.pnlPercent !== undefined && sig.pnlPercent !== null ? sig.pnlPercent : (existing ? existing.pnlPercent : null),
      target1Distance: sig.target1Distance !== undefined && sig.target1Distance !== null ? sig.target1Distance : (existing ? existing.target1Distance : null),
      stopLossDistance: sig.stopLossDistance !== undefined && sig.stopLossDistance !== null ? sig.stopLossDistance : (existing ? existing.stopLossDistance : null),
      riskRewardRatio: sig.riskRewardRatio !== undefined && sig.riskRewardRatio !== null ? sig.riskRewardRatio : (existing ? existing.riskRewardRatio : null),
      cmpUpdatedAt: sig.cmpUpdatedAt || (existing ? existing.cmpUpdatedAt : null),
      rawText: sig.rawText || (existing ? existing.rawText : ''),
      updatedAt: new Date().toISOString()
    };

    const prevId = sig.previousSignalId;
    if (record.previousSignalId) delete record.previousSignalId;

    // If ticker was migrated to a new canonical ID, remove stale unmapped signal key
    if (prevId && prevId !== id) {
      delete memoryDB.signals[prevId];
      if (memoryDB.clarifications[prevId]) {
        memoryDB.clarifications[prevId].status = 'RESOLVED';
        memoryDB.clarifications[prevId].resolvedSymbol = sym;
        memoryDB.clarifications[prevId].resolvedAt = new Date().toISOString();
        memoryDB.clarifications[prevId].notes = `Auto-resolved to canonical ticker ${sym}`;
      }
      if (fb) {
        fb.ref(`stocks/signals/${prevId}`).remove().catch(() => {});
        if (memoryDB.clarifications[prevId]) {
          fb.ref(`stocks/clarifications/${prevId}`).update({
            status: 'RESOLVED',
            resolvedSymbol: sym,
            resolvedAt: new Date().toISOString(),
            notes: `Auto-resolved to canonical ticker ${sym}`
          }).catch(() => {});
        }
      }
    }

    // In-memory single record
    memoryDB.signals[id] = record;
    saved.push(record);

    // If signal needs clarification, save to clarifications queue; otherwise clear any pending clarification
    if (record.requiresClarification) {
      memoryDB.clarifications[id] = {
        signalId: id,
        symbol: record.symbol,
        companyName: record.companyName,
        action: record.action,
        entryPrice: record.entryPrice,
        reason: record.clarificationReason,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
    } else if (memoryDB.clarifications[id] && memoryDB.clarifications[id].status === 'PENDING') {
      memoryDB.clarifications[id].status = 'RESOLVED';
      memoryDB.clarifications[id].resolvedSymbol = sym;
      memoryDB.clarifications[id].resolvedAt = new Date().toISOString();
      memoryDB.clarifications[id].notes = record.tickerResolvedVia ? `Auto-resolved via ${record.tickerResolvedVia}` : 'Ticker confirmed';
    }

    // Sync to Firebase
    if (fb) {
      try {
        const cleanRecord = JSON.parse(JSON.stringify(record));
        fb.ref(`stocks/signals/${id}`).set(cleanRecord).catch(() => {});
        if (record.requiresClarification) {
          const cleanClar = JSON.parse(JSON.stringify(memoryDB.clarifications[id]));
          fb.ref(`stocks/clarifications/${id}`).set(cleanClar).catch(() => {});
        } else if (memoryDB.clarifications[id]) {
          fb.ref(`stocks/clarifications/${id}`).update({
            status: 'RESOLVED',
            resolvedSymbol: sym,
            resolvedAt: memoryDB.clarifications[id].resolvedAt || new Date().toISOString(),
            notes: memoryDB.clarifications[id].notes || 'Ticker confirmed'
          }).catch(() => {});
        }
      } catch (fbErr) {
        logger.warn(`Firebase signal write failed for ${id}, kept in local DB`, { error: fbErr.message });
      }
    }
  }

  persistLocalDB();
  return saved;
}

function isBogusTicker(sym) {
  if (!sym || typeof sym !== 'string') return true;
  const s = sym.trim().toUpperCase();
  if (s.length < 2 || s.length > 15 || s.includes(' ')) return true;
  if (s === 'NA' || s === 'N/A' || s.startsWith('#N/A')) return true;
  if (s.startsWith('WHEREWEEXPECT') || s.startsWith('MAXQTY') || s === 'FAST' || s === 'NOW' || s === 'MAXQUANTITY') return true;
  return false;
}

/**
 * Get all signals with optional filtering
 */
async function getAllSignals(filters = {}) {
  let signalsList = Object.values(memoryDB.signals || {});

  // Try fetching fresh state from Firebase if available (with 2500ms timeout)
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(fb.ref('stocks/signals').once('value'), 2500);
      const val = snap ? snap.val() : null;
      if (val) {
        // Detect legacy duplicate keys or timestamped keys in Firebase
        const rawList = Object.values(val);
        const hasLegacyDuplicates = rawList.length > 85 || Object.keys(val).some(k => k.match(/_\d{10,}/));
        if (hasLegacyDuplicates) {
          logger.info(`Deduplicating ${rawList.length} Firebase signals to deterministic canonical IDs...`);
          const canonicalMap = {};
          // Sort chronologically ascending so newer updates take precedence
          rawList.sort((a, b) => new Date(a.timestamp || a.date || a.updatedAt || 0) - new Date(b.timestamp || b.date || b.updatedAt || 0));
          rawList.forEach(s => {
            const sym = (s.symbol || '').toUpperCase().trim();
            if (isBogusTicker(sym)) return;
            if ((s.source || '').includes('Deals Global') || /loot|flipkart|amazon|combo\s+pack|\bmrp\s*:/i.test(s.rawText || '')) return;
            const detId = getDeterministicSignalId(s);
            canonicalMap[detId] = {
              ...(canonicalMap[detId] || {}),
              ...s,
              id: detId,
              symbol: sym
            };
          });
          memoryDB.signals = canonicalMap;
          signalsList = Object.values(canonicalMap);
          persistLocalDB();
          // Overwrite Firebase with clean canonical map
          fb.ref('stocks/signals').set(canonicalMap).catch(err => {
            logger.warn('Failed to overwrite Firebase with deduplicated signals', { error: err.message });
          });
          logger.info(`Successfully purged duplicates from Firebase. Reduced from ${rawList.length} to ${signalsList.length} signals.`);
        } else {
          memoryDB.signals = val;
          signalsList = Object.values(val);
        }
      }
    } catch (fbErr) {
      logger.warn('Could not read from Firebase, returning local cache', { error: fbErr.message });
    }
  }

  // Filter out any bogus tickers and clean Firebase
  signalsList = signalsList.filter(s => {
    if (isBogusTicker(s.symbol)) {
      if (fb) fb.ref(`stocks/signals/${s.id}`).remove().catch(() => {});
      delete memoryDB.signals[s.id];
      return false;
    }
    return true;
  });

  // Compute real-time WhatsApp state per symbol (Exit vs. Reinitiate)
  const waStockStates = getWhatsAppStockStates(signalsList);

  // Normalize signals: enforce Source of Truth priorities, WhatsApp exit expiry, and canonical recommended buy prices
  let firebaseUpdates = null;
  signalsList = signalsList.map(s => {
    const prio = s.sourcePriority || getSourcePriority(s.source);
    const isTruth = prio === 1;
    const sym = (s.symbol || '').toUpperCase().trim();
    let entryPrice = s.entryPrice;
    let entryMax = s.entryMax;
    let status = s.status;
    let statusReason = s.statusReason;
    let isExpired = Boolean(s.isExpired);
    let isReinitiated = Boolean(s.isReinitiated);
    let modified = false;

    // 1. Check WhatsApp Exit / Reinitiate state for this symbol
    const waState = waStockStates.get(sym);
    if (waState) {
      if (waState.isExpired) {
        // Once WhatsApp issues an exit, ALL BUY calls for this stock are expired unless reinitiated in WhatsApp
        if (s.action === 'BUY' || s.action === 'ACCUMULATE') {
          if (!isExpired || status !== 'EXPIRED') {
            isExpired = true;
            status = 'EXPIRED';
            statusReason = `Buy expired: WhatsApp exit call issued (${waState.latestExit.action} @ ₹${waState.latestExit.price || 'market'}) unless reinitiated in WhatsApp`;
            modified = true;
          }
        }
      } else if (waState.isReinitiated) {
        if (isExpired) {
          isExpired = false;
          isReinitiated = true;
          modified = true;
          if (s.currentCMP && entryMax) {
            status = s.currentCMP <= entryMax ? 'IN_BUY_RANGE' : 'ABOVE_ENTRY';
            statusReason = s.currentCMP <= entryMax 
              ? `In buy range after WhatsApp reinitiation (CMP ₹${s.currentCMP} <= ₹${entryMax})`
              : `Above buy ceiling after WhatsApp reinitiation (CMP ₹${s.currentCMP} > ₹${entryMax})`;
          }
        }
      }
    }

    // Restore true Google Sheet Watchlist prices from rawText if not AARTIPHARM
    if (s.source?.includes('Watchlist') && s.rawText && sym !== 'AARTIPHARM') {
      const m = s.rawText.match(/Buy Range:\s*([\d,]+(?:\.\d+)?)/i);
      if (m) {
        const truePrice = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(truePrice) && truePrice > 0 && truePrice !== entryPrice) {
          entryPrice = truePrice;
          entryMax = truePrice;
          modified = true;
        }
      }
    }

    // 2. Aarti Pharmalabs global rule: strictly ₹770 per user instruction
    if (sym === 'AARTIPHARM' && !isExpired) {
      if (entryPrice !== 770 || entryMax !== 770) {
        entryPrice = 770;
        entryMax = 770;
        modified = true;
        if (s.currentCMP && s.currentCMP > 770) {
          status = 'ABOVE_ENTRY';
          statusReason = `Above recommended buy ceiling (CMP ₹${s.currentCMP} > ₹770)`;
        }
      }
    }

    let pnlPercent = s.pnlPercent;
    if (s.currentCMP && entryPrice && entryPrice > 0) {
      pnlPercent = parseFloat((((s.currentCMP - entryPrice) / entryPrice) * 100).toFixed(2));
    }

    if (modified && fb) {
      if (!firebaseUpdates) firebaseUpdates = {};
      firebaseUpdates[`stocks/signals/${s.id}/entryPrice`] = entryPrice;
      firebaseUpdates[`stocks/signals/${s.id}/entryMax`] = entryMax;
      if (pnlPercent !== undefined) firebaseUpdates[`stocks/signals/${s.id}/pnlPercent`] = pnlPercent;
      if (status) firebaseUpdates[`stocks/signals/${s.id}/status`] = status;
      if (statusReason) firebaseUpdates[`stocks/signals/${s.id}/statusReason`] = statusReason;
      firebaseUpdates[`stocks/signals/${s.id}/sourcePriority`] = prio;
      firebaseUpdates[`stocks/signals/${s.id}/isSourceOfTruth`] = isTruth;
      firebaseUpdates[`stocks/signals/${s.id}/isExpired`] = isExpired;
      firebaseUpdates[`stocks/signals/${s.id}/isReinitiated`] = isReinitiated;
    }

    return {
      ...s,
      symbol: sym,
      sourcePriority: prio,
      isSourceOfTruth: isTruth,
      entryPrice: entryPrice ?? null,
      entryMax: entryMax ?? null,
      status: status || 'ACTIVE',
      statusReason: statusReason || null,
      pnlPercent,
      isExpired,
      isReinitiated
    };
  });

  // Group by symbol to provide multi-source view (WhatsApp, Google Sheet Watchlist, Google Sheet Stock list, etc.)
  const bySymbolMap = new Map();
  signalsList.forEach(s => {
    const sym = (s.symbol || '').toUpperCase().trim();
    if (!bySymbolMap.has(sym)) bySymbolMap.set(sym, []);
    bySymbolMap.get(sym).push(s);
  });

  const consolidatedList = [];
  bySymbolMap.forEach((group, sym) => {
    const hasMultipleSources = group.length > 1;

    const sourcesBreakdown = group.map(sib => {
      const isWA = sib.isSourceOfTruth || (sib.source && sib.source.toLowerCase().includes('whatsapp'));
      return {
        id: sib.id,
        symbol: sym,
        companyName: sib.companyName || sym,
        source: sib.source,
        sourceLabel: isWA ? 'WhatsApp (Source of Truth)' : (sib.source?.includes('Watchlist') ? 'Google Sheet: Watchlist' : sib.source?.includes('Stock list') ? 'Google Sheet: Stock list' : sib.sourceLabel || sib.source),
        sourceType: isWA ? 'whatsapp' : (sib.source?.toLowerCase().includes('sheet') ? 'google_sheet' : 'telegram'),
        action: sib.action,
        price: sib.entryPrice || sib.entryMax || sib.target1,
        rating: sib.rating,
        status: sib.status,
        statusReason: sib.statusReason,
        isExpired: Boolean(sib.isExpired),
        isSourceOfTruth: Boolean(isWA),
        timestamp: sib.timestamp || sib.updatedAt,
        sender: sib.sender,
        rawHeader: sib.rawHeader || null,
        rawText: sib.rawText,
        sheetUrl: sib.sheetUrl || null,
        sheetTab: sib.sheetTab || null,
        sheetRow: sib.sheetRow || null
      };
    });

    // Sort: WhatsApp (1st Priority Source of Truth) is always index 0
    sourcesBreakdown.sort((a, b) => (b.isSourceOfTruth ? 1 : 0) - (a.isSourceOfTruth ? 1 : 0));

    const waCall = sourcesBreakdown.find(x => x.isSourceOfTruth);
    let finalVerdict = null;
    if (hasMultipleSources) {
      if (waCall) {
        if (waCall.isExpired || ['SELL', 'EXIT', 'COMPLETE_EXIT', 'PARTIAL_EXIT'].includes(waCall.action)) {
          finalVerdict = `WhatsApp is the Final Source of Truth: Exit call active (${waCall.action} @ ₹${waCall.price || 'market'}). Google Sheet buy call is EXPIRED.`;
        } else {
          finalVerdict = `WhatsApp is the Final Source of Truth: Active Buy call (${waCall.action} upto ₹${waCall.price}).`;
        }
      } else {
        finalVerdict = `Consensus across ${group.length} advisory sources.`;
      }
    }

    // Select primary representation: WhatsApp is 1st Priority Source of Truth, else Watchlist, else highest rated
    const primarySignal = group.find(s => s.isSourceOfTruth || s.source?.toLowerCase().includes('whatsapp'))
      || group.find(s => s.source?.toLowerCase().includes('watchlist'))
      || group[0];

    consolidatedList.push({
      ...primarySignal,
      hasMultipleSources,
      sourcesBreakdown,
      sourceOfTruth: waCall ? 'WhatsApp' : null,
      finalVerdict
    });
  });

  signalsList = filters.raw ? signalsList : consolidatedList;

  // Async sync back corrections to Firebase if needed (non-blocking)
  if (firebaseUpdates && fb) {
    fb.ref().update(firebaseUpdates).catch(err => {
      logger.debug('Firebase batch corrections sync failed', { error: err.message });
    });
  }

  // Apply filters
  if (filters.action) {
    signalsList = signalsList.filter(s => s.action?.toUpperCase() === filters.action.toUpperCase());
  }
  if (filters.source) {
    const srcLower = filters.source.toLowerCase();
    if (srcLower === 'multi_source' || srcLower === 'multi') {
      signalsList = signalsList.filter(s => s.hasMultipleSources);
    } else {
      signalsList = signalsList.filter(s => 
        s.source?.toLowerCase().includes(srcLower) || 
        s.sourcesBreakdown?.some(sb => sb.sourceLabel?.toLowerCase().includes(srcLower) || sb.sourceType?.toLowerCase().includes(srcLower))
      );
    }
  }
  if (filters.status) {
    signalsList = signalsList.filter(s => s.status?.toUpperCase() === filters.status.toUpperCase());
  }
  if (filters.requiresClarification !== undefined) {
    signalsList = signalsList.filter(s => Boolean(s.requiresClarification) === Boolean(filters.requiresClarification));
  }

  // Sort by Source Priority first (WhatsApp: 1st Priority/Source of Truth, Google Sheets: 2nd Priority, Telegram: 3),
  // then descending by timestamp / updatedAt
  signalsList.sort((a, b) => {
    const prioA = a.sourcePriority || getSourcePriority(a.source);
    const prioB = b.sourcePriority || getSourcePriority(b.source);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    return new Date(b.timestamp || b.updatedAt || 0) - new Date(a.timestamp || a.updatedAt || 0);
  });
  return signalsList;
}

/**
 * Update signal status or fields (e.g. CMP, status, target hit)
 */
async function updateSignal(id, updates) {
  if (!memoryDB.signals[id]) {
    // Check if in Firebase (with timeout)
    const fb = getFirebaseDB();
    if (fb) {
      try {
        const snap = await safeFirebaseRead(fb.ref(`stocks/signals/${id}`).once('value'), 1500);
        if (snap && snap.val()) memoryDB.signals[id] = snap.val();
      } catch (e) {}
    }
  }

  if (!memoryDB.signals[id]) return null;

  const updatedRecord = {
    ...memoryDB.signals[id],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  memoryDB.signals[id] = updatedRecord;
  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      fb.ref(`stocks/signals/${id}`).update(updates).catch(() => {});
    } catch (fbErr) {
      logger.warn(`Firebase update failed for signal ${id}`, { error: fbErr.message });
    }
  }

  return updatedRecord;
}

/**
 * Get pending clarification requests (purging bogus/stale entries & auto-resolving via trusted web sources)
 */
async function getPendingClarifications() {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(fb.ref('stocks/clarifications').once('value'), 2000);
      const val = snap ? snap.val() : null;
      if (val) memoryDB.clarifications = val;
    } catch (e) {}
  }

  const hasLoadedSignals = Object.keys(memoryDB.signals || {}).length > 0;
  const remainingPending = [];
  let dirty = false;

  for (const [key, c] of Object.entries(memoryDB.clarifications || {})) {
    if (!c || c.status !== 'PENDING') continue;

    const signalId = c.signalId || key;
    const isOrphan = hasLoadedSignals && !memoryDB.signals[signalId];
    if (isBogusTicker(c.symbol) || isOrphan) {
      delete memoryDB.clarifications[key];
      dirty = true;
      if (fb) fb.ref(`stocks/clarifications/${key}`).remove().catch(() => {});
      continue;
    }

    // Attempt trusted web auto-resolution for real pending signals
    try {
      const { resolveTickerFromWeb } = require('../services/marketQuoteService');
      const webMatch = await resolveTickerFromWeb(c.companyName || c.symbol);
      if (webMatch && webMatch.symbol) {
        await resolveClarification(signalId, webMatch.symbol, `Auto-resolved via ${webMatch.source}`);
        continue;
      }
    } catch (_) {}

    remainingPending.push(c);
  }

  if (dirty) persistLocalDB();
  return remainingPending;
}

/**
 * Resolve clarification, migrate canonical signal ID if needed, and update live CMP
 */
async function resolveClarification(id, resolvedSymbol, resolvedNotes = '') {
  const upperSym = (resolvedSymbol || '').toUpperCase().trim();
  const nowIso = new Date().toISOString();

  if (memoryDB.clarifications[id]) {
    memoryDB.clarifications[id].status = 'RESOLVED';
    memoryDB.clarifications[id].resolvedSymbol = upperSym;
    memoryDB.clarifications[id].resolvedAt = nowIso;
    memoryDB.clarifications[id].notes = resolvedNotes;
  }

  let updatedSig = null;
  let finalSignalId = id;

  if (memoryDB.signals[id]) {
    let sig = {
      ...memoryDB.signals[id],
      symbol: upperSym,
      requiresClarification: false,
      clarificationReason: null,
      updatedAt: nowIso
    };

    try {
      const { getLiveQuote, evaluateSignalWithCMP, COMPANY_TICKER_MAP } = require('../services/marketQuoteService');
      if (sig.companyName) {
        const key = sig.companyName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
        if (key && key.length >= 2) COMPANY_TICKER_MAP[key] = upperSym;
      }
      const quote = await getLiveQuote(upperSym);
      if (quote) {
        sig = evaluateSignalWithCMP(sig, quote) || sig;
      }
    } catch (_) {}

    finalSignalId = getDeterministicSignalId(sig);
    sig.id = finalSignalId;
    if (finalSignalId !== id) {
      delete memoryDB.signals[id];
    }
    memoryDB.signals[finalSignalId] = sig;
    updatedSig = sig;
  }

  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref(`stocks/clarifications/${id}`).update({
        status: 'RESOLVED',
        resolvedSymbol: upperSym,
        resolvedAt: nowIso,
        notes: resolvedNotes
      });
      if (updatedSig) {
        if (finalSignalId !== id) {
          await fb.ref(`stocks/signals/${id}`).remove().catch(() => {});
        }
        await fb.ref(`stocks/signals/${finalSignalId}`).set(JSON.parse(JSON.stringify(updatedSig)));
      }
    } catch (e) {}
  }

  return updatedSig;
}

/**
 * Save and get Best Insights
 */
async function saveBestInsights(insights) {
  memoryDB.insights = insights;
  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref('stocks/insights').set(insights);
    } catch (e) {}
  }
  return insights;
}

async function getBestInsights() {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(fb.ref('stocks/insights').once('value'), 2000);
      const val = snap ? snap.val() : null;
      if (val) memoryDB.insights = val;
    } catch (e) {
      logger.warn('Could not read insights from Firebase, returning memory cache', { error: e.message });
    }
  }
  return memoryDB.insights || [];
}

/**
 * Save and get Triggered Notifications (strictly sorted descending by timestamp - latest first)
 */
function sortNotificationsDesc(list) {
  return (list || []).sort((a, b) => {
    const tA = new Date(a.timestamp || a.triggeredAt || 0).getTime() || 0;
    const tB = new Date(b.timestamp || b.triggeredAt || 0).getTime() || 0;
    return tB - tA;
  });
}

async function saveNotification(notif) {
  if (!memoryDB.notifications) {
    memoryDB.notifications = [];
  }
  const normalized = {
    ...notif,
    timestamp: notif.timestamp || new Date().toISOString()
  };

  // Prevent exact duplicate in memory
  const existingIdx = memoryDB.notifications.findIndex(n => n.id === normalized.id);
  if (existingIdx >= 0) {
    memoryDB.notifications[existingIdx] = normalized;
  } else {
    memoryDB.notifications.unshift(normalized);
  }

  sortNotificationsDesc(memoryDB.notifications);
  if (memoryDB.notifications.length > 100) {
    memoryDB.notifications = memoryDB.notifications.slice(0, 100);
  }
  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      fb.ref(`stocks/notifications/${normalized.id}`).set(normalized).catch(() => {});
    } catch (e) {}
  }
  return normalized;
}

async function getNotifications(limit = 50) {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await safeFirebaseRead(fb.ref('stocks/notifications').limitToLast(limit).once('value'), 2000);
      const val = snap ? snap.val() : null;
      if (val) {
        memoryDB.notifications = sortNotificationsDesc(Object.values(val));
      }
    } catch (e) {
      logger.warn('Could not read notifications from Firebase, returning memory cache', { error: e.message });
    }
  }
  return sortNotificationsDesc([...(memoryDB.notifications || [])]).slice(0, limit);
}

/**
 * Persistent Alert Cooldowns (survives process restarts & deployments)
 * Default 12 hours cooldown per symbol_condition to eliminate notification noise
 */
function isAlertOnCooldown(cooldownKey, cooldownMs = 12 * 60 * 60 * 1000) {
  if (!memoryDB.alertCooldowns) {
    memoryDB.alertCooldowns = {};
  }
  const lastSent = memoryDB.alertCooldowns[cooldownKey] || 0;
  return (Date.now() - lastSent) < cooldownMs;
}

function recordAlertSent(cooldownKey) {
  if (!memoryDB.alertCooldowns) {
    memoryDB.alertCooldowns = {};
  }
  memoryDB.alertCooldowns[cooldownKey] = Date.now();
  persistLocalDB();
}

module.exports = {
  getSourcePriority,
  saveRawMessage,
  getRawMessages,
  saveSheetSnapshots,
  getSheetSnapshots,
  saveSignals,
  getAllSignals,
  updateSignal,
  getPendingClarifications,
  resolveClarification,
  saveBestInsights,
  getBestInsights,
  saveNotification,
  getNotifications,
  isAlertOnCooldown,
  recordAlertSent,
  persistLocalDB,
  getFirebaseDB,
  getWhatsAppStockStates,
  memoryDB
};
