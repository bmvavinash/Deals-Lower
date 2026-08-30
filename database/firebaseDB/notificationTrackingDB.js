const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('notificationTrackingDB');

// Use the same Firebase instance as productDealsDB
const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

// Initialize Firebase Admin if not already initialized
// Use the same Firebase instance as productDealsDB to avoid conflicts
let db;
try {
  // Try to get existing database instance
  db = admin.database();
  logger.debug('Using existing Firebase database instance');
} catch (error) {
  // If no instance exists, initialize (shouldn't happen as productDealsDB initializes first)
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
      }
    }

    if (!serviceAccount) {
      try {
        serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
      } catch (e) {
        console.error(`Firebase credentials file not found at ${constants.pathToFile}/${filePath}.json and no FIREBASE_SERVICE_ACCOUNT_JSON env variable provided.`);
        throw e;
      }
    }
    const dbUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: dbUrl
    });
    db = admin.database();
    logger.info(`Firebase initialized for notification tracking: ${DB_Name} on ${dbUrl}`);
  } catch (initError) {
    logger.error('Failed to initialize Firebase for notification tracking', { error: initError.message });
    throw initError;
  }
}

class NotificationTrackingDB {
  constructor() {
    this.ref = db.ref('notificationTracking');
  }

  /**
   * Track notification sent to a platform for a deal
   * @param {string} productCode - Product code/ID
   * @param {string} platform - Platform name (telegram, whatsapp, facebook)
   * @param {boolean} success - Whether notification was successful
   * @param {string} dealType - Type of deal (hotDeal, productDeal)
   * @param {string} error - Error message if failed
   * @returns {Promise<boolean>}
   */
  async trackNotification(productCode, platform, success, dealType = 'productDeal', error = null) {
    try {
      if (!productCode || !platform) {
        logger.warn('trackNotification called with missing productCode or platform');
        return false;
      }

      const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
      const now = new Date().toISOString();
      
      const notificationRef = this.ref.child(safeKey);
      const snapshot = await notificationRef.once('value');
      const existing = snapshot.val() || {};

      await notificationRef.child('sentTo').child(platform).set({
        sent: true,
        timestamp: now,
        success: success,
        error: error || null
      });

      const updateData = {
        productCode: productCode,
        dealType: dealType,
        updatedAt: now
      };

      if (!existing.createdAt) {
        updateData.createdAt = now;
      }

      await notificationRef.update(updateData);
      
      logger.debug(`Notification tracked: ${productCode} -> ${platform} (${success ? 'success' : 'failed'})`);
      return true;
    } catch (error) {
      logger.error('trackNotification error', { 
        productCode, 
        platform, 
        error: error.message,
        stack: error.stack 
      });
      return false;
    }
  }

  /**
   * Get notification status for a product
   * @param {string} productCode - Product code/ID
   * @returns {Promise<Object|null>}
   */
  async getNotificationStatus(productCode) {
    try {
      if (!productCode) return null;
      
      const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
      const snapshot = await this.ref.child(safeKey).once('value');
      return snapshot.val();
    } catch (error) {
      logger.error('getNotificationStatus error', { productCode, error: error.message });
      return null;
    }
  }

  /**
   * Get all notification statuses (with optional filters)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  async getAllNotificationStatuses(filters = {}) {
    try {
      const snapshot = await this.ref.once('value');
      const all = snapshot.val() || {};
      
      let results = Object.entries(all).map(([key, value]) => ({
        productCode: value.productCode || key,
        ...value
      }));

      // Apply filters
      if (filters.dealType) {
        results = results.filter(r => r.dealType === filters.dealType);
      }

      if (filters.platform) {
        results = results.filter(r => 
          r.sentTo && r.sentTo[filters.platform] && r.sentTo[filters.platform].sent
        );
      }

      if (filters.success !== undefined) {
        results = results.filter(r => {
          if (filters.platform) {
            return r.sentTo?.[filters.platform]?.success === filters.success;
          }
          // Check if any platform matches
          return Object.values(r.sentTo || {}).some(p => p.success === filters.success);
        });
      }

      return results;
    } catch (error) {
      logger.error('getAllNotificationStatuses error', { error: error.message });
      return [];
    }
  }

  /**
   * Get failed notifications
   * @returns {Promise<Array>}
   */
  async getFailedNotifications() {
    try {
      const snapshot = await this.ref.once('value');
      const all = snapshot.val() || {};
      
      const failed = [];
      
      Object.entries(all).forEach(([key, value]) => {
        if (value.sentTo) {
          Object.entries(value.sentTo).forEach(([platform, status]) => {
            if (status.sent && !status.success) {
              failed.push({
                productCode: value.productCode || key,
                platform,
                error: status.error,
                timestamp: status.timestamp,
                dealType: value.dealType
              });
            }
          });
        }
      });

      return failed;
    } catch (error) {
      logger.error('getFailedNotifications error', { error: error.message });
      return [];
    }
  }

  /**
   * Get platform statistics
   * @returns {Promise<Object>}
   */
  async getPlatformStats() {
    try {
      const snapshot = await this.ref.once('value');
      const all = snapshot.val() || {};
      
      const stats = {
        telegram: { total: 0, success: 0, failed: 0 },
        whatsapp: { total: 0, success: 0, failed: 0 },
        facebook: { total: 0, success: 0, failed: 0 }
      };

      Object.values(all).forEach(record => {
        if (record.sentTo) {
          Object.entries(record.sentTo).forEach(([platform, status]) => {
            if (status.sent) {
              if (stats[platform]) {
                stats[platform].total++;
                if (status.success) {
                  stats[platform].success++;
                } else {
                  stats[platform].failed++;
                }
              }
            }
          });
        }
      });

      return stats;
    } catch (error) {
      logger.error('getPlatformStats error', { error: error.message });
      return {};
    }
  }
}

const notificationTrackingDB = new NotificationTrackingDB();

module.exports = { notificationTrackingDB };

