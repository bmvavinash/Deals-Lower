const { failedRecordsTrackingService } = require('../services/failedRecordsTrackingService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('failedRecordsManager');

class FailedRecordsManager {
  constructor() {
    this.service = failedRecordsTrackingService;
  }

  // Display failed records summary
  displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FAILED RECORDS MANAGEMENT');
    console.log('='.repeat(80));
    
    const stats = this.service.getFailureStatistics();
    
    console.log(`\n📊 OVERALL STATISTICS`);
    console.log('-'.repeat(40));
    console.log(`Total Failures: ${stats.total}`);
    console.log(`Recent Failures (24h): ${stats.recentFailures}`);
    
    if (stats.byType) {
      console.log(`\n📋 BY TYPE`);
      console.log('-'.repeat(40));
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} failures`);
      });
    }
    
    if (stats.byStatus) {
      console.log(`\n📊 BY STATUS`);
      console.log('-'.repeat(40));
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} failures`);
      });
    }
    
    if (stats.byPlatform) {
      console.log(`\n🏪 BY PLATFORM`);
      console.log('-'.repeat(40));
      Object.entries(stats.byPlatform).forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} failures`);
      });
    }
    
    if (stats.byTargetDb) {
      console.log(`\n💾 BY DATABASE`);
      console.log('-'.repeat(40));
      Object.entries(stats.byTargetDb).forEach(([db, count]) => {
        console.log(`   ${db}: ${count} failures`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }

  // List failed records with filters
  listFailedRecords(type = 'all', status = 'all', limit = 20) {
    console.log(`\n🔍 FAILED RECORDS LIST (${type}/${status})`);
    console.log('-'.repeat(60));
    
    const failures = this.service.getFailedRecords(type, status);
    const displayFailures = failures.slice(0, limit);
    
    if (displayFailures.length === 0) {
      console.log('✅ No failed records found with the specified criteria.');
      return;
    }
    
    displayFailures.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.type.toUpperCase()} - ${failure.id}`);
      console.log(`   Time: ${failure.timestamp}`);
      console.log(`   Status: ${failure.status}`);
      
      if (failure.platform) {
        console.log(`   Platform: ${failure.platform}`);
      }
      if (failure.category) {
        console.log(`   Category: ${failure.category}`);
      }
      if (failure.targetDb) {
        console.log(`   Database: ${failure.targetDb}`);
      }
      if (failure.productCode) {
        console.log(`   Product: ${failure.productCode}`);
      }
      if (failure.userId) {
        console.log(`   User: ${failure.userId}`);
      }
      if (failure.notificationType) {
        console.log(`   Notification: ${failure.notificationType}`);
      }
      
      console.log(`   Error: ${failure.error.message}`);
      
      if (failure.productCount) {
        console.log(`   Products: ${failure.productCount}`);
      }
    });
    
    if (failures.length > limit) {
      console.log(`\n... and ${failures.length - limit} more failures`);
    }
    
    console.log(`\nTotal: ${failures.length} failures`);
  }

  // Show detailed failure information
  showFailureDetails(failureId) {
    console.log(`\n🔍 FAILURE DETAILS: ${failureId}`);
    console.log('-'.repeat(60));
    
    const failures = this.service.getFailedRecords('all', 'all');
    const failure = failures.find(f => f.id === failureId);
    
    if (!failure) {
      console.log('❌ Failure not found');
      return;
    }
    
    console.log(`ID: ${failure.id}`);
    console.log(`Type: ${failure.type}`);
    console.log(`Timestamp: ${failure.timestamp}`);
    console.log(`Status: ${failure.status}`);
    
    if (failure.platform) console.log(`Platform: ${failure.platform}`);
    if (failure.category) console.log(`Category: ${failure.category}`);
    if (failure.targetDb) console.log(`Target Database: ${failure.targetDb}`);
    if (failure.sourceType) console.log(`Source Type: ${failure.sourceType}`);
    if (failure.productCode) console.log(`Product Code: ${failure.productCode}`);
    if (failure.userId) console.log(`User ID: ${failure.userId}`);
    if (failure.notificationType) console.log(`Notification Type: ${failure.notificationType}`);
    if (failure.productCount) console.log(`Product Count: ${failure.productCount}`);
    
    console.log(`\nError Details:`);
    console.log(`Message: ${failure.error.message}`);
    console.log(`Code: ${failure.error.code || 'N/A'}`);
    
    if (failure.error.stack) {
      console.log(`\nStack Trace:`);
      console.log(failure.error.stack);
    }
    
    if (failure.context && Object.keys(failure.context).length > 0) {
      console.log(`\nContext:`);
      console.log(JSON.stringify(failure.context, null, 2));
    }
    
    if (failure.products && failure.products.length > 0) {
      console.log(`\nFailed Products (${failure.products.length}):`);
      failure.products.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.productCode} - ${product.title || 'No title'}`);
      });
      if (failure.products.length > 5) {
        console.log(`   ... and ${failure.products.length - 5} more products`);
      }
    }
    
    if (failure.resolvedAt) {
      console.log(`\nResolution:`);
      console.log(`Resolved At: ${failure.resolvedAt}`);
      console.log(`Resolution: ${failure.resolution}`);
    }
  }

  // Retry failed records
  async retryFailedRecords(type = 'all', maxRetries = 5) {
    console.log(`\n🔄 RETRYING FAILED RECORDS`);
    console.log('-'.repeat(40));
    console.log(`Type: ${type}`);
    console.log(`Max Retries: ${maxRetries}`);
    
    const result = await this.service.retryFailedRecords(type, maxRetries);
    
    console.log(`\n📊 RETRY RESULTS`);
    console.log('-'.repeat(40));
    console.log(`Attempted: ${result.attempted}`);
    console.log(`Successful: ${result.successful}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Success Rate: ${result.attempted > 0 ? ((result.successful / result.attempted) * 100).toFixed(2) : 0}%`);
    
    if (result.results && result.results.length > 0) {
      console.log(`\n📋 DETAILED RESULTS`);
      console.log('-'.repeat(40));
      result.results.forEach((res, index) => {
        const status = res.status === 'success' ? '✅' : res.status === 'failed' ? '❌' : '⚠️';
        console.log(`${index + 1}. ${status} ${res.failureId} - ${res.status}`);
        if (res.error) {
          console.log(`   Error: ${res.error}`);
        }
      });
    }
  }

  // Mark failure as resolved
  markAsResolved(failureId, resolution = 'manual_resolution') {
    console.log(`\n✅ MARKING FAILURE AS RESOLVED`);
    console.log('-'.repeat(40));
    console.log(`Failure ID: ${failureId}`);
    console.log(`Resolution: ${resolution}`);
    
    const success = this.service.markFailureResolved(failureId, resolution);
    
    if (success) {
      console.log('✅ Failure marked as resolved successfully');
    } else {
      console.log('❌ Failure not found or could not be marked as resolved');
    }
  }

  // Export failed records
  exportFailedRecords(format = 'json') {
    console.log(`\n📤 EXPORTING FAILED RECORDS`);
    console.log('-'.repeat(40));
    console.log(`Format: ${format.toUpperCase()}`);
    
    const exportFile = this.service.exportFailedRecords(format);
    
    if (exportFile) {
      console.log(`✅ Failed records exported to: ${exportFile}`);
    } else {
      console.log('❌ Failed to export failed records');
    }
  }

  // Show help
  showHelp() {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FAILED RECORDS MANAGER - HELP');
    console.log('='.repeat(80));
    
    console.log('\n📋 AVAILABLE COMMANDS:');
    console.log('-'.repeat(40));
    console.log('node scripts/failedRecordsManager.js summary');
    console.log('node scripts/failedRecordsManager.js list [type] [status] [limit]');
    console.log('node scripts/failedRecordsManager.js details <failureId>');
    console.log('node scripts/failedRecordsManager.js retry [type] [maxRetries]');
    console.log('node scripts/failedRecordsManager.js resolve <failureId> [resolution]');
    console.log('node scripts/failedRecordsManager.js export [format]');
    
    console.log('\n📝 PARAMETERS:');
    console.log('-'.repeat(40));
    console.log('type: all, bulk_update, individual_update, notification, database_operation');
    console.log('status: all, pending_retry, resolved');
    console.log('limit: number of records to display (default: 20)');
    console.log('maxRetries: maximum number of retries (default: 5)');
    console.log('format: json, csv (default: json)');
    console.log('resolution: manual_resolution, retry_successful, etc.');
    
    console.log('\n💡 EXAMPLES:');
    console.log('-'.repeat(40));
    console.log('node scripts/failedRecordsManager.js summary');
    console.log('node scripts/failedRecordsManager.js list bulk_update pending_retry 10');
    console.log('node scripts/failedRecordsManager.js details FAIL_1234567890_abc123');
    console.log('node scripts/failedRecordsManager.js retry bulk_update 3');
    console.log('node scripts/failedRecordsManager.js resolve FAIL_1234567890_abc123 manual_fix');
    console.log('node scripts/failedRecordsManager.js export csv');
    
    console.log('\n' + '='.repeat(80));
  }
}

async function main() {
  try {
    const manager = new FailedRecordsManager();
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help') {
      manager.showHelp();
      return;
    }
    
    const command = args[0];
    
    switch (command) {
      case 'summary':
        manager.displaySummary();
        break;
        
      case 'list':
        const type = args[1] || 'all';
        const status = args[2] || 'all';
        const limit = parseInt(args[3]) || 20;
        manager.listFailedRecords(type, status, limit);
        break;
        
      case 'details':
        const failureId = args[1];
        if (!failureId) {
          console.log('❌ Please provide a failure ID');
          return;
        }
        manager.showFailureDetails(failureId);
        break;
        
      case 'retry':
        const retryType = args[1] || 'all';
        const maxRetries = parseInt(args[2]) || 5;
        await manager.retryFailedRecords(retryType, maxRetries);
        break;
        
      case 'resolve':
        const resolveFailureId = args[1];
        const resolution = args[2] || 'manual_resolution';
        if (!resolveFailureId) {
          console.log('❌ Please provide a failure ID');
          return;
        }
        manager.markAsResolved(resolveFailureId, resolution);
        break;
        
      case 'export':
        const format = args[1] || 'json';
        manager.exportFailedRecords(format);
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        manager.showHelp();
    }
    
  } catch (error) {
    console.error('❌ Failed records manager error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { FailedRecordsManager };


