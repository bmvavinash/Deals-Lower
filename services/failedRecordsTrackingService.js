const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('failedRecordsTrackingService');

class FailedRecordsTrackingService {
  constructor() {
    this.failedRecords = {
      bulkUpdates: [],
      individualUpdates: [],
      notifications: [],
      databaseOperations: []
    };
    
    this.failedRecordsFile = path.join(__dirname, '../logs/failed_records.json');
    this.ensureLogDirectory();
    this.loadFailedRecords();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.failedRecordsFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Track failed bulk update records
  trackBulkUpdateFailure(platform, category, targetDb, sourceType, products, error, context = {}) {
    const failure = {
      id: this.generateFailureId(),
      timestamp: new Date().toISOString(),
      type: 'bulk_update',
      platform,
      category,
      targetDb,
      sourceType,
      productCount: products.length,
      products: products.map(p => ({
        productCode: p.productCode || p.id || p.asin,
        productUrl: p.productUrl,
        title: p.title,
        brand: p.brand,
        price: p.price,
        error: 'Bulk update failed'
      })),
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      status: 'pending_retry'
    };

    this.failedRecords.bulkUpdates.push(failure);
    this.saveFailedRecords();
    
    logger.error('📝 Tracked bulk update failure', {
      failureId: failure.id,
      platform,
      category,
      productCount: products.length,
      error: error.message
    });

    return failure.id;
  }

  // Track failed individual product updates
  trackIndividualUpdateFailure(productCode, targetDb, updates, error, context = {}) {
    const failure = {
      id: this.generateFailureId(),
      timestamp: new Date().toISOString(),
      type: 'individual_update',
      productCode,
      targetDb,
      updates,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      status: 'pending_retry'
    };

    this.failedRecords.individualUpdates.push(failure);
    this.saveFailedRecords();
    
    logger.error('📝 Tracked individual update failure', {
      failureId: failure.id,
      productCode,
      targetDb,
      error: error.message
    });

    return failure.id;
  }

  // Track failed notifications
  trackNotificationFailure(userId, notificationType, message, error, context = {}) {
    const failure = {
      id: this.generateFailureId(),
      timestamp: new Date().toISOString(),
      type: 'notification',
      userId,
      notificationType,
      message: message.slice(0, 200), // Truncate for storage
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      status: 'pending_retry'
    };

    this.failedRecords.notifications.push(failure);
    this.saveFailedRecords();
    
    logger.error('📝 Tracked notification failure', {
      failureId: failure.id,
      userId,
      notificationType,
      error: error.message
    });

    return failure.id;
  }

  // Track failed database operations
  trackDatabaseOperationFailure(operation, targetDb, data, error, context = {}) {
    const failure = {
      id: this.generateFailureId(),
      timestamp: new Date().toISOString(),
      type: 'database_operation',
      operation,
      targetDb,
      dataSize: JSON.stringify(data).length,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      status: 'pending_retry'
    };

    this.failedRecords.databaseOperations.push(failure);
    this.saveFailedRecords();
    
    logger.error('📝 Tracked database operation failure', {
      failureId: failure.id,
      operation,
      targetDb,
      error: error.message
    });

    return failure.id;
  }

  // Mark failure as resolved
  markFailureResolved(failureId, resolution = 'retry_successful') {
    let found = false;
    
    // Search in all failure types
    for (const [type, failures] of Object.entries(this.failedRecords)) {
      const failure = failures.find(f => f.id === failureId);
      if (failure) {
        failure.status = 'resolved';
        failure.resolvedAt = new Date().toISOString();
        failure.resolution = resolution;
        found = true;
        break;
      }
    }

    if (found) {
      this.saveFailedRecords();
      logger.info('✅ Marked failure as resolved', { failureId, resolution });
    } else {
      logger.warn('⚠️ Failure not found', { failureId });
    }

    return found;
  }

  // Get failed records by type and status
  getFailedRecords(type = 'all', status = 'all') {
    if (type === 'all') {
      const allFailures = [];
      for (const [failureType, failures] of Object.entries(this.failedRecords)) {
        allFailures.push(...failures.map(f => ({ ...f, failureType })));
      }
      return status === 'all' ? allFailures : allFailures.filter(f => f.status === status);
    }

    const failures = this.failedRecords[type] || [];
    return status === 'all' ? failures : failures.filter(f => f.status === status);
  }

  // Get failure statistics
  getFailureStatistics() {
    const stats = {
      total: 0,
      byType: {},
      byStatus: {},
      byPlatform: {},
      byTargetDb: {},
      recentFailures: 0
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [type, failures] of Object.entries(this.failedRecords)) {
      stats.byType[type] = failures.length;
      stats.total += failures.length;

      failures.forEach(failure => {
        // By status
        stats.byStatus[failure.status] = (stats.byStatus[failure.status] || 0) + 1;

        // By platform (for bulk updates)
        if (failure.platform) {
          stats.byPlatform[failure.platform] = (stats.byPlatform[failure.platform] || 0) + 1;
        }

        // By target database
        if (failure.targetDb) {
          stats.byTargetDb[failure.targetDb] = (stats.byTargetDb[failure.targetDb] || 0) + 1;
        }

        // Recent failures
        if (new Date(failure.timestamp) > oneDayAgo) {
          stats.recentFailures++;
        }
      });
    }

    return stats;
  }

  // Retry failed records
  async retryFailedRecords(type = 'all', maxRetries = 5) {
    const failures = this.getFailedRecords(type, 'pending_retry');
    const retryResults = {
      attempted: 0,
      successful: 0,
      failed: 0,
      results: []
    };

    logger.info(`🔄 Starting retry of ${failures.length} failed records`, { type, maxRetries });

    for (const failure of failures) {
      if (retryResults.attempted >= maxRetries) break;

      try {
        retryResults.attempted++;
        
        let success = false;
        
        switch (failure.type) {
          case 'bulk_update':
            success = await this.retryBulkUpdate(failure);
            break;
          case 'individual_update':
            success = await this.retryIndividualUpdate(failure);
            break;
          case 'notification':
            success = await this.retryNotification(failure);
            break;
          case 'database_operation':
            success = await this.retryDatabaseOperation(failure);
            break;
        }

        if (success) {
          retryResults.successful++;
          this.markFailureResolved(failure.id, 'retry_successful');
          retryResults.results.push({ failureId: failure.id, status: 'success' });
        } else {
          retryResults.failed++;
          retryResults.results.push({ failureId: failure.id, status: 'failed' });
        }

      } catch (error) {
        retryResults.failed++;
        retryResults.results.push({ 
          failureId: failure.id, 
          status: 'error', 
          error: error.message 
        });
        logger.error('❌ Retry failed', { failureId: failure.id, error: error.message });
      }
    }

    logger.info('🔄 Retry completed', retryResults);
    return retryResults;
  }

  // Retry specific failure types
  async retryBulkUpdate(failure) {
    try {
      const result = await productDealsDB.bulkUpsertProducts(failure.products, failure.targetDb);
      return result.status === 200;
    } catch (error) {
      logger.error('❌ Bulk update retry failed', { failureId: failure.id, error: error.message });
      return false;
    }
  }

  async retryIndividualUpdate(failure) {
    try {
      const result = await productDealsDB.updateIndividualProduct(
        failure.productCode, 
        failure.updates, 
        failure.targetDb
      );
      return result.status === 200;
    } catch (error) {
      logger.error('❌ Individual update retry failed', { failureId: failure.id, error: error.message });
      return false;
    }
  }

  async retryNotification(failure) {
    // This would integrate with the notification service
    // For now, just mark as resolved
    logger.info('📱 Notification retry (placeholder)', { failureId: failure.id });
    return true;
  }

  async retryDatabaseOperation(failure) {
    // This would retry the specific database operation
    // For now, just mark as resolved
    logger.info('💾 Database operation retry (placeholder)', { failureId: failure.id });
    return true;
  }

  // Generate unique failure ID
  generateFailureId() {
    return `FAIL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save failed records to file
  saveFailedRecords() {
    try {
      fs.writeFileSync(this.failedRecordsFile, JSON.stringify(this.failedRecords, null, 2));
    } catch (error) {
      logger.error('❌ Error saving failed records', { error: error.message });
    }
  }

  // Load failed records from file
  loadFailedRecords() {
    try {
      if (fs.existsSync(this.failedRecordsFile)) {
        const data = fs.readFileSync(this.failedRecordsFile, 'utf8');
        this.failedRecords = JSON.parse(data);
        logger.info('📂 Loaded failed records from file', { 
          total: Object.values(this.failedRecords).flat().length 
        });
      }
    } catch (error) {
      logger.error('❌ Error loading failed records', { error: error.message });
    }
  }

  // Export failed records for analysis
  exportFailedRecords(format = 'json') {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const exportFile = path.join(__dirname, `../logs/failed_records_export_${timestamp}.${format}`);
      
      if (format === 'json') {
        fs.writeFileSync(exportFile, JSON.stringify(this.failedRecords, null, 2));
      } else if (format === 'csv') {
        const csv = this.convertToCSV();
        fs.writeFileSync(exportFile, csv);
      }

      logger.info('📤 Exported failed records', { format, file: exportFile });
      return exportFile;
    } catch (error) {
      logger.error('❌ Error exporting failed records', { error: error.message });
      return null;
    }
  }

  // Convert failed records to CSV format
  convertToCSV() {
    const headers = [
      'ID', 'Timestamp', 'Type', 'Status', 'Platform', 'Category', 'TargetDB', 
      'ProductCount', 'Error', 'Context'
    ];
    
    const rows = [headers.join(',')];
    
    for (const [type, failures] of Object.entries(this.failedRecords)) {
      failures.forEach(failure => {
        const row = [
          failure.id,
          failure.timestamp,
          failure.type,
          failure.status,
          failure.platform || '',
          failure.category || '',
          failure.targetDb || '',
          failure.productCount || '',
          `"${failure.error.message.replace(/"/g, '""')}"`,
          `"${JSON.stringify(failure.context).replace(/"/g, '""')}"`
        ];
        rows.push(row.join(','));
      });
    }
    
    return rows.join('\n');
  }
}

const failedRecordsTrackingService = new FailedRecordsTrackingService();
module.exports = { failedRecordsTrackingService };


