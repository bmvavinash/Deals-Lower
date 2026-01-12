const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { failedRecordsTrackingService } = require('./failedRecordsTrackingService');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('comprehensiveLoggingService');

class ComprehensiveLoggingService {
  constructor() {
    this.stats = {
      bulkUpdates: {
        totalProducts: 0,
        created: 0,
        updated: 0,
        failed: 0,
        platforms: {},
        categories: {},
        databases: {},
        timings: []
      },
      favorites: {
        totalUsers: 0,
        totalFavorites: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
        priceTracking: 0,
        lowStock: 0,
        dealExpiry: 0,
        timings: []
      },
      idleProcessing: {
        productdealsProcessed: 0,
        dealsProcessed: 0,
        enrichmentSuccess: 0,
        enrichmentFailed: 0,
        created: 0,
        updated: 0,
        timings: []
      },
      databaseOperations: {
        reads: 0,
        writes: 0,
        updates: 0,
        created: 0,
        errors: 0,
        timings: []
      }
    };
    
    this.logFile = path.join(__dirname, '../logs/comprehensive_stats.json');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Bulk Update Logging
  logBulkUpdateStart(platform, category, targetDb, sourceType) {
    const startTime = Date.now();
    logger.info('🚀 Bulk Update Started', {
      platform,
      category,
      targetDb,
      sourceType,
      startTime: new Date().toISOString()
    });
    return startTime;
  }

  logBulkUpdateComplete(platform, category, targetDb, sourceType, startTime, productsCount, successCount, errorCount, createdCount = 0, updatedCount = 0) {
    const duration = Date.now() - startTime;
    
    // Ensure stats objects exist (defensive programming)
    if (!this.stats || !this.stats.bulkUpdates) {
      logger.warn('Stats object not initialized, reinitializing', { platform, category });
      this.stats = {
        bulkUpdates: {
          totalProducts: 0,
          created: 0,
          updated: 0,
          failed: 0,
          platforms: {},
          categories: {},
          databases: {},
          timings: []
        }
      };
    }
    
    // Ensure nested objects exist
    if (!this.stats.bulkUpdates.platforms) this.stats.bulkUpdates.platforms = {};
    if (!this.stats.bulkUpdates.categories) this.stats.bulkUpdates.categories = {};
    if (!this.stats.bulkUpdates.databases) this.stats.bulkUpdates.databases = {};
    if (!this.stats.bulkUpdates.timings) this.stats.bulkUpdates.timings = [];
    
    // Update stats
    this.stats.bulkUpdates.totalProducts += productsCount;
    this.stats.bulkUpdates.created += createdCount;
    this.stats.bulkUpdates.updated += updatedCount;
    this.stats.bulkUpdates.failed += errorCount;
    this.stats.bulkUpdates.platforms[platform] = (this.stats.bulkUpdates.platforms[platform] || 0) + productsCount;
    this.stats.bulkUpdates.categories[category] = (this.stats.bulkUpdates.categories[category] || 0) + productsCount;
    this.stats.bulkUpdates.databases[targetDb] = (this.stats.bulkUpdates.databases[targetDb] || 0) + productsCount;
    this.stats.bulkUpdates.timings.push({
      platform,
      category,
      targetDb,
      duration,
      productsCount,
      successCount,
      errorCount,
      createdCount,
      updatedCount,
      timestamp: new Date().toISOString()
    });

    logger.info('✅ Bulk Update Completed', {
      platform,
      category,
      targetDb,
      sourceType,
      duration: `${duration}ms`,
      productsCount,
      successCount,
      errorCount,
      createdCount,
      updatedCount,
      successRate: `${((successCount / productsCount) * 100).toFixed(2)}%`,
      createdRate: `${((createdCount / productsCount) * 100).toFixed(2)}%`,
      updatedRate: `${((updatedCount / productsCount) * 100).toFixed(2)}%`
    });

    this.saveStats();
  }

  // Favorites Logging
  logFavoritesProcessingStart() {
    const startTime = Date.now();
    logger.info('❤️ Favorites Processing Started', {
      startTime: new Date().toISOString()
    });
    return startTime;
  }

  logFavoritesProcessingComplete(startTime, usersCount, favoritesCount, notificationsSent, priceTracking, lowStock, dealExpiry) {
    const duration = Date.now() - startTime;
    
    // Update stats
    this.stats.favorites.totalUsers += usersCount;
    this.stats.favorites.totalFavorites += favoritesCount;
    this.stats.favorites.notificationsSent += notificationsSent;
    this.stats.favorites.priceTracking += priceTracking;
    this.stats.favorites.lowStock += lowStock;
    this.stats.favorites.dealExpiry += dealExpiry;
    this.stats.favorites.timings.push({
      duration,
      usersCount,
      favoritesCount,
      notificationsSent,
      priceTracking,
      lowStock,
      dealExpiry,
      timestamp: new Date().toISOString()
    });

    logger.info('✅ Favorites Processing Completed', {
      duration: `${duration}ms`,
      usersCount,
      favoritesCount,
      notificationsSent,
      priceTracking,
      lowStock,
      dealExpiry,
      avgTimePerUser: `${(duration / usersCount).toFixed(2)}ms`
    });

    this.saveStats();
  }

  // Idle Processing Logging
  logIdleProcessingStart(targetDb) {
    const startTime = Date.now();
    logger.info('⏳ Idle Processing Started', {
      targetDb,
      startTime: new Date().toISOString()
    });
    return startTime;
  }

  logIdleProcessingComplete(targetDb, startTime, processedCount, successCount, failedCount) {
    const duration = Date.now() - startTime;
    
    // Update stats
    if (targetDb === 'productdeals') {
      this.stats.idleProcessing.productdealsProcessed += processedCount;
    } else {
      this.stats.idleProcessing.dealsProcessed += processedCount;
    }
    this.stats.idleProcessing.enrichmentSuccess += successCount;
    this.stats.idleProcessing.enrichmentFailed += failedCount;
    this.stats.idleProcessing.timings.push({
      targetDb,
      duration,
      processedCount,
      successCount,
      failedCount,
      timestamp: new Date().toISOString()
    });

    logger.info('✅ Idle Processing Completed', {
      targetDb,
      duration: `${duration}ms`,
      processedCount,
      successCount,
      failedCount,
      successRate: `${((successCount / processedCount) * 100).toFixed(2)}%`
    });

    this.saveStats();
  }

  // Database Operations Logging
  logDatabaseOperation(operation, targetDb, duration, success = true, error = null) {
    // Update stats
    if (success) {
      this.stats.databaseOperations[operation]++;
    } else {
      this.stats.databaseOperations.errors++;
    }
    
    this.stats.databaseOperations.timings.push({
      operation,
      targetDb,
      duration,
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });

    if (success) {
      logger.debug(`📊 Database ${operation}`, {
        targetDb,
        duration: `${duration}ms`
      });
    } else {
      logger.error(`❌ Database ${operation} failed`, {
        targetDb,
        duration: `${duration}ms`,
        error: error?.message
      });
    }
  }

  // Deal Expiry Logging
  logDealExpiryProcessing(startTime, productsWithTimers, expiringSoon, notificationsSent) {
    const duration = Date.now() - startTime;
    
    logger.info('⏰ Deal Expiry Processing Completed', {
      duration: `${duration}ms`,
      productsWithTimers,
      expiringSoon,
      notificationsSent,
      expiringRate: `${((expiringSoon / productsWithTimers) * 100).toFixed(2)}%`
    });
  }

  // Generate comprehensive report
  generateComprehensiveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBulkProducts: this.stats.bulkUpdates.totalProducts,
        totalUsers: this.stats.favorites.totalUsers,
        totalFavorites: this.stats.favorites.totalFavorites,
        totalNotifications: this.stats.favorites.notificationsSent,
        totalIdleProcessed: this.stats.idleProcessing.productdealsProcessed + this.stats.idleProcessing.dealsProcessed,
        totalDatabaseOperations: this.stats.databaseOperations.reads + this.stats.databaseOperations.writes + this.stats.databaseOperations.updates
      },
      bulkUpdates: {
        byPlatform: this.stats.bulkUpdates.platforms,
        byCategory: this.stats.bulkUpdates.categories,
        byDatabase: this.stats.bulkUpdates.databases,
        recentTimings: this.stats.bulkUpdates.timings.slice(-10)
      },
      favorites: {
        totalUsers: this.stats.favorites.totalUsers,
        totalFavorites: this.stats.favorites.totalFavorites,
        notificationsByType: {
          priceTracking: this.stats.favorites.priceTracking,
          lowStock: this.stats.favorites.lowStock,
          dealExpiry: this.stats.favorites.dealExpiry
        },
        recentTimings: this.stats.favorites.timings.slice(-10)
      },
      idleProcessing: {
        productdealsProcessed: this.stats.idleProcessing.productdealsProcessed,
        dealsProcessed: this.stats.idleProcessing.dealsProcessed,
        enrichmentSuccess: this.stats.idleProcessing.enrichmentSuccess,
        enrichmentFailed: this.stats.idleProcessing.enrichmentFailed,
        successRate: this.calculateSuccessRate(),
        recentTimings: this.stats.idleProcessing.timings.slice(-10)
      },
      databaseOperations: {
        reads: this.stats.databaseOperations.reads,
        writes: this.stats.databaseOperations.writes,
        updates: this.stats.databaseOperations.updates,
        errors: this.stats.databaseOperations.errors,
        errorRate: this.calculateErrorRate(),
        recentTimings: this.stats.databaseOperations.timings.slice(-20)
      }
    };

    return report;
  }

  calculateSuccessRate() {
    const total = this.stats.idleProcessing.enrichmentSuccess + this.stats.idleProcessing.enrichmentFailed;
    return total > 0 ? ((this.stats.idleProcessing.enrichmentSuccess / total) * 100).toFixed(2) : '0.00';
  }

  calculateErrorRate() {
    const total = this.stats.databaseOperations.reads + this.stats.databaseOperations.writes + this.stats.databaseOperations.updates + this.stats.databaseOperations.errors;
    return total > 0 ? ((this.stats.databaseOperations.errors / total) * 100).toFixed(2) : '0.00';
  }

  // Save stats to file
  saveStats() {
    try {
      const report = this.generateComprehensiveReport();
      fs.writeFileSync(this.logFile, JSON.stringify(report, null, 2));
    } catch (error) {
      logger.error('Error saving comprehensive stats', { error: error.message });
    }
  }

  // Load stats from file
  loadStats() {
    try {
      if (fs.existsSync(this.logFile)) {
        const data = fs.readFileSync(this.logFile, 'utf8');
        const report = JSON.parse(data);
        
        // Restore stats from the report
        this.stats.bulkUpdates.totalProducts = report.summary.totalBulkProducts || 0;
        this.stats.favorites.totalUsers = report.summary.totalUsers || 0;
        this.stats.favorites.totalFavorites = report.summary.totalFavorites || 0;
        this.stats.favorites.notificationsSent = report.summary.totalNotifications || 0;
        
        logger.info('📊 Comprehensive stats loaded from file');
      }
    } catch (error) {
      logger.error('Error loading comprehensive stats', { error: error.message });
    }
  }

  // Get real-time stats
  getRealTimeStats() {
    return {
      current: this.stats,
      report: this.generateComprehensiveReport()
    };
  }

  // Track failed records
  trackFailedBulkUpdate(platform, category, targetDb, sourceType, products, error) {
    const failureId = failedRecordsTrackingService.trackBulkUpdateFailure(
      platform, category, targetDb, sourceType, products, error
    );
    
    this.stats.bulkUpdates.failed += products.length;
    logger.error('📝 Tracked failed bulk update', { failureId, productCount: products.length });
    
    return failureId;
  }

  trackFailedIndividualUpdate(productCode, targetDb, updates, error) {
    const failureId = failedRecordsTrackingService.trackIndividualUpdateFailure(
      productCode, targetDb, updates, error
    );
    
    this.stats.idleProcessing.enrichmentFailed++;
    logger.error('📝 Tracked failed individual update', { failureId, productCode });
    
    return failureId;
  }

  trackFailedNotification(userId, notificationType, message, error) {
    const failureId = failedRecordsTrackingService.trackNotificationFailure(
      userId, notificationType, message, error
    );
    
    this.stats.favorites.notificationsFailed++;
    logger.error('📝 Tracked failed notification', { failureId, userId, notificationType });
    
    return failureId;
  }

  // Get failed records summary
  getFailedRecordsSummary() {
    const failureStats = failedRecordsTrackingService.getFailureStatistics();
    const pendingFailures = failedRecordsTrackingService.getFailedRecords('all', 'pending_retry');
    
    return {
      totalFailures: failureStats.total,
      pendingRetries: pendingFailures.length,
      recentFailures: failureStats.recentFailures,
      byType: failureStats.byType,
      byStatus: failureStats.byStatus,
      byPlatform: failureStats.byPlatform,
      byTargetDb: failureStats.byTargetDb
    };
  }

  // Log system health
  logSystemHealth() {
    const report = this.generateComprehensiveReport();
    const failedRecordsSummary = this.getFailedRecordsSummary();
    
    logger.info('🏥 System Health Report', {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      bulkUpdates: {
        totalProducts: report.summary.totalBulkProducts,
        created: this.stats.bulkUpdates.created,
        updated: this.stats.bulkUpdates.updated,
        failed: this.stats.bulkUpdates.failed,
        platforms: Object.keys(report.bulkUpdates.byPlatform).length,
        categories: Object.keys(report.bulkUpdates.byCategory).length
      },
      favorites: {
        totalUsers: report.summary.totalUsers,
        totalFavorites: report.summary.totalFavorites,
        notificationsSent: report.summary.totalNotifications,
        notificationsFailed: this.stats.favorites.notificationsFailed
      },
      idleProcessing: {
        totalProcessed: report.summary.totalIdleProcessed,
        created: this.stats.idleProcessing.created,
        updated: this.stats.idleProcessing.updated,
        successRate: report.idleProcessing.successRate + '%'
      },
      databaseOperations: {
        totalOperations: report.summary.totalDatabaseOperations,
        created: this.stats.databaseOperations.created,
        errorRate: report.databaseOperations.errorRate + '%'
      },
      failedRecords: failedRecordsSummary
    });
  }
}

const comprehensiveLoggingService = new ComprehensiveLoggingService();
module.exports = { comprehensiveLoggingService };
