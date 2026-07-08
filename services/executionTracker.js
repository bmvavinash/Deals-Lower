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
      this.currentExecution.status = status;
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      this.currentExecution.summary = summary;

      const historyEntry = { ...this.currentExecution };
      await this.saveToHistory(historyEntry);

      logger.info('Favorites check execution completed', { id: historyEntry.id, status });
      this.currentExecution = null;
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
      this.currentExecution.status = status;
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      this.currentExecution.summary = summary;

      const historyEntry = { ...this.currentExecution };
      await this.saveToHistory(historyEntry);

      logger.info('DB update execution completed', { id: historyEntry.id, status });
      this.currentExecution = null;
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
      await this.saveToHistory(historyEntry);

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

      this.currentExecution.status = 'completed';
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      this.currentExecution.summary = summary;

      const historyEntry = { ...this.currentExecution };
      await this.saveToHistory(historyEntry);

      const previousExecution = this.currentExecution;
      this.currentExecution = null;

      logger.info('Bulk execution completed', { 
        executionId: previousExecution.id,
        duration: previousExecution.duration,
        totalProducts: previousExecution.totalProducts
      });

      return previousExecution;
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

  async startScraperExecution(saleName, urlsCount, clientMetadata = null) {
    const hostInfo = getHostMetadata();
    const execution = {
      id: `scraper_${Date.now()}`,
      type: 'sale_scraper',
      saleName,
      status: 'running',
      startTime: new Date().toISOString(),
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
      this.currentExecution.status = status; // 'completed' or 'failed'
      this.currentExecution.endTime = new Date().toISOString();
      this.currentExecution.duration = Date.now() - new Date(this.currentExecution.startTime).getTime();
      this.currentExecution.summary = summary;
      this.currentExecution.logs.push(`[INFO] Scraper finished with status: ${status}. Extracted banners: ${this.currentExecution.extractedBanners}.`);
      
      const historyEntry = { ...this.currentExecution };
      await this.saveToHistory(historyEntry);
      
      logger.info('Scraper execution completed', { id: historyEntry.id, status });
      this.currentExecution = null;
    }
  }
}

const executionTracker = new ExecutionTracker();

module.exports = { executionTracker };
