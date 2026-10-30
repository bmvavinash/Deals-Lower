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
 * Save array of parsed signals
 */
async function saveSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return [];
  const saved = [];

  const fb = getFirebaseDB();
  const waStockStates = getWhatsAppStockStates();

  for (const sig of signals) {
    const id = sig.id || `SIG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const priority = sig.sourcePriority || getSourcePriority(sig.source);
    const isSourceOfTruth = priority === 1;
    const sym = (sig.symbol || '').toUpperCase().trim();

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

    // Check if a WhatsApp (Source of Truth) signal already exists for this symbol
    const existingSignals = Object.values(memoryDB.signals || {});
    const existingWhatsAppSignal = existingSignals.find(s => 
      s.symbol?.toUpperCase() === sym && 
      (s.isSourceOfTruth || getSourcePriority(s.source) === 1)
    );

    let finalEntryPrice = sig.entryPrice;
    let finalEntryMax = sig.entryMax;
    let finalAction = sig.action;
    let finalTarget1 = sig.target1;
    let finalStopLoss = sig.stopLoss;

    // If incoming signal is Google Sheets or Telegram, but WhatsApp already gave a trade call for this symbol,
    // preserve the WhatsApp Source of Truth trade parameters
    if (!isSourceOfTruth && existingWhatsAppSignal) {
      if (existingWhatsAppSignal.entryPrice !== undefined && existingWhatsAppSignal.entryPrice !== null) {
        finalEntryPrice = existingWhatsAppSignal.entryPrice;
      }
      if (existingWhatsAppSignal.entryMax !== undefined && existingWhatsAppSignal.entryMax !== null) {
        finalEntryMax = existingWhatsAppSignal.entryMax;
      }
      if (existingWhatsAppSignal.action) {
        finalAction = existingWhatsAppSignal.action;
      }
      if (existingWhatsAppSignal.target1 !== undefined && existingWhatsAppSignal.target1 !== null) {
        finalTarget1 = existingWhatsAppSignal.target1;
      }
      if (existingWhatsAppSignal.stopLoss !== undefined && existingWhatsAppSignal.stopLoss !== null) {
        finalStopLoss = existingWhatsAppSignal.stopLoss;
      }
    }

    // Determine WhatsApp Expiry state
    const currentWAState = waStockStates.get(sym);
    let isExpired = Boolean(sig.isExpired);
    let isReinitiated = Boolean(sig.isReinitiated);
    let status = sig.status;
    let statusReason = sig.statusReason;

    if (currentWAState) {
      if (currentWAState.isExpired && (sig.action === 'BUY' || sig.action === 'ACCUMULATE')) {
        isExpired = true;
        status = 'EXPIRED';
        statusReason = `Buy expired: WhatsApp exit call issued (${currentWAState.latestExit.action} @ ₹${currentWAState.latestExit.price || 'market'}) unless reinitiated in WhatsApp`;
      } else if (currentWAState.isReinitiated) {
        isExpired = false;
        isReinitiated = true;
      }
    }

    const record = {
      ...sig,
      id,
      symbol: sym,
      sourcePriority: priority,
      isSourceOfTruth,
      sourceLabel: isSourceOfTruth ? 'WhatsApp (Source of Truth)' : (priority === 2 ? 'Google Sheet (Secondary)' : 'Telegram'),
      entryPrice: finalEntryPrice,
      entryMax: finalEntryMax,
      action: finalAction,
      target1: finalTarget1,
      stopLoss: finalStopLoss,
      status: status || 'ACTIVE',
      statusReason: statusReason || null,
      isExpired,
      isReinitiated,
      updatedAt: new Date().toISOString()
    };

    // In-memory
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
        await fb.ref(`stocks/signals/${id}`).set(record);
        if (record.requiresClarification) {
          await fb.ref(`stocks/clarifications/${id}`).set(memoryDB.clarifications[id]);
        }
      } catch (fbErr) {
        logger.warn(`Firebase signal write failed for ${id}, kept in local DB`, { error: fbErr.message });
      }
    }
  }

  persistLocalDB();
  return saved;
}

const CANONICAL_WATCHLIST_BUY_PRICES = {
  'KMEW': 2877,
  'STEELCAS': 317,
  'SUPRIYA': 909,
  'JASH': 511,
  'E2E': 630,
  'NRBBEARING': 483,
  'MCX': 3040,
  'MANORAMA': 1737,
  'RKFORGE': 681,
  'STLTECH': 555,
  'WELCORP': 1600,
  'KUSUMGAR': 589,
  'TDPOWERSYS': 545,
  'KSHINTL': 842,
  'GALAPREC': 1034,
  'ASTRAMICRO': 1458,
  'SAREGAMA': 460,
  'VIYASH': 250,
  'THYROCARE': 522,
  'SHILPAMED': 499,
  'KDDL': 2179,
  'PWL': 110,
  'VENUSPIPES': 1311,
  'SBCL': 486,
  'SAMHI': 146,
  'LUMAXTECH': 1477,
  'GRAVITA': 1537,
  'NAVINFLUOR': 6485,
  'SAILIFE': 894,
  'IMFA': 1324,
  'GRWRHITECH': 3257,
  'ACUTAAS': 1644,
  'ARMANFIN': 1631,
  'ENTERO': 1229,
  'CSBBANK': 415,
  'INTELLECT': 1028,
  'HBLENGINE': 819,
  'SANSERA': 1680,
  'PRIVISCL': 3140,
  'JAYNECOIND': 68,
  'AARTIPHARM': 770,
  'WINDLAS': 787,
  'PAYTM': 1368,
  'INTERARCH': 2440
};

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
        memoryDB.signals = val;
        signalsList = Object.values(val);
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

    // 2. Google Sheet Watchlist: strictly enforce canonical recommended buy price (if not expired)
    if (!isExpired && s.source && s.source.includes('Watchlist') && CANONICAL_WATCHLIST_BUY_PRICES[sym]) {
      const canonicalPrice = CANONICAL_WATCHLIST_BUY_PRICES[sym];
      if (entryPrice !== canonicalPrice || entryMax !== canonicalPrice) {
        entryPrice = canonicalPrice;
        entryMax = canonicalPrice;
        modified = true;
        if (s.currentCMP && entryMax) {
          if (s.currentCMP > entryMax) {
            status = 'ABOVE_ENTRY';
            statusReason = `Above recommended buy ceiling (CMP ₹${s.currentCMP} > ₹${entryMax})`;
          } else {
            status = 'IN_BUY_RANGE';
            statusReason = `Currently in buy range (CMP ₹${s.currentCMP} <= ₹${entryMax})`;
          }
        }
      }
    }

    // 3. Aarti Pharmalabs global rule: strictly ₹770 per user instruction
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

    if (modified && fb) {
      if (!firebaseUpdates) firebaseUpdates = {};
      firebaseUpdates[`stocks/signals/${s.id}/entryPrice`] = entryPrice;
      firebaseUpdates[`stocks/signals/${s.id}/entryMax`] = entryMax;
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
      isExpired,
      isReinitiated
    };
  });

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
    signalsList = signalsList.filter(s => s.source?.toLowerCase().includes(filters.source.toLowerCase()));
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
  persistLocalDB,
  getFirebaseDB,
  getWhatsAppStockStates,
  memoryDB
};
