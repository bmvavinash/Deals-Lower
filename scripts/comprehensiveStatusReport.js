const { comprehensiveLoggingService } = require('../services/comprehensiveLoggingService');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { failedRecordsTrackingService } = require('../services/failedRecordsTrackingService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('comprehensiveStatusReport');

class ComprehensiveStatusReport {
  constructor() {
    this.report = null;
  }

  async generateFullReport() {
    try {
      logger.info('📊 Generating comprehensive status report...');

      // Load existing stats
      comprehensiveLoggingService.loadStats();
      
      // Get current database stats
      const databaseStats = await this.getDatabaseStats();
      
      // Get current user stats
      const userStats = await this.getUserStats();
      
      // Get comprehensive logging stats
      const loggingStats = comprehensiveLoggingService.getRealTimeStats();
      
      // Get failed records summary
      const failedRecordsSummary = comprehensiveLoggingService.getFailedRecordsSummary();
      
      // Get detailed failed records
      const failedRecords = failedRecordsTrackingService.getFailedRecords('all', 'all');
      
      // Combine all stats
      this.report = {
        timestamp: new Date().toISOString(),
        systemHealth: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform
        },
        databaseStats,
        userStats,
        loggingStats: loggingStats.report,
        failedRecordsSummary,
        failedRecords: failedRecords.slice(0, 50), // Show last 50 failed records
        summary: this.generateSummary(databaseStats, userStats, loggingStats.report, failedRecordsSummary)
      };

      // Save the report
      this.saveReport();
      
      // Display the report
      this.displayReport();
      
      return this.report;
      
    } catch (error) {
      logger.error('❌ Error generating comprehensive status report', { error: error.message });
      throw error;
    }
  }

  async getDatabaseStats() {
    try {
      logger.info('📊 Fetching database statistics...');
      
      // Get productdeals stats
      const productdealsSnapshot = await productDealsDB.productdealsRef.once('value');
      const productdealsData = productdealsSnapshot.val() || {};
      const productdealsCount = Object.keys(productdealsData).length;
      
      // Get deals stats
      const dealsSnapshot = await productDealsDB.dealsRef.once('value');
      const dealsData = dealsSnapshot.val() || {};
      const dealsCount = Object.keys(dealsData).length;
      
      // Analyze productdeals by platform and category
      const productdealsAnalysis = this.analyzeProducts(productdealsData);
      
      // Analyze deals by platform and category
      const dealsAnalysis = this.analyzeProducts(dealsData);
      
      return {
        productdeals: {
          totalProducts: productdealsCount,
          analysis: productdealsAnalysis
        },
        deals: {
          totalProducts: dealsCount,
          analysis: dealsAnalysis
        },
        totalProducts: productdealsCount + dealsCount
      };
      
    } catch (error) {
      logger.error('❌ Error fetching database stats', { error: error.message });
      return { error: error.message };
    }
  }

  async getUserStats() {
    try {
      logger.info('👥 Fetching user statistics...');
      
      // Get users data using the userFavoritesDB methods
      const usersData = await userFavoritesDB.getAllUsers();
      const users = Object.entries(usersData);
      
      let totalFavorites = 0;
      let totalTrackedProducts = 0;
      let usersWithNotifications = 0;
      let usersWithTelegram = 0;
      let usersWithWhatsapp = 0;
      
      const userAnalysis = {
        byNotificationType: {
          telegram: 0,
          whatsapp: 0,
          push: 0,
          browser: 0
        },
        byPreferences: {
          priceTracking: 0,
          lowStock: 0,
          dealExpiry: 0
        }
      };
      
      // Get favorites and trackers data
      const favoritesData = await userFavoritesDB.getAllFavorites();
      const trackersData = await userFavoritesDB.getAllTrackers();
      
      // Count total favorites and trackers
      totalFavorites = Object.keys(favoritesData).length;
      totalTrackedProducts = Object.keys(trackersData).length;
      
      for (const [uid, userData] of users) {
        const preferences = userData.preferences || {};
        const favorites = userData.favorites || [];
        const trackedProducts = userData.trackedProducts || {};
        
        if (preferences.notifications?.enabled) {
          usersWithNotifications++;
        }
        
        if (preferences.telegram?.chatId) {
          usersWithTelegram++;
          userAnalysis.byNotificationType.telegram++;
        }
        
        if (preferences.whatsapp?.phone) {
          usersWithWhatsapp++;
          userAnalysis.byNotificationType.whatsapp++;
        }
        
        if (preferences.notifications?.channels?.push) {
          userAnalysis.byNotificationType.push++;
        }
        
        if (preferences.notifications?.channels?.browser) {
          userAnalysis.byNotificationType.browser++;
        }
        
        if (preferences.notifications?.priceTracking) {
          userAnalysis.byPreferences.priceTracking++;
        }
        
        if (preferences.notifications?.lowStock) {
          userAnalysis.byPreferences.lowStock++;
        }
        
        if (preferences.notifications?.dealExpiry) {
          userAnalysis.byPreferences.dealExpiry++;
        }
      }
      
      return {
        totalUsers: users.length,
        totalFavorites,
        totalTrackedProducts,
        usersWithNotifications,
        usersWithTelegram,
        usersWithWhatsapp,
        analysis: userAnalysis,
        avgFavoritesPerUser: users.length > 0 ? (totalFavorites / users.length).toFixed(2) : '0.00'
      };
      
    } catch (error) {
      logger.error('❌ Error fetching user stats', { error: error.message });
      return { error: error.message };
    }
  }

  analyzeProducts(productsData) {
    const analysis = {
      byPlatform: {},
      byCategory: {},
      byStoreType: {},
      withDeals: 0,
      withTimers: 0,
      recentlyUpdated: 0,
      missingFields: {
        brand: 0,
        title: 0,
        price: 0,
        description: 0
      }
    };
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [key, product] of Object.entries(productsData)) {
      // Platform analysis
      const platform = product.storeType || 'Unknown';
      analysis.byPlatform[platform] = (analysis.byPlatform[platform] || 0) + 1;
      
      // Category analysis
      const category = product.categoryGroup || product.categoryKey || 'Unknown';
      analysis.byCategory[category] = (analysis.byCategory[category] || 0) + 1;
      
      // Store type analysis
      const storeType = product.storeType || 'Unknown';
      analysis.byStoreType[storeType] = (analysis.byStoreType[storeType] || 0) + 1;
      
      // Deal analysis
      if (product.isDeal || product.deal) {
        analysis.withDeals++;
      }
      
      if (product.timer && product.timer.trim() !== '') {
        analysis.withTimers++;
      }
      
      // Recent updates
      if (product.updatedatetime && product.updatedatetime > oneDayAgo) {
        analysis.recentlyUpdated++;
      }
      
      // Missing fields analysis
      if (!product.brand || product.brand === '') analysis.missingFields.brand++;
      if (!product.title || product.title === '') analysis.missingFields.title++;
      if (!product.price || product.price === '') analysis.missingFields.price++;
      if (!product.description || product.description === '') analysis.missingFields.description++;
    }
    
    return analysis;
  }

  generateSummary(databaseStats, userStats, loggingStats, failedRecordsSummary) {
    return {
      totalProducts: databaseStats.totalProducts || 0,
      totalUsers: userStats.totalUsers || 0,
      totalFavorites: userStats.totalFavorites || 0,
      totalNotifications: loggingStats.summary?.totalNotifications || 0,
      totalBulkProducts: loggingStats.summary?.totalBulkProducts || 0,
      totalIdleProcessed: loggingStats.summary?.totalIdleProcessed || 0,
      totalDatabaseOperations: loggingStats.summary?.totalDatabaseOperations || 0,
      platforms: Object.keys(databaseStats.productdeals?.analysis?.byPlatform || {}).length + 
                Object.keys(databaseStats.deals?.analysis?.byPlatform || {}).length,
      categories: Object.keys(databaseStats.productdeals?.analysis?.byCategory || {}).length + 
                 Object.keys(databaseStats.deals?.analysis?.byCategory || {}).length,
      successRate: loggingStats.idleProcessing?.successRate || '0.00',
      errorRate: loggingStats.databaseOperations?.errorRate || '0.00',
      // Enhanced summary with created/updated/failed
      bulkUpdates: {
        total: loggingStats.summary?.totalBulkProducts || 0,
        created: loggingStats.bulkUpdates?.created || 0,
        updated: loggingStats.bulkUpdates?.updated || 0,
        failed: loggingStats.bulkUpdates?.failed || 0
      },
      idleProcessing: {
        total: loggingStats.summary?.totalIdleProcessed || 0,
        created: loggingStats.idleProcessing?.created || 0,
        updated: loggingStats.idleProcessing?.updated || 0,
        failed: loggingStats.idleProcessing?.enrichmentFailed || 0
      },
      notifications: {
        sent: loggingStats.summary?.totalNotifications || 0,
        failed: loggingStats.favorites?.notificationsFailed || 0
      },
      failedRecords: {
        total: failedRecordsSummary.totalFailures || 0,
        pending: failedRecordsSummary.pendingRetries || 0,
        recent: failedRecordsSummary.recentFailures || 0
      }
    };
  }

  displayReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE SYSTEM STATUS REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n🕐 Generated: ${this.report.timestamp}`);
    console.log(`⏱️  System Uptime: ${Math.floor(this.report.systemHealth.uptime / 3600)}h ${Math.floor((this.report.systemHealth.uptime % 3600) / 60)}m`);
    console.log(`💾 Memory Usage: ${Math.round(this.report.systemHealth.memory.heapUsed / 1024 / 1024)}MB`);
    
    console.log('\n📦 DATABASE STATISTICS');
    console.log('-'.repeat(40));
    console.log(`📊 Total Products: ${this.report.summary.totalProducts}`);
    console.log(`   ├─ ProductDeals: ${this.report.databaseStats.productdeals?.totalProducts || 0}`);
    console.log(`   └─ Deals: ${this.report.databaseStats.deals?.totalProducts || 0}`);
    console.log(`🏪 Platforms: ${this.report.summary.platforms}`);
    console.log(`📂 Categories: ${this.report.summary.categories}`);
    
    if (this.report.databaseStats.productdeals?.analysis) {
      console.log('\n📊 ProductDeals Analysis:');
      console.log(`   ├─ With Deals: ${this.report.databaseStats.productdeals.analysis.withDeals}`);
      console.log(`   ├─ With Timers: ${this.report.databaseStats.productdeals.analysis.withTimers}`);
      console.log(`   └─ Recently Updated: ${this.report.databaseStats.productdeals.analysis.recentlyUpdated}`);
    }
    
    console.log('\n👥 USER STATISTICS');
    console.log('-'.repeat(40));
    console.log(`👤 Total Users: ${this.report.summary.totalUsers}`);
    console.log(`❤️  Total Favorites: ${this.report.summary.totalFavorites}`);
    console.log(`📱 Users with Telegram: ${this.report.userStats?.usersWithTelegram || 0}`);
    console.log(`📞 Users with WhatsApp: ${this.report.userStats?.usersWithWhatsapp || 0}`);
    console.log(`🔔 Users with Notifications: ${this.report.userStats?.usersWithNotifications || 0}`);
    console.log(`📊 Avg Favorites per User: ${this.report.userStats?.avgFavoritesPerUser || '0.00'}`);
    
    console.log('\n⚡ PROCESSING STATISTICS');
    console.log('-'.repeat(40));
    console.log(`🚀 Total Bulk Products: ${this.report.summary.totalBulkProducts}`);
    console.log(`   ├─ Created: ${this.report.summary.bulkUpdates.created}`);
    console.log(`   ├─ Updated: ${this.report.summary.bulkUpdates.updated}`);
    console.log(`   └─ Failed: ${this.report.summary.bulkUpdates.failed}`);
    
    console.log(`⏳ Total Idle Processed: ${this.report.summary.totalIdleProcessed}`);
    console.log(`   ├─ Created: ${this.report.summary.idleProcessing.created}`);
    console.log(`   ├─ Updated: ${this.report.summary.idleProcessing.updated}`);
    console.log(`   └─ Failed: ${this.report.summary.idleProcessing.failed}`);
    
    console.log(`📨 Total Notifications: ${this.report.summary.totalNotifications}`);
    console.log(`   ├─ Sent: ${this.report.summary.notifications.sent}`);
    console.log(`   └─ Failed: ${this.report.summary.notifications.failed}`);
    
    console.log(`💾 Total DB Operations: ${this.report.summary.totalDatabaseOperations}`);
    console.log(`✅ Success Rate: ${this.report.summary.successRate}%`);
    console.log(`❌ Error Rate: ${this.report.summary.errorRate}%`);
    
    if (this.report.loggingStats.bulkUpdates?.byPlatform) {
      console.log('\n🏪 BULK UPDATES BY PLATFORM');
      console.log('-'.repeat(40));
      Object.entries(this.report.loggingStats.bulkUpdates.byPlatform).forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} products`);
      });
    }
    
    if (this.report.loggingStats.bulkUpdates?.byCategory) {
      console.log('\n📂 BULK UPDATES BY CATEGORY');
      console.log('-'.repeat(40));
      Object.entries(this.report.loggingStats.bulkUpdates.byCategory).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} products`);
      });
    }
    
    // Failed Records Section
    console.log('\n❌ FAILED RECORDS SUMMARY');
    console.log('-'.repeat(40));
    console.log(`📊 Total Failures: ${this.report.summary.failedRecords.total}`);
    console.log(`⏳ Pending Retries: ${this.report.summary.failedRecords.pending}`);
    console.log(`🕐 Recent Failures (24h): ${this.report.summary.failedRecords.recent}`);
    
    if (this.report.failedRecordsSummary.byType) {
      console.log('\n📋 FAILURES BY TYPE');
      console.log('-'.repeat(40));
      Object.entries(this.report.failedRecordsSummary.byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} failures`);
      });
    }
    
    if (this.report.failedRecordsSummary.byPlatform) {
      console.log('\n🏪 FAILURES BY PLATFORM');
      console.log('-'.repeat(40));
      Object.entries(this.report.failedRecordsSummary.byPlatform).forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} failures`);
      });
    }
    
    if (this.report.failedRecords && this.report.failedRecords.length > 0) {
      console.log('\n🔍 RECENT FAILED RECORDS (Last 10)');
      console.log('-'.repeat(40));
      this.report.failedRecords.slice(0, 10).forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.type} - ${failure.platform || failure.productCode || failure.userId}`);
        console.log(`      Error: ${failure.error.message}`);
        console.log(`      Time: ${failure.timestamp}`);
        console.log(`      Status: ${failure.status}`);
        console.log('');
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Report generation completed successfully!');
    console.log('='.repeat(80) + '\n');
  }

  saveReport() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const reportDir = path.join(__dirname, '../logs');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const reportFile = path.join(reportDir, `comprehensive_status_${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(this.report, null, 2));
      
      logger.info(`📄 Comprehensive status report saved to: ${reportFile}`);
    } catch (error) {
      logger.error('❌ Error saving comprehensive status report', { error: error.message });
    }
  }
}

async function main() {
  try {
    const reporter = new ComprehensiveStatusReport();
    await reporter.generateFullReport();
  } catch (error) {
    console.error('❌ Failed to generate comprehensive status report:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ComprehensiveStatusReport };
