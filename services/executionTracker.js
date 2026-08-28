const { getModuleLogger } = require('../logger/logger');
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const os = require('os');

const logger = getModuleLogger('executionTracker');

function getHostMetadata() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  try {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  } catch (e) {
    logger.warn('Error fetching local IPs', { error: e.message });
  }

  const hostnameLower = os.hostname().toLowerCase();
  const isRender = !!process.env.RENDER || !!process.env.RENDER_SERVICE_NAME;
  const envType = isRender ? 'Render Server' : (hostnameLower.includes('laptop') || hostnameLower.includes('desktop') || hostnameLower.includes('local') || hostnameLower.includes('pc') || hostnameLower.includes('anil') ? 'Local Laptop' : 'Remote Server');

  return {
    hostname: os.hostname(),
    username: os.userInfo()?.username || 'unknown',
    platform: os.platform(),
    release: os.release(),
    ips: ips.join(', ') || '127.0.0.1',
    envType
  };
}

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
    
    this.queue = [];
    this.isProcessingQueue = false;
    
    // Initialize Firebase ref if available
    if (db) {
      this.ref = db.ref('executionTracking');
      this.setupFirebaseListeners();
    }
  }

  setupFirebaseListeners() {
    // Listen for real-time updates
    this.ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.currentExecution = data.current || null;
        
        // Ensure currentExecution.platforms is always an object if currentExecution exists
        if (this.currentExecution && (!this.currentExecution.platforms || typeof this.currentExecution.platforms !== 'object')) {
          logger.warn('Firebase listener: currentExecution.platforms is invalid, fixing', {
            platformsType: typeof this.currentExecution.platforms,
            platformsValue: this.currentExecution.platforms
          });
          this.currentExecution.platforms = {};
        }
        
        // Ensure executionHistory is parsed as array robustly
        const history = data.history;
        let historyArray = [];
        if (Array.isArray(history)) {
          historyArray = history;
        } else if (history && typeof history === 'object') {
          historyArray = Object.values(history);
        }
        historyArray.sort((a, b) => {
          const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
          const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
          return tB - tA;
        });
        this.executionHistory = historyArray;
        
        this.platformQueue = data.platformQueue || [];
        this.categoryQueue = data.categoryQueue || [];
        this.telegramQueue = data.telegramQueue || this.telegramQueue;

        // Parse task queue
        const queueData = data.queue;
        let queueArray = [];
        if (queueData && typeof queueData === 'object') {
          queueArray = Object.values(queueData);
          queueArray.sort((a, b) => {
            const tA = a.enqueuedAt ? new Date(a.enqueuedAt).getTime() : 0;
            const tB = b.enqueuedAt ? new Date(b.enqueuedAt).getTime() : 0;
            return tA - tB;
          });
        }
        this.queue = queueArray;
      }
    });
  }

  /**
   * Save a completed execution to history and reset current execution
   */
  async saveToHistory(historyEntry) {
    if (!this.executionHistory) {
      this.executionHistory = [];
    }

    // Set completed timestamp
    historyEntry.completedAt = new Date().toISOString();

    // Add to in-memory list
    this.executionHistory.unshift(historyEntry);
    if (this.executionHistory.length > 200) {
      this.executionHistory = this.executionHistory.slice(0, 200);
    }

    if (this.ref) {
      try {
        await this.ref.child('current').set(null);
        await this.ref.child('history').push(historyEntry);
      } catch (err) {
        logger.error('Failed to save execution history to Firebase', { error: err.message });
      }
    }
  }

  /**
   * Start tracking a bulk update execution
   */
  async startBulkExecution(sourceType, targetDb, clientMetadata = null) {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `bulk_${Date.now()}`,
      type: 'bulk_update',
      sourceType,
      targetDb,
      status: 'running',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      platforms: {}, // Ensure platforms is always an object
      currentPlatform: null,
      currentCategory: null,
      totalProducts: 0,
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      errors: [],
      host: {
        hostname: hostInfo.hostname,
        username: hostInfo.username,
        platform: hostInfo.platform,
        ips: hostInfo.ips,
        envType: hostInfo.envType
      },
      client: clientMetadata ? {
        ip: clientMetadata.ip,
        origin: clientMetadata.origin,
        userAgent: clientMetadata.userAgent
      } : {
        ip: 'N/A',
        origin: sourceType === 'scheduler' ? 'Scheduler' : 'CLI/Script',
        userAgent: 'N/A'
      }
    };
    
    // Ensure platforms is always an object (defensive programming)
    if (!execution.platforms || typeof execution.platforms !== 'object') {
      execution.platforms = {};
    }

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
    }

    logger.info('Bulk execution started', { executionId: execution.id });
    return execution;
  }

  /**
   * Start tracking a Telegram bot execution
   */
  async startTelegramExecution(channel = 'default', clientMetadata = null, sourceType = 'telegram') {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `telegram_${Date.now()}`,
      type: 'telegram_bot',
      channel,
      status: 'running',
      sourceType,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
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
      errors: [],
      host: {
        hostname: hostInfo.hostname,
        username: hostInfo.username,
        platform: hostInfo.platform,
        ips: hostInfo.ips,
        envType: hostInfo.envType
      },
      client: clientMetadata ? {
        ip: clientMetadata.ip,
        origin: clientMetadata.origin,
        userAgent: clientMetadata.userAgent
      } : {
        ip: 'N/A',
        origin: sourceType === 'scheduler' ? 'Scheduler' : 'CLI/Script',
        userAgent: 'N/A'
      }
    };

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
    }

    logger.info('Started Telegram execution tracking', { executionId: execution.id, channel });
    return execution;
  }

  /**
   * Start tracking a favorites check execution
   */
  async startFavoritesExecution(sourceType = 'scheduler', clientMetadata = null) {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `fav_${Date.now()}`,
      type: 'favorites_check',
      sourceType,
      status: 'running',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      errors: [],
      host: {
        hostname: hostInfo.hostname,
        username: hostInfo.username,
        platform: hostInfo.platform,
        ips: hostInfo.ips,
        envType: hostInfo.envType
      },
      client: clientMetadata ? {
        ip: clientMetadata.ip,
        origin: clientMetadata.origin,
        userAgent: clientMetadata.userAgent
      } : {
        ip: 'N/A',
        origin: sourceType === 'scheduler' ? 'Scheduler' : 'CLI/Script',
        userAgent: 'N/A'
      }
    };

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
    }

    logger.info('Favorites check execution started', { executionId: execution.id, sourceType });
    return execution;
  }

  /**
   * Complete a favorites check execution
   */
  async endFavoritesExecution(status, summary = {}) {
    if (this.currentExecution && this.currentExecution.type === 'favorites_check') {
      const executionCopy = { ...this.currentExecution };
      executionCopy.status = status;
      executionCopy.endTime = new Date().toISOString();
      executionCopy.duration = Date.now() - new Date(executionCopy.startTime).getTime();
      executionCopy.summary = summary;

      await this.saveToHistory(executionCopy);

      logger.info('Favorites check execution completed', { id: executionCopy.id, status });
      this.currentExecution = null;
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Start tracking a DB update execution
   */
  async startDbUpdateExecution(scriptName, sourceType = 'cli', clientMetadata = null) {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `db_${Date.now()}`,
      type: 'db_update',
      scriptName,
      sourceType,
      status: 'running',
      startTime: new Date().toISOString(),
      errors: [],
      host: {
        hostname: hostInfo.hostname,
        username: hostInfo.username,
        platform: hostInfo.platform,
        ips: hostInfo.ips,
        envType: hostInfo.envType
      },
      client: clientMetadata ? {
        ip: clientMetadata.ip,
        origin: clientMetadata.origin,
        userAgent: clientMetadata.userAgent
      } : {
        ip: 'N/A',
        origin: sourceType === 'scheduler' ? 'Scheduler' : 'CLI/Script',
        userAgent: 'N/A'
      }
    };

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
    }

    logger.info('DB update execution started', { id: execution.id, scriptName, sourceType });
    return execution;
  }

  /**
   * Complete a DB update execution
   */
  async endDbUpdateExecution(status, summary = {}) {
    if (this.currentExecution && this.currentExecution.type === 'db_update') {
      const executionCopy = { ...this.currentExecution };
      executionCopy.status = status;
      executionCopy.endTime = new Date().toISOString();
      executionCopy.duration = Date.now() - new Date(executionCopy.startTime).getTime();
      executionCopy.summary = summary;

      await this.saveToHistory(executionCopy);

      logger.info('DB update execution completed', { id: executionCopy.id, status });
      this.currentExecution = null;
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Update Telegram message progress
   */
  async updateTelegramMessageProgress(status = 'processed') {
    if (!this.currentExecution || this.currentExecution.type !== 'telegram_bot') return;

    if (!this.currentExecution.messages || typeof this.currentExecution.messages !== 'object') {
      this.currentExecution.messages = { total: 0, processed: 0, failed: 0 };
    }
    
    if (status === 'processed') {
      this.currentExecution.messages.processed += 1;
    } else if (status === 'failed') {
      this.currentExecution.messages.failed += 1;
    }
    this.currentExecution.messages.total += 1;
    this.currentExecution.lastUpdate = new Date().toISOString();
    
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
    
    const products = this.currentExecution.products || {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      byPlatform: {}
    };
    this.currentExecution.products = products;
    if (!products.byPlatform || typeof products.byPlatform !== 'object') {
      products.byPlatform = {};
    }

    products.total += 1;
    this.currentExecution.lastUpdate = new Date().toISOString();
    
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
      const executionCopy = { ...this.currentExecution };
      executionCopy.status = 'completed';
      executionCopy.endTime = new Date().toISOString();
      executionCopy.duration = Date.now() - new Date(executionCopy.startTime).getTime();
      
      await this.saveToHistory(executionCopy);

      logger.info('Telegram execution completed', { 
        executionId: executionCopy.id,
        duration: executionCopy.duration,
        messagesProcessed: executionCopy.messages?.processed || 0,
        productsProcessed: executionCopy.products?.processed || 0
      });

      this.currentExecution = null;
      setTimeout(() => this.processQueue(), 1000);

      return executionCopy;
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
    if (!platformData) return;
    if (!platformData.categories || typeof platformData.categories !== 'object') {
      platformData.categories = {};
    }
    if (!platformData.categories[category]) return;
    
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
    
    // Let updateCategoryProgress handle all rollups (category, platform, execution) and Firebase save!
    await this.updateCategoryProgress(platform, category, progress);
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
    if (!platformData) return;
    if (!platformData.categories || typeof platformData.categories !== 'object') {
      platformData.categories = {};
    }
    if (!platformData.categories[category]) return;
    
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
    if (!this.currentExecution) return;
    
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
      await this.updateCurrentPlatform(platform, category);
      platformData = this.currentExecution.platforms[platform];
    }
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

    // Update execution totals
    this.currentExecution.totalProducts += progress.totalProducts || 0;
    this.currentExecution.totalProcessed += progress.processed || 0;
    this.currentExecution.totalCreated += progress.created || 0;
    this.currentExecution.totalUpdated += progress.updated || 0;

    if (this.ref) {
      await this.ref.child('current').set(this.currentExecution);
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

      // Copy active state first to prevent real-time listener nulling issues
      const executionCopy = { ...this.currentExecution };
      executionCopy.status = 'completed';
      executionCopy.endTime = new Date().toISOString();
      executionCopy.duration = Date.now() - new Date(executionCopy.startTime).getTime();
      
      // Ensure summary totals propagate to the root counts if available
      if (summary) {
        executionCopy.totalProducts = summary.totalProducts !== undefined ? summary.totalProducts : executionCopy.totalProducts;
        executionCopy.totalProcessed = summary.totalSuccess !== undefined ? summary.totalSuccess : executionCopy.totalProcessed;
        
        // Map created & updated counts if not already populated
        let created = 0, updated = 0;
        if (summary.results) {
          Object.values(summary.results).forEach((platResult) => {
            if (platResult && typeof platResult === 'object') {
              if (platResult.results) {
                Object.values(platResult.results).forEach((catResult) => {
                  created += catResult.createdCount || 0;
                  updated += catResult.updatedCount || 0;
                });
              } else {
                created += platResult.createdCount || 0;
                updated += platResult.updatedCount || 0;
              }
            }
          });
          executionCopy.totalCreated = created || executionCopy.totalCreated;
          executionCopy.totalUpdated = updated || executionCopy.totalUpdated;
        }
      }
      executionCopy.summary = summary;

      await this.saveToHistory(executionCopy);

      logger.info('Bulk execution completed', { 
        executionId: executionCopy.id,
        duration: executionCopy.duration,
        totalProducts: executionCopy.totalProducts
      });

      return executionCopy;
    } catch (error) {
      logger.error('Error in completeBulkExecution', {
        error: error.message,
        stack: error.stack,
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
   * Enqueue a new execution task
   */
  async enqueueTask(type, params = {}, client = null, forceParallel = false) {
    if (forceParallel) {
      logger.info(`Force parallel execution requested for task type ${type}`);
      const mockTaskId = `task_parallel_${Date.now()}`;
      this.executeTask(mockTaskId, { type, params, client }).catch(err => {
        logger.error(`Parallel task execution failed`, { type, error: err.message });
      });
      return { id: mockTaskId, type, status: 'running', message: 'Force parallel execution started' };
    }

    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      params: params || {},
      status: 'pending',
      enqueuedAt: new Date().toISOString(),
      client: client ? {
        ip: client.ip || 'N/A',
        origin: client.origin || 'API/Script',
        userAgent: client.userAgent || 'N/A'
      } : {
        ip: 'N/A',
        origin: 'System',
        userAgent: 'N/A'
      }
    };

    if (this.ref) {
      await this.ref.child('queue').child(task.id).set(task);
    }

    logger.info(`Task enqueued successfully`, { taskId: task.id, type });

    // Trigger queue processing
    setTimeout(() => this.processQueue(), 500);

    return task;
  }

  /**
   * Cancel and remove a pending task from the queue
   */
  async cancelQueuedTask(taskId) {
    if (this.ref) {
      await this.ref.child('queue').child(taskId).remove();
    }
    logger.info(`Task ${taskId} cancelled and removed from queue`);
  }

  /**
   * Process the next task in the queue sequentially
   */
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (true) {
        const status = this.getCurrentStatus();
        if (status.currentExecution && status.currentExecution.status === 'running') {
          logger.info('Queue processing: An execution is already running, waiting.');
          break;
        }

        if (!this.ref) {
          logger.warn('Queue processing: Firebase not initialized, cannot process queue');
          break;
        }

        const queueSnap = await this.ref.child('queue').orderByChild('status').equalTo('pending').limitToFirst(1).once('value');
        if (!queueSnap.exists()) {
          break;
        }

        const queueData = queueSnap.val();
        const taskId = Object.keys(queueData)[0];
        const task = queueData[taskId];

        await this.ref.child('queue').child(taskId).update({
          status: 'running',
          startedAt: new Date().toISOString()
        });

        logger.info(`Queue processing: Starting task ${task.type} (${taskId})`);

        this.executeTask(taskId, task).catch(err => {
          logger.error(`Queue processing: Task execution error`, { taskId, error: err.message });
        });

        break;
      }
    } catch (error) {
      logger.error('Error processing queue', { error: error.message });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute the specific task by type
   */
  async executeTask(taskId, task) {
    const { type, params, client } = task;
    
    const finalizeTask = async (status, result = {}) => {
      try {
        if (this.ref) {
          await this.ref.child('queue').child(taskId).remove();
        }
        logger.info(`Queue processing: Task ${type} (${taskId}) finished with status: ${status}`);
        setTimeout(() => this.processQueue(), 1000);
      } catch (err) {
        logger.error(`Queue processing: Failed to finalize task ${taskId}`, { error: err.message });
      }
    };

    try {
      if (type === 'bulk_update') {
        const { runBulkUpdateAll } = require('../scripts/bulkUpdateAllPlatforms');
        await runBulkUpdateAll(params.sourceType || 'website', params.targetDb || 'productdeals', client);
        await finalizeTask('completed');
      } 
      else if (type === 'telegram_bot') {
        const path = require('path');
        const { spawn } = require('child_process');
        const scriptPath = path.resolve(__dirname, '..', 'run_telegram_bot.js');
        
        const child = spawn(process.execPath, [scriptPath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          env: {
            ...process.env,
            TRIGGER_SOURCE: 'api',
            TRIGGER_CLIENT_IP: client?.ip || '127.0.0.1',
            TRIGGER_CLIENT_ORIGIN: client?.origin || 'Website Direct',
            TRIGGER_CLIENT_UA: client?.userAgent || 'Unknown'
          }
        });
        child.unref();
        
        await new Promise(r => setTimeout(r, 5000));
        await finalizeTask('completed');
      } 
      else if (type === 'favorites_check') {
        const { favoritesNotificationService } = require('./favoritesNotificationService');
        await favoritesNotificationService.processFavoritesAndNotifications(params.sourceType || 'api');
        await finalizeTask('completed');
      } 
      else if (type === 'db_update') {
        const path = require('path');
        const { spawn } = require('child_process');
        const scriptPath = path.resolve(__dirname, '..', 'scripts', 'updateStaleProducts.js');
        
        const child = spawn(process.execPath, [scriptPath], {
          env: {
            ...process.env,
            TRIGGER_SOURCE: 'api'
          }
        });
        
        child.on('close', async (code) => {
          await finalizeTask(code === 0 ? 'completed' : 'failed');
        });
      } 
      else if (type === 'sale_scraper') {
        const { saleName, platform, category, urls } = params;
        const { BannerExtractor } = require('../scrappers/bannerExtractor');
        const { bannerUrlFixer } = require('../utils/bannerUrlFixer');
        const { bannerDB, testBannerDB } = require('../database/firebaseDB/bannerDB');
        const constants = require('../config/constants');
        
        const logs = [];
        const log = (msg) => {
          const time = new Date().toLocaleTimeString();
          logs.push(`[${time}] ${msg}`);
          logger.info(msg);
        };

        const runScraping = async () => {
          log(`Starting Selenium Chrome driver for queued scraper...`);
          const extractor = new BannerExtractor({
            visibility: true,
            useExistingChrome: false,
            requiresLogin: false
          });
          
          await extractor.initializeDriver();
          log(`Chrome WebDriver started successfully.`);
          
          await this.startScraperExecution(saleName, urls.length);
          
          let processed = 0;
          let extractedCount = 0;
          const bannerSource = constants.banners?.source || 'test-banners';
          
          for (const url of urls) {
            if (!url.trim()) continue;
            processed++;
            log(`Scraping URL (${processed}/${urls.length}): ${url}`);
            await this.updateScraperProgress(processed, extractedCount, logs);
            logs.length = 0;
            
            try {
              await extractor.driver.get(url);
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              const platformConfig = {
                selectors: {
                  carousel: 'img',
                  bannerLink: 'a',
                  bannerImage: 'img',
                  bannerAlt: 'img[alt]'
                },
                validation: {
                  minImageWidth: 200,
                  minImageHeight: 100,
                  allowedDomains: []
                }
              };
              
              const urlBanners = await extractor.extractBannersFromUrl(platform, platformConfig.selectors, platformConfig.validation);
              log(`Found ${urlBanners.length} potential deals/banners on this page.`);
              
              if (urlBanners.length > 0) {
                const fixedBanners = await bannerUrlFixer.fixBannerUrls(urlBanners);
                const enriched = fixedBanners.map(b => ({
                  ...b,
                  category: category,
                  platform: platform.toLowerCase(),
                  title: b.title || `${saleName} Deal`,
                  isActive: true
                }));
                
                const storeResult = bannerSource === 'test-banners' ? 
                  await testBannerDB.storeMultipleTestBanners(enriched) : 
                  await bannerDB.storeMultipleBanners(enriched);
                  
                const stored = storeResult.filter(r => r.status === 200 || r.status === 201).length;
                extractedCount += stored;
                log(`Successfully stored ${stored} new live deals in database.`);
              }
            } catch (err) {
              log(`Error scraping ${url}: ${err.message}`);
            }
            
            await this.updateScraperProgress(processed, extractedCount, logs);
            logs.length = 0;
          }
          
          await extractor.closeDriver();
          log(`Web scraper completed. Extracted a total of ${extractedCount} deals.`);
          await this.endScraperExecution('completed', { processedUrls: processed, totalExtracted: extractedCount });
        };
        
        await runScraping();
        await finalizeTask('completed');
      } 
      else {
        throw new Error(`Unsupported task type: ${type}`);
      }
    } catch (err) {
      logger.error(`Error executing task ${taskId}`, { error: err.message });
      await finalizeTask('failed');
    }
  }

  /**
   * Get current execution status
   */
  getCurrentStatus() {
    // Get real-time Telegram queue status if available
    let telegramQueue = this.telegramQueue;
    
    let getTelegramQueueStatus = null;
    try {
      const telegramModule = require('../dataSources/autoTelegramAll');
      getTelegramQueueStatus = telegramModule.getQueueStatus;
    } catch (e) {
      // Module not available, will use fallback
    }
    
    if (getTelegramQueueStatus) {
      try {
        const realTimeQueue = getTelegramQueueStatus();
        telegramQueue = {
          pending: realTimeQueue.pending,
          processing: realTimeQueue.processing,
          channels: realTimeQueue.channels
        };
      } catch (e) {
        // Fallback to stored status
      }
    }
    
    return {
      currentExecution: this.currentExecution,
      telegramQueue: telegramQueue,
      platformQueue: this.platformQueue,
      categoryQueue: this.categoryQueue,
      queue: this.queue || []
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

  async startScraperExecution(saleName, urlsCount, clientMetadata = null) {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `scraper_${Date.now()}`,
      type: 'sale_scraper',
      saleName,
      status: 'running',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      totalUrls: urlsCount,
      processedUrls: 0,
      extractedBanners: 0,
      errors: [],
      logs: [`[INFO] Scraper started for sale: "${saleName}" with ${urlsCount} target URLs.`],
      host: {
        hostname: hostInfo.hostname,
        username: hostInfo.username,
        platform: hostInfo.platform,
        ips: hostInfo.ips,
        envType: hostInfo.envType
      },
      client: clientMetadata ? {
        ip: clientMetadata.ip,
        origin: clientMetadata.origin,
        userAgent: clientMetadata.userAgent
      } : {
        ip: 'N/A',
        origin: 'API/Script',
        userAgent: 'N/A'
      }
    };

    this.currentExecution = execution;
    
    if (this.ref) {
      await this.ref.child('current').set(execution);
    }
    
    logger.info('Scraper execution started', { saleName, id: execution.id });
    return execution;
  }

  async updateScraperProgress(processedUrls, extractedBanners, newLogs = []) {
    if (this.currentExecution && this.currentExecution.type === 'sale_scraper') {
      this.currentExecution.processedUrls = processedUrls;
      this.currentExecution.extractedBanners = extractedBanners;
      this.currentExecution.lastUpdate = new Date().toISOString();
      if (newLogs.length > 0) {
        this.currentExecution.logs = [...(this.currentExecution.logs || []), ...newLogs];
      }
      
      if (this.ref) {
        await this.ref.child('current').set(this.currentExecution);
      }
    }
  }

  async endScraperExecution(status, summary = {}) {
    if (this.currentExecution && this.currentExecution.type === 'sale_scraper') {
      const executionCopy = { ...this.currentExecution };
      executionCopy.status = status; // 'completed' or 'failed'
      executionCopy.endTime = new Date().toISOString();
      executionCopy.duration = Date.now() - new Date(executionCopy.startTime).getTime();
      executionCopy.summary = summary;
      executionCopy.logs = [...(executionCopy.logs || [])];
      executionCopy.logs.push(`[INFO] Scraper finished with status: ${status}. Extracted banners: ${executionCopy.extractedBanners}.`);
      
      await this.saveToHistory(executionCopy);
      
      logger.info('Scraper execution completed', { id: executionCopy.id, status });
      this.currentExecution = null;
      setTimeout(() => this.processQueue(), 1000);
    }
  }
}

const executionTracker = new ExecutionTracker();

module.exports = { executionTracker };
