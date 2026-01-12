const express = require('express');
const router = express.Router();
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');
const { runBulkUpdateAll } = require('../../../scripts/bulkUpdateAllPlatforms');
const { getModuleLogger } = require('../../../logger/logger');
const cacheService = require('../../../services/cacheService');
const { getformattedDate } = require('../../../utils/commonUtils');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');
const { getProductDetails } = require('../../../scheduler');
const { productStatus } = require('../../../config/const');
const constants = require('../../../config/constants');
const { getAccessToken } = require('../../../database/getAccessToken');
const { firebaseget } = require('../../../database/firebaseget');
const { firebasepost } = require('../../../database/firebasepost');

const logger = getModuleLogger('deals-api');

/**
 * GET /api/deals
 * List all deals with optional filters
 * Query params: dealType (hotDeal|productDeal), platform, limit, offset
 */
router.get('/', async (req, res, next) => {
  try {
    const { dealType, platform, limit = 100, offset = 0 } = req.query;
    
    // Create cache key
    const cacheKey = `deals_${dealType || 'all'}_${platform || 'all'}_${limit}_${offset}`;
    
    // Check cache first (increased TTL to 10 minutes for deals)
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deals', { cacheKey });
      return res.json(cached);
    }
    
    // Determine which database to query
    const targetDb = dealType === 'hotDeal' ? 'deals' : 'productdeals';
    const ref = targetDb === 'deals' ? productDealsDB.dealsRef : productDealsDB.productdealsRef;
    
    const snapshot = await ref.once('value');
    let deals = snapshot.val() || {};
    
    // Convert to array and filter
    let dealsArray = Object.entries(deals).map(([key, value]) => ({
      productCode: key,
      ...value
    }));

    // Filter by platform if specified
    if (platform) {
      dealsArray = dealsArray.filter(deal => 
        deal.storeType?.toLowerCase() === platform.toLowerCase()
      );
    }

    // Sort by timestamp in descending order (newest first)
    // Priority: updatedatetime > datetime > updateTimestamp > 0
    dealsArray.sort((a, b) => {
      const aTime = Number(a.updatedatetime || a.datetime || a.updateTimestamp || 0);
      const bTime = Number(b.updatedatetime || b.datetime || b.updateTimestamp || 0);
      return bTime - aTime; // Descending order (newest first)
    });

    // Apply pagination
    const total = dealsArray.length;
    const paginated = dealsArray.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Get notification statuses for paginated deals
    const dealsWithNotifications = await Promise.all(
      paginated.map(async (deal) => {
        const notificationStatus = await notificationTrackingDB.getNotificationStatus(deal.productCode);
        return {
          ...deal,
          notificationStatus: notificationStatus || null
        };
      })
    );

    const response = {
      success: true,
      data: dealsWithNotifications,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      dealType: dealType || 'all',
      database: targetDb
    };
    
    // Cache the response for 10 minutes (increased from 2 minutes to reduce DB load)
    cacheService.set(cacheKey, response, 10 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching deals', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/deals/:productCode
 * Get specific deal by product code
 */
router.get('/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const { db = 'deals' } = req.query; // Allow specifying db: deals or productdeals
    
    // Check cache first (increased TTL to 10 minutes)
    const cacheKey = `deal_${productCode}_${db}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached deal', { productCode });
      return res.json(cached);
    }
    
    const targetRef = db === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    
    const snapshot = await targetRef.child(safeKey).once('value');
    const deal = snapshot.val();
    
    if (!deal) {
      return res.status(404).json({ 
        success: false, 
        error: 'Deal not found' 
      });
    }

    // Get notification status
    const notificationStatus = await notificationTrackingDB.getNotificationStatus(productCode);

    const response = {
      success: true,
      data: {
        productCode,
        ...deal,
        notificationStatus
      }
    };
    
    // Cache for 10 minutes (increased from 5 minutes)
    cacheService.set(cacheKey, response, 10 * 60 * 1000);
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching deal', { productCode: req.params.productCode, error: error.message });
    next(error);
  }
});

/**
 * GET /api/deals/notifications/:productCode
 * Get notification status for a specific deal
 */
router.get('/notifications/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const status = await notificationTrackingDB.getNotificationStatus(productCode);
    
    if (!status) {
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'No notification status found for this product'
      });
    }

    res.json({
      success: true,
      data: status
    });
    } catch (error) {
    logger.error('Error fetching notification status', { error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;