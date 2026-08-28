/**
 * Telegram Deduplication Service
 * Persists processed message IDs and links to prevent duplicate processing after restarts
 */

const { getModuleLogger } = require('../logger/logger');
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const crypto = require('crypto');

const logger = getModuleLogger('telegramDeduplication');

// In-memory caches for fast lookups
const processedMessageIds = new Set();
const recentLinkMap = new Map(); // key -> timestamp
const RECENT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Firebase paths for persistence
const PROCESSED_MESSAGES_PATH = 'telegram/processedMessages';
const PROCESSED_LINKS_PATH = 'telegram/processedLinks';

class TelegramDeduplicationService {
  constructor() {
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize by loading persisted data from Firebase
   */
  async initialize() {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._loadPersistedData();
    await this.initializationPromise;
    this.isInitialized = true;
    logger.info('Telegram deduplication service initialized', {
      messageIds: processedMessageIds.size,
      links: recentLinkMap.size
    });
  }

  /**
   * Get Firebase database reference
   */
  _getDb() {
    const defaultApp = admin.apps.find(app => app.name === '[DEFAULT]');
    if (!defaultApp) {
      const dbname = constants.postingTypesConfig[constants.type].DB;
      const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
      const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
      const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      });
    }
    return admin.database();
  }

  /**
   * Load persisted message IDs and links from Firebase
   */
  async _loadPersistedData() {
    try {
      const db = this._getDb();
      
      // Load processed message IDs
      const messagesRef = db.ref(PROCESSED_MESSAGES_PATH);
      const messagesSnapshot = await messagesRef.once('value');
      const messages = messagesSnapshot.val() || {};
      
      // Only load recent message IDs (last 24 hours)
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      for (const [messageId, timestamp] of Object.entries(messages)) {
        if (timestamp && timestamp > oneDayAgo) {
          processedMessageIds.add(parseInt(messageId));
        }
      }

      // Load processed links
      const linksRef = db.ref(PROCESSED_LINKS_PATH);
      const linksSnapshot = await linksRef.once('value');
      const links = linksSnapshot.val() || {};
      
      // Only load links within TTL
      for (const [linkHash, timestamp] of Object.entries(links)) {
        if (timestamp && (now - timestamp) < RECENT_TTL_MS) {
          recentLinkMap.set(linkHash, timestamp);
        }
      }

      logger.info('Loaded persisted deduplication data', {
        messageIds: processedMessageIds.size,
        links: recentLinkMap.size
      });
    } catch (error) {
      logger.error('Failed to load persisted deduplication data', { error: error.message });
      // Continue with empty caches if loading fails
    }
  }

  /**
   * Normalize link by removing tracking parameters
   */
  normalizeLink(link) {
    try {
      const url = new URL(String(link).trim());
      // Strip typical tracking params to reduce duplicates
      const paramsToStrip = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','tag','ascsubtag','ref','pf_rd_p','pf_rd_r','qid','sr','sbo'];
      paramsToStrip.forEach(p => url.searchParams.delete(p));
      // Preserve dp/product id path segments; keep remaining query minimal
      return url.origin + url.pathname + (url.search ? ('?' + url.searchParams.toString()) : '');
    } catch (_) { 
      return String(link).trim(); 
    }
  }

  /**
   * Generate hash key for a link
   */
  hashKey(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  /**
   * Check if message ID has been processed
   */
  isMessageProcessed(messageId) {
    return processedMessageIds.has(messageId);
  }

  /**
   * Mark message ID as processed (persist to Firebase)
   */
  async markMessageProcessed(messageId) {
    if (!messageId) return;
    
    processedMessageIds.add(messageId);
    
    // Persist to Firebase (fire and forget)
    try {
      const db = this._getDb();
      const messagesRef = db.ref(`${PROCESSED_MESSAGES_PATH}/${messageId}`);
      await messagesRef.set(Date.now());
    } catch (error) {
      logger.warn('Failed to persist message ID', { messageId, error: error.message });
    }
  }

  /**
   * Check if link was recently processed
   */
  isLinkRecentlyProcessed(link) {
    const key = this.hashKey(this.normalizeLink(link));
    const ts = recentLinkMap.get(key);
    if (!ts) return false;
    
    // Clean up expired entries
    if ((Date.now() - ts) > RECENT_TTL_MS) {
      recentLinkMap.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Mark link as processed (persist to Firebase)
   */
  async markLinkProcessed(link) {
    if (!link) return;
    
    const key = this.hashKey(this.normalizeLink(link));
    const timestamp = Date.now();
    recentLinkMap.set(key, timestamp);
    
    // Persist to Firebase (fire and forget)
    try {
      const db = this._getDb();
      const linksRef = db.ref(`${PROCESSED_LINKS_PATH}/${key}`);
      await linksRef.set(timestamp);
    } catch (error) {
      logger.warn('Failed to persist link', { link, error: error.message });
    }
  }

  /**
   * Clean up expired entries (run periodically)
   */
  async cleanupExpiredEntries() {
    try {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      // Clean in-memory caches
      for (const [key, ts] of recentLinkMap.entries()) {
        if ((now - ts) > RECENT_TTL_MS) {
          recentLinkMap.delete(key);
        }
      }
      
      // Clean Firebase (async, don't wait)
      const db = this._getDb();
      const messagesRef = db.ref(PROCESSED_MESSAGES_PATH);
      const messagesSnapshot = await messagesRef.once('value');
      const messages = messagesSnapshot.val() || {};
      
      const updates = {};
      for (const [messageId, timestamp] of Object.entries(messages)) {
        if (!timestamp || timestamp < oneDayAgo) {
          updates[messageId] = null; // Delete
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await messagesRef.update(updates);
      }
      
      logger.debug('Cleaned up expired deduplication entries', {
        cleanedMessages: Object.keys(updates).length
      });
    } catch (error) {
      logger.warn('Failed to cleanup expired entries', { error: error.message });
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      processedMessageIds: processedMessageIds.size,
      recentLinks: recentLinkMap.size
    };
  }
}

// Singleton instance
const telegramDeduplicationService = new TelegramDeduplicationService();

// Auto-cleanup every hour
setInterval(() => {
  telegramDeduplicationService.cleanupExpiredEntries().catch(err => {
    logger.warn('Auto-cleanup failed', { error: err.message });
  });
}, 60 * 60 * 1000);

module.exports = telegramDeduplicationService;

