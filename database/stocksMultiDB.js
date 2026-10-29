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
 * Save array of parsed signals
 */
async function saveSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return [];
  const saved = [];

  const fb = getFirebaseDB();

  for (const sig of signals) {
    const id = sig.id || `SIG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const record = {
      ...sig,
      id,
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

  // Sort descending by timestamp / updatedAt
  signalsList.sort((a, b) => new Date(b.timestamp || b.updatedAt || 0) - new Date(a.timestamp || a.updatedAt || 0));
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
  memoryDB
};
