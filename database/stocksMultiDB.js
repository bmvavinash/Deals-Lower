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
 * Save raw inbound message for permanent audit trail
 */
async function saveRawMessage(msgData) {
  const id = msgData.id || `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const record = {
    ...msgData,
    id,
    storedAt: new Date().toISOString()
  };

  // 1. Save in memory & local backup
  memoryDB.rawMessages[id] = record;
  persistLocalDB();

  // 2. Sync to Firebase
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
  const sym = (sig.symbol || '').toUpperCase().trim();
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
      status: status || (existing ? existing.status : 'ACTIVE'),
      statusReason: statusReason || (existing ? existing.statusReason : null),
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

    // In-memory single record
    memoryDB.signals[id] = record;
    saved.push(record);

    // If signal needs clarification, also save to clarifications queue
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
    }

    // Sync to Firebase
    if (fb) {
      try {
        const cleanRecord = JSON.parse(JSON.stringify(record));
        fb.ref(`stocks/signals/${id}`).set(cleanRecord).catch(() => {});
        if (record.requiresClarification) {
          const cleanClar = JSON.parse(JSON.stringify(memoryDB.clarifications[id]));
          fb.ref(`stocks/clarifications/${id}`).set(cleanClar).catch(() => {});
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

  // Try fetching fresh state from Firebase if available
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await fb.ref('stocks/signals').once('value');
      const val = snap.val();
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
        rawText: sib.rawText
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
    // Check if in Firebase
    const fb = getFirebaseDB();
    if (fb) {
      const snap = await fb.ref(`stocks/signals/${id}`).once('value');
      if (snap.val()) memoryDB.signals[id] = snap.val();
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
      await fb.ref(`stocks/signals/${id}`).update(updates);
    } catch (fbErr) {
      logger.warn(`Firebase update failed for signal ${id}`, { error: fbErr.message });
    }
  }

  return updatedRecord;
}

/**
 * Get pending clarification requests
 */
async function getPendingClarifications() {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await fb.ref('stocks/clarifications').once('value');
      const val = snap.val();
      if (val) memoryDB.clarifications = val;
    } catch (e) {}
  }
  return Object.values(memoryDB.clarifications || {}).filter(c => c.status === 'PENDING');
}

/**
 * Resolve clarification and update signal ticker
 */
async function resolveClarification(id, resolvedSymbol, resolvedNotes = '') {
  if (memoryDB.clarifications[id]) {
    memoryDB.clarifications[id].status = 'RESOLVED';
    memoryDB.clarifications[id].resolvedSymbol = resolvedSymbol;
    memoryDB.clarifications[id].resolvedAt = new Date().toISOString();
    memoryDB.clarifications[id].notes = resolvedNotes;
  }

  if (memoryDB.signals[id]) {
    memoryDB.signals[id].symbol = resolvedSymbol.toUpperCase();
    memoryDB.signals[id].requiresClarification = false;
    memoryDB.signals[id].clarificationReason = null;
  }

  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref(`stocks/clarifications/${id}`).update({
        status: 'RESOLVED',
        resolvedSymbol: resolvedSymbol.toUpperCase(),
        resolvedAt: new Date().toISOString(),
        notes: resolvedNotes
      });
      if (memoryDB.signals[id]) {
        await fb.ref(`stocks/signals/${id}`).update({
          symbol: resolvedSymbol.toUpperCase(),
          requiresClarification: false,
          clarificationReason: null
        });
      }
    } catch (e) {}
  }

  return memoryDB.signals[id] || null;
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
      const snap = await fb.ref('stocks/insights').once('value');
      const val = snap.val();
      if (val) memoryDB.insights = val;
    } catch (e) {}
  }
  return memoryDB.insights || [];
}

/**
 * Save and get Triggered Notifications
 */
async function saveNotification(notif) {
  if (!memoryDB.notifications) {
    memoryDB.notifications = [];
  }
  // Prevent exact duplicate in memory
  const existingIdx = memoryDB.notifications.findIndex(n => n.id === notif.id);
  if (existingIdx >= 0) {
    memoryDB.notifications[existingIdx] = notif;
  } else {
    memoryDB.notifications.unshift(notif);
  }

  if (memoryDB.notifications.length > 100) {
    memoryDB.notifications = memoryDB.notifications.slice(0, 100);
  }
  persistLocalDB();

  const fb = getFirebaseDB();
  if (fb) {
    try {
      await fb.ref(`stocks/notifications/${notif.id}`).set(notif);
    } catch (e) {}
  }
  return notif;
}

async function getNotifications(limit = 50) {
  const fb = getFirebaseDB();
  if (fb) {
    try {
      const snap = await fb.ref('stocks/notifications').limitToLast(limit).once('value');
      const val = snap.val();
      if (val) {
        memoryDB.notifications = Object.values(val).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
    } catch (e) {}
  }
  return (memoryDB.notifications || []).slice(0, limit);
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
