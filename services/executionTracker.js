const { getModuleLogger } = require('../logger/logger');
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');

// Lazy load Telegram queue status to avoid circular dependency
// Don't import at top level - import when needed inside methods
function getTelegramQueueStatusLazy() {
  try {
    const telegramModule = require('../dataSources/autoTelegramAll');
    return telegramModule.getQueueStatus || null;
  } catch (e) {
    // Module not available or circular dependency, return null
    return null;
  }
}

const logger = getModuleLogger('executionTracker');

// Use existing Firebase instance
let db;
try {
  db = admin.database();
} catch (error) {
  logger.warn('Firebase not initialized, using in-memory tracking');
}

class ExecutionTracker {
  constructor() {
    this.currentExecution = null;
    this.executionHistory = [];
    this.platformQueue = [];
    this.categoryQueue = [];
    this.telegramQueue = {
      pending: 0,
      processing: 0,
      channels: {}
    };
    
    // Initialize Firebase ref if available
    if (db) {
      this.ref = db.ref('executionTracking');
      this.setupFirebaseListeners();
      // Load initial state from Firebase
      this.loadInitialState();
    }
  }

  async loadInitialState() {
    if (!this.ref) return;
    
    try {
      const snapshot = await this.ref.once('value');
      const data = snapshot.val();
      if (data) {
        if (data.current) {
          this.currentExecution = data.current;
          logger.info('Loaded current execution from Firebase', { 
            executionId: this.currentExecution.id,
            type: this.currentExecution.type 
          });
        }
        if (data.history) {
          this.executionHistory = Array.isArray(data.history) ? data.history : [];
        }
        if (data.telegramQueue) {
          this.telegramQueue = data.telegramQueue;
        }
      }
    } catch (error) {
      logger.warn('Failed to load initial state from Firebase', { error: error.message });
    }
  }

  setupFirebaseListeners() {
    // Listen for real-time updates
    // IMPORTANT: Only sync from Firebase if we don't have a local execution or if the execution ID matches
    // This prevents overwriting local updates with stale Firebase data
    this.ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const firebaseExecution = data.current || null;
        
        // Only update from Firebase if:
        // 1. We don't have a local execution, OR
        // 2. The Firebase execution ID matches our local execution ID (same execution)
        // This prevents race conditions where Firebase overwrites our local updates
        if (firebaseExecution) {
          if (!this.currentExecution || this.currentExecution.id === firebaseExecution.id) {
            // Merge Firebase data with local data to preserve any in-memory updates
            if (this.currentExecution && this.currentExecution.id === firebaseExecution.id) {
              // Same execution - merge to preserve local updates that might not be in Firebase yet
              this.currentExecution = {
                ...firebaseExecution,
                // Preserve local platforms data if it's more recent
                platforms: this.currentExecution.platforms && 
                           Object.keys(this.currentExecution.platforms).length > 0 &&
                           (this.currentExecution.totalProducts > firebaseExecution.totalProducts ||
                            this.currentExecution.totalProcessed > firebaseExecution.totalProcessed)
                  ? this.currentExecution.platforms
                  : firebaseExecution.platforms || {}
              };
            } else {
              // New execution or no local execution - use Firebase data
              this.currentExecution = firebaseExecution;
            }
          }
        } else if (!this.currentExecution) {
          // No Firebase execution and no local execution - set to null
          this.currentExecution = null;
        }
        
        // Ensure currentExecution.platforms is always an object if currentExecution exists
        if (this.currentExecution && (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object')) {
          logger.warn('Firebase listener: currentExecution.platforms is invalid, fixing', {
            platformsType: typeof this.currentExecution.platforms,
            platformsValue: this.currentExecution.platforms
          });
          this.currentExecution.platforms = {};
        }
        
        // Ensure executionHistory is always an array
        const history = data.history || [];
        this.executionHistory = Array.isArray(history) ? history : [];
        this.platformQueue = data.platformQueue || [];
        this.categoryQueue = data.categoryQueue || [];
        this.telegramQueue = data.telegramQueue || this.telegramQueue;
      }
    });
  }

  /**
   * Start tracking a bulk update execution
   */
  async startBulkExecution(sourceType, targetDb) {
    const execution = {
      id: `bulk_${Date.now()}`,
      type: 'bulk_update',
      sourceType,
      targetDb,
      status: 'running',
      startTime: new Date().toISOString(),
      platforms: {}, // Ensure platforms is always an object
      currentPlatform: null,
      currentCategory: null,
      totalProducts: 0,
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      errors: []
    };
    
    // Ensure platforms is always an object (defensive programming)
    if (!execution.platforms || typeof execution.platforms !== 'object') {
      execution.platforms = {};
    }

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
      await this.ref.child('history').push({
        ...execution,
        endTime: null
      });
    }

    logger.info('Bulk execution started', { executionId: execution.id });
    return execution;
  }

  /**
   * Start tracking a Telegram bot execution
   */
  async startTelegramExecution(channel = 'default') {
    const execution = {
      id: `telegram_${Date.now()}`,
      type: 'telegram_bot',
      channel,
      status: 'running',
      startTime: new Date().toISOString(),
      messages: {
        total: 0,
        processed: 0,
        failed: 0
      },
      products: {
        total: 0,
        processed: 0,
        created: 0,
        updated: 0,
        failed: 0,
        byPlatform: {}
      },
      errors: []
    };

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
      await this.ref.child('history').push({
        ...execution,
        status: 'started'
      });
    }

    logger.info('Started Telegram execution tracking', { executionId: execution.id, channel });
    return execution;
  }

  /**
   * Update Telegram message progress
   */
  async updateTelegramMessageProgress(status = 'processed') {
    if (!this.currentExecution || this.currentExecution.type !== 'telegram_bot') return;
    
    if (status === 'processed') {
      this.currentExecution.messages.processed += 1;
    } else if (status === 'failed') {
      this.currentExecution.messages.failed += 1;
    }
    this.currentExecution.messages.total += 1;
    
    if (this.ref) {
      await this.ref.child('current').set(this.currentExecution);
    }
  }

  /**
   * Update Telegram product progress
   */
  async updateTelegramProductProgress(platform, status, productCode = null) {
    if (!this.currentExecution || this.currentExecution.type !== 'telegram_bot') {
      // Auto-start Telegram execution if not started
      await this.startTelegramExecution();
    }
    
    const products = this.currentExecution.products;
    products.total += 1;
    
    if (status === 'created') {
      products.created += 1;
      products.processed += 1;
    } else if (status === 'updated') {
      products.updated += 1;
      products.processed += 1;
    } else if (status === 'failed') {
      products.failed += 1;
    }
    
    // Track by platform
    if (platform) {
      if (!products.byPlatform[platform]) {
        products.byPlatform[platform] = {
          total: 0,
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0
        };
      }
      products.byPlatform[platform].total += 1;
      if (status === 'created') {
        products.byPlatform[platform].created += 1;
        products.byPlatform[platform].processed += 1;
      } else if (status === 'updated') {
        products.byPlatform[platform].updated += 1;
        products.byPlatform[platform].processed += 1;
      } else if (status === 'failed') {
        products.byPlatform[platform].failed += 1;
      }
    }
    
    if (this.ref) {
      await this.ref.child('current').set(this.currentExecution);
    }
  }

  /**
   * Complete Telegram execution
   */
  async completeTelegramExecution() {
    if (!this.currentExecution || this.currentExecution.type !== 'telegram_bot') return;
    
    try {
      this.currentExecution.status = 'completed';
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      
      const historyEntry = { ...this.currentExecution };
      
      if (!Array.isArray(this.executionHistory)) {
        this.executionHistory = [];
      }
      
      this.executionHistory.unshift(historyEntry);
      
      if (this.executionHistory.length > 50) {
        this.executionHistory = this.executionHistory.slice(0, 50);
      }

      if (this.ref) {
        await this.ref.child('current').set(null);
        const historyToSave = Array.isArray(this.executionHistory) 
          ? this.executionHistory.slice(0, 50) 
          : [];
        await this.ref.child('history').set(historyToSave);
      }

      const previousExecution = this.currentExecution;
      this.currentExecution = null;

      logger.info('Telegram execution completed', { 
        executionId: previousExecution.id,
        duration: previousExecution.duration,
        messagesProcessed: previousExecution.messages.processed,
        productsProcessed: previousExecution.products.processed
      });

      return previousExecution;
    } catch (error) {
      logger.error('Error in completeTelegramExecution', { error: error.message });
      throw error;
    }
  }

  /**
   * Update current platform being processed
   */
  async updateCurrentPlatform(platform, category = null) {
    if (!this.currentExecution) {
      logger.warn('updateCurrentPlatform called but currentExecution is null, initializing', { platform, category });
      // Auto-initialize if not already started
      await this.startBulkExecution('website', 'productdeals');
    }

    // Ensure platforms object exists BEFORE any access
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.warn('currentExecution.platforms is undefined or invalid, initializing', {
        platformsType: typeof this.currentExecution.platforms,
        platformsValue: this.currentExecution.platforms,
        platform,
        category
      });
      this.currentExecution.platforms = {};
    }

    // Now safe to access platforms[platform]
    this.currentExecution.currentPlatform = platform;
    this.currentExecution.currentCategory = category;
    this.currentExecution.lastUpdate = new Date().toISOString();

    if (!this.currentExecution.platforms[platform]) {
      this.currentExecution.platforms[platform] = {
        startTime: new Date().toISOString(),
        categories: {},
        totalProducts: 0,
        totalProcessed: 0,
        totalCreated: 0,
        totalUpdated: 0
      };
    }

    if (this.ref) {
      try {
        // Ensure platforms[platform] exists before Firebase update
        if (!this.currentExecution.platforms[platform]) {
          this.currentExecution.platforms[platform] = {
            startTime: new Date().toISOString(),
            categories: {},
            totalProducts: 0,
            totalProcessed: 0,
            totalCreated: 0,
            totalUpdated: 0
          };
        }
        
        await this.ref.child('current').update({
          currentPlatform: platform,
          currentCategory: category,
          lastUpdate: this.currentExecution.lastUpdate,
          platforms: this.currentExecution.platforms  // Update entire platforms object instead of nested path
        });
      } catch (firebaseError) {
        logger.error('Failed to update Firebase in updateCurrentPlatform', {
          error: firebaseError.message,
          stack: firebaseError.stack,
          platform,
          category
        });
        // Don't throw - Firebase errors shouldn't stop execution
      }
    }
  }

  /**
   * Update page progress within a category
   */
  async updatePageProgress(platform, category, pageUrl, pageIndex, progress) {
    if (!this.currentExecution) return;
    
    // Ensure platforms object exists
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.warn('updatePageProgress: currentExecution.platforms is undefined or invalid, initializing', {
        platformsType: typeof this.currentExecution.platforms,
        platformsValue: this.currentExecution.platforms
      });
      this.currentExecution.platforms = {};
    }
    
    // Ensure platforms object exists before calling updateCategoryProgress
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.warn('updatePageProgress: currentExecution.platforms is undefined or invalid, initializing', {
        platformsType: typeof this.currentExecution.platforms,
        platformsValue: this.currentExecution.platforms,
        platform,
        category
      });
      this.currentExecution.platforms = {};
    }
    
    await this.updateCategoryProgress(platform, category, { totalProducts: 0, processed: 0, created: 0, updated: 0, errors: 0 });
    
    // Validate platforms still exists after updateCategoryProgress
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.error('updatePageProgress: platforms is still undefined after updateCategoryProgress', {
        platform,
        category,
        platformsType: typeof this.currentExecution.platforms
      });
      this.currentExecution.platforms = {};
    }
    
    const platformData = this.currentExecution.platforms[platform];
    if (!platformData || !platformData.categories[category]) return;
    
    const categoryData = platformData.categories[category];
    if (!categoryData.pages) {
      categoryData.pages = {};
    }
    
    const pageKey = `page_${pageIndex}`;
    if (!categoryData.pages[pageKey]) {
      categoryData.pages[pageKey] = {
        url: pageUrl,
        index: pageIndex,
        startTime: new Date().toISOString(),
        totalProducts: 0,
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        products: []
      };
    }
    
    const pageData = categoryData.pages[pageKey];
    pageData.processed += progress.processed || 0;
    pageData.created += progress.created || 0;
    pageData.updated += progress.updated || 0;
    pageData.errors += progress.errors || 0;
    pageData.totalProducts += progress.totalProducts || 0;
    pageData.lastUpdate = new Date().toISOString();
    
    // Update category totals
    categoryData.totalProducts += progress.totalProducts || 0;
    categoryData.processed += progress.processed || 0;
    categoryData.created += progress.created || 0;
    categoryData.updated += progress.updated || 0;
    categoryData.errors += progress.errors || 0;
    
    if (this.ref) {
      await this.ref.child('current').set(this.currentExecution);
    }
  }

  /**
   * Update product progress within a page
   */
  async updateProductProgress(platform, category, pageIndex, productCode, productId, status) {
    if (!this.currentExecution) return;
    
    // Ensure platforms object exists
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.warn('updateProductProgress: currentExecution.platforms is undefined or invalid, initializing', {
        platformsType: typeof this.currentExecution.platforms,
        platformsValue: this.currentExecution.platforms
      });
      this.currentExecution.platforms = {};
    }
    
    const platformData = this.currentExecution.platforms[platform];
    if (!platformData || !platformData.categories[category]) return;
    
    const categoryData = platformData.categories[category];
    if (!categoryData.pages || !categoryData.pages[`page_${pageIndex}`]) return;
    
    const pageData = categoryData.pages[`page_${pageIndex}`];
    const existingProduct = pageData.products.find(p => p.productCode === productCode);
    
    if (existingProduct) {
      existingProduct.status = status;
      existingProduct.lastUpdate = new Date().toISOString();
    } else {
      pageData.products.push({
        productCode,
        productId,
        status,
        timestamp: new Date().toISOString()
      });
    }
    
    if (this.ref) {
      await this.ref.child('current').set(this.currentExecution);
    }
  }

  /**
   * Update category progress
   */
  async updateCategoryProgress(platform, category, progress) {
    if (!this.currentExecution) {
      logger.warn('updateCategoryProgress: currentExecution is null, cannot update');
      return;
    }
    
    // Ensure platforms object exists
    if (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object') {
      logger.warn('updateCategoryProgress: currentExecution.platforms is undefined or invalid, initializing', {
        platformsType: typeof this.currentExecution.platforms,
        platformsValue: this.currentExecution.platforms
      });
      this.currentExecution.platforms = {};
    }
    
    let platformData = this.currentExecution.platforms[platform];
    if (!platformData) {
      logger.debug('updateCategoryProgress: platformData not found, calling updateCurrentPlatform', { platform, category });
      await this.updateCurrentPlatform(platform, category);
      // Re-fetch platformData after updateCurrentPlatform
      platformData = this.currentExecution.platforms[platform];
      if (!platformData) {
        logger.error('updateCategoryProgress: platformData still not found after updateCurrentPlatform, initializing manually', { platform, category });
        // Manually initialize if updateCurrentPlatform didn't work
        this.currentExecution.platforms[platform] = {
          startTime: new Date().toISOString(),
          totalProducts: 0,
          totalProcessed: 0,
          totalCreated: 0,
          totalUpdated: 0,
          categories: {}
        };
        platformData = this.currentExecution.platforms[platform];
      }
    }

    // Ensure platformData.categories exists
    if (!platformData.categories || typeof platformData.categories !== 'object') {
      platformData.categories = {};
    }

    if (!platformData.categories[category]) {
      platformData.categories[category] = {
        startTime: new Date().toISOString(),
        totalProducts: 0,
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        pages: {},
        currentPage: null,
        currentPageIndex: null
      };
    }

    const categoryData = platformData.categories[category];
    
    // Log the update for debugging
    logger.debug('updateCategoryProgress: updating category', {
      platform,
      category,
      progress,
      beforeTotal: categoryData.totalProducts,
      beforeProcessed: categoryData.processed
    });
    
    // Update category data
    categoryData.processed += progress.processed || 0;
    categoryData.created += progress.created || 0;
    categoryData.updated += progress.updated || 0;
    categoryData.errors += progress.errors || 0;
    categoryData.totalProducts += progress.totalProducts || 0;
    categoryData.lastUpdate = new Date().toISOString();

    // Update platform totals
    platformData.totalProducts += progress.totalProducts || 0;
    platformData.totalProcessed += progress.processed || 0;
    platformData.totalCreated += progress.created || 0;
    platformData.totalUpdated += progress.updated || 0;
    platformData.lastUpdate = new Date().toISOString();

    // Update execution totals
    this.currentExecution.totalProducts += progress.totalProducts || 0;
    this.currentExecution.totalProcessed += progress.processed || 0;
    this.currentExecution.totalCreated += progress.created || 0;
    this.currentExecution.totalUpdated += progress.updated || 0;
    this.currentExecution.lastUpdate = new Date().toISOString();

    // Save to Firebase - use set() to ensure full object is saved
    // IMPORTANT: Temporarily disable Firebase listener to prevent overwriting our updates
    if (this.ref) {
      try {
        // Temporarily remove listener to prevent race condition
        const listenerWasActive = this.ref.listenerCount && this.ref.listenerCount('value') > 0;
        if (listenerWasActive) {
          this.ref.off('value');
        }
        
        // Save to Firebase
        await this.ref.child('current').set(this.currentExecution);
        
        logger.info('updateCategoryProgress: saved to Firebase', {
          platform,
          category,
          totalProducts: this.currentExecution.totalProducts,
          totalProcessed: this.currentExecution.totalProcessed,
          totalCreated: this.currentExecution.totalCreated,
          categoryTotal: categoryData.totalProducts,
          categoryProcessed: categoryData.processed,
          categoryCreated: categoryData.created
        });
        
        // Re-enable listener after a short delay to allow Firebase to propagate
        if (listenerWasActive) {
          setTimeout(() => {
            this.setupFirebaseListeners();
          }, 100);
        }
      } catch (firebaseError) {
        logger.error('updateCategoryProgress: Firebase save failed', {
          error: firebaseError.message,
          stack: firebaseError.stack,
          platform,
          category
        });
        // Re-enable listener even on error
        if (this.ref && (!this.ref.listenerCount || this.ref.listenerCount('value') === 0)) {
          this.setupFirebaseListeners();
        }
        // Don't throw - continue execution
      }
    }
  }

  /**
   * Complete bulk execution
   */
  async completeBulkExecution(summary) {
    try {
      if (!this.currentExecution) {
        logger.warn('completeBulkExecution called but no current execution exists');
        return;
      }

      this.currentExecution.status = 'completed';
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      this.currentExecution.summary = summary;

      // Ensure executionHistory is an array - robust check
      if (!this.executionHistory) {
        logger.warn('executionHistory was null/undefined, initializing as empty array');
        this.executionHistory = [];
      }
      
      if (!Array.isArray(this.executionHistory)) {
        logger.error('executionHistory is not an array, converting', { 
          type: typeof this.executionHistory,
          value: this.executionHistory 
        });
        // If it's an object, try to convert to array
        if (typeof this.executionHistory === 'object' && this.executionHistory !== null) {
          this.executionHistory = Object.values(this.executionHistory);
        } else {
          this.executionHistory = [];
        }
      }

      // Move to history
      const historyEntry = {
        ...this.currentExecution,
        completedAt: new Date().toISOString()
      };
      
      // Ensure executionHistory is always an array before using unshift
      if (!Array.isArray(this.executionHistory)) {
        logger.warn('executionHistory is not an array in completeBulkExecution, initializing', {
          executionHistoryType: typeof this.executionHistory,
          executionHistoryValue: this.executionHistory
        });
        this.executionHistory = [];
      }
      
      this.executionHistory.unshift(historyEntry);

      // Keep only last 50 executions
      if (this.executionHistory.length > 50) {
        this.executionHistory = this.executionHistory.slice(0, 50);
      }

      if (this.ref) {
        await this.ref.child('current').set(null);
        // Ensure we're saving an array
        const historyToSave = Array.isArray(this.executionHistory) 
          ? this.executionHistory.slice(0, 50) 
          : [];
        await this.ref.child('history').set(historyToSave);
      }

      const previousExecution = this.currentExecution;
      this.currentExecution = null;

      logger.info('Bulk execution completed', { 
        executionId: previousExecution.id,
        duration: previousExecution.duration,
        totalProducts: previousExecution.totalProducts,
        historyLength: this.executionHistory.length
      });

      return previousExecution;
    } catch (error) {
      logger.error('Error in completeBulkExecution', {
        error: error.message,
        stack: error.stack,
        executionHistoryType: typeof this.executionHistory,
        executionHistoryIsArray: Array.isArray(this.executionHistory),
        hasCurrentExecution: !!this.currentExecution
      });
      throw error;
    }
  }

  /**
   * Track Telegram bot queue
   */
  async updateTelegramQueue(channel, pending, processing) {
    this.telegramQueue.pending = pending;
    this.telegramQueue.processing = processing;
    
    if (!this.telegramQueue.channels[channel]) {
      this.telegramQueue.channels[channel] = {
        pending: 0,
        processing: 0,
        processed: 0
      };
    }

    this.telegramQueue.channels[channel].pending = pending;
    this.telegramQueue.channels[channel].processing = processing;

    if (this.ref) {
      await this.ref.child('telegramQueue').set(this.telegramQueue);
    }
  }

  /**
   * Get current execution status
   */
  getCurrentStatus() {
    // Get real-time Telegram queue status if available (lazy loaded to avoid circular dependency)
    let telegramQueue = this.telegramQueue;
    const queueStatusFn = getTelegramQueueStatusLazy();
    if (queueStatusFn) {
      try {
        const realTimeQueue = queueStatusFn();
        telegramQueue = {
          pending: realTimeQueue.pending || telegramQueue.pending,
          processing: realTimeQueue.processing || telegramQueue.processing,
          channels: realTimeQueue.channels || telegramQueue.channels
        };
      } catch (e) {
        // Fallback to stored status - avoid circular dependency issues
        logger.debug('Could not get real-time queue status, using stored', { error: e?.message });
      }
    }
    
    return {
      currentExecution: this.currentExecution,
      telegramQueue: telegramQueue,
      platformQueue: this.platformQueue,
      categoryQueue: this.categoryQueue
    };
  }

  /**
   * Get execution history
   */
  getHistory(limit = 10) {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * Get analytics summary
   */
  getAnalytics() {
    const recent = this.executionHistory.slice(0, 10);
    
    const platformStats = {};
    const categoryStats = {};
    let totalProducts = 0;
    let totalExecutions = recent.length;

    recent.forEach(exec => {
      totalProducts += exec.totalProducts || 0;
      
      Object.entries(exec.platforms || {}).forEach(([platform, data]) => {
        if (!platformStats[platform]) {
          platformStats[platform] = {
            executions: 0,
            totalProducts: 0,
            avgProducts: 0,
            categories: {}
          };
        }
        platformStats[platform].executions++;
        platformStats[platform].totalProducts += data.totalProducts || 0;

        Object.entries(data.categories || {}).forEach(([category, catData]) => {
          if (!categoryStats[category]) {
            categoryStats[category] = {
              executions: 0,
              totalProducts: 0,
              platforms: {}
            };
          }
          categoryStats[category].executions++;
          categoryStats[category].totalProducts += catData.totalProducts || 0;
          
          if (!categoryStats[category].platforms[platform]) {
            categoryStats[category].platforms[platform] = 0;
          }
          categoryStats[category].platforms[platform] += catData.totalProducts || 0;
        });
      });
    });

    // Calculate averages
    Object.values(platformStats).forEach(stat => {
      stat.avgProducts = stat.executions > 0 ? Math.round(stat.totalProducts / stat.executions) : 0;
    });

    return {
      totalExecutions,
      totalProducts,
      platformStats,
      categoryStats,
      recentExecutions: recent.slice(0, 5)
    };
  }
}

const executionTracker = new ExecutionTracker();

module.exports = { executionTracker };

