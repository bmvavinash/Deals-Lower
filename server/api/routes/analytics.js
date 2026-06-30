const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');
const { loadState, getStateSummary } = require('../../../database/firebaseDB/schedulerStateDB');
const { bannerManager } = require('../../../bannerManager');
const cacheService = require('../../../services/cacheService');

const logger = getModuleLogger('analytics-api');

/**
 * GET /api/analytics/deals
 * Get deal analytics (success rate, platform distribution)
 */
router.get('/deals', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Check cache first
    const cacheKey = `analytics_deals_${startDate || 'all'}_${endDate || 'all'}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deals analytics');
      return res.json(cached);
    }
    
    // Get deals from both databases (with timeout)
    const dealsPromise = productDealsDB.dealsRef.once('value');
    const productDealsPromise = productDealsDB.productdealsRef.once('value');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 10000)
    );
    
    let dealsSnapshot = null;
    let productDealsSnapshot = null;
    
    try {
      [dealsSnapshot, productDealsSnapshot] = await Promise.race([
        Promise.all([dealsPromise, productDealsPromise]),
        timeoutPromise
      ]);
    } catch (error) {
      logger.warn('Database query timeout, using partial data', { error: error.message });
      // Continue with null snapshots - will result in empty data
    }
    
    const deals = dealsSnapshot?.val() || {};
    const productDeals = productDealsSnapshot?.val() || {};
    
    const analytics = {
      totalDeals: Object.keys(deals).length + Object.keys(productDeals).length,
      hotDeals: Object.keys(deals).length,
      productDeals: Object.keys(productDeals).length,
      byPlatform: {},
      byCategory: {},
      priceRange: {
        under500: 0,
        '500-1000': 0,
        '1000-5000': 0,
        '5000-10000': 0,
        over10000: 0
      },
      discountDistribution: {
        '0-25': 0,
        '25-50': 0,
        '50-75': 0,
        '75-100': 0
      }
    };
    
    // Process deals
    const processDeal = (deal) => {
      // Platform distribution
      const platform = deal.storeType || 'Unknown';
      analytics.byPlatform[platform] = (analytics.byPlatform[platform] || 0) + 1;
      
      // Category distribution
      const category = deal.category?.mainCategory || deal.categoryGroup || 'Unknown';
      analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
      
      // Price range
      const price = parseFloat(deal.price?.replace(/[^\d.]/g, '') || 0);
      if (price < 500) analytics.priceRange.under500++;
      else if (price < 1000) analytics.priceRange['500-1000']++;
      else if (price < 5000) analytics.priceRange['1000-5000']++;
      else if (price < 10000) analytics.priceRange['5000-10000']++;
      else analytics.priceRange.over10000++;
      
      // Discount distribution
      const discount = parseFloat(deal.discount?.replace(/[^\d.]/g, '') || 0);
      if (discount < 25) analytics.discountDistribution['0-25']++;
      else if (discount < 50) analytics.discountDistribution['25-50']++;
      else if (discount < 75) analytics.discountDistribution['50-75']++;
      else analytics.discountDistribution['75-100']++;
    };
    
    if (dealsSnapshot) {
      const deals = dealsSnapshot.val() || {};
      Object.values(deals).forEach(processDeal);
    }
    if (productDealsSnapshot) {
      const productDeals = productDealsSnapshot.val() || {};
      Object.values(productDeals).forEach(processDeal);
    }
    
    const response = {
      success: true,
      data: analytics
    };
    
    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 5 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching deal analytics', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/analytics/notifications
 * Get notification analytics
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const stats = await notificationTrackingDB.getPlatformStats();
    const failed = await notificationTrackingDB.getFailedNotifications();
    
    // Get favorites-based notification stats
    let favoritesStats = null;
    try {
      const { favoritesNotificationService } = require('../../../services/favoritesBasedNotificationService');
      favoritesStats = favoritesNotificationService.getStats();
    } catch (e) {
      logger.debug('Favorites notification service not available', { error: e.message });
    }
    
    const analytics = {
      platformStats: stats,
      totalFailed: failed.length,
      failureRate: {},
      successRate: {},
      favoritesBased: favoritesStats || {
        totalTriggered: 0,
        totalSent: 0,
        byChannel: { whatsapp: {}, telegram: {} },
        byType: { price_drop: 0, new_deal: 0, category_deal: 0 }
      }
    };
    
    // Calculate rates
    Object.entries(stats).forEach(([platform, platformStats]) => {
      const total = platformStats.total || 0;
      if (total > 0) {
        analytics.successRate[platform] = ((platformStats.success / total) * 100).toFixed(2);
        analytics.failureRate[platform] = ((platformStats.failed / total) * 100).toFixed(2);
      }
    });
    
    // Failed notifications by platform
    const failedByPlatform = {};
    failed.forEach(f => {
      failedByPlatform[f.platform] = (failedByPlatform[f.platform] || 0) + 1;
    });
    analytics.failedByPlatform = failedByPlatform;
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error fetching notification analytics', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/analytics/performance
 * Get system performance metrics
 */
router.get('/performance', async (req, res, next) => {
  try {
    const stateSummary = await getStateSummary();
    
    const performance = {
      scheduler: {
        totalRuns: stateSummary.totalRuns || 0,
        totalProductsProcessed: stateSummary.totalProductsProcessed || 0,
        lastRun: stateSummary.lastBulkRun,
        averageProductsPerRun: stateSummary.totalRuns > 0 
          ? Math.round((stateSummary.totalProductsProcessed || 0) / stateSummary.totalRuns)
          : 0
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/analytics/favorites-notifications
 * Get favorites-based notification analytics
 */
router.get('/favorites-notifications', async (req, res, next) => {
  try {
    const { favoritesNotificationService } = require('../../../services/favoritesBasedNotificationService');
    const stats = favoritesNotificationService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching favorites notification analytics', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/analytics/banners
 * Get banner analytics
 */
router.get('/banners', async (req, res, next) => {
  try {
    // Check cache first
    const cacheKey = 'analytics_banners';
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached banners analytics');
      return res.json(cached);
    }
    
    // Get banner statistics
    const bannerStatsResult = await bannerManager.getBannerStats();
    
    if (bannerStatsResult.status !== 200) {
      return res.status(500).json({
        success: false,
        error: bannerStatsResult.message || 'Error fetching banner statistics'
      });
    }
    
    const stats = bannerStatsResult.data || {};
    
    const analytics = {
      total: stats.total || 0,
      active: stats.active || 0,
      inactive: stats.inactive || 0,
      byPlatform: stats.byPlatform || {},
      byCategory: stats.byCategory || {},
      activeRate: stats.total > 0 
        ? ((stats.active / stats.total) * 100).toFixed(2)
        : 0
    };
    
    const response = {
      success: true,
      data: analytics
    };
    
    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 5 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching banner analytics', { error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;




