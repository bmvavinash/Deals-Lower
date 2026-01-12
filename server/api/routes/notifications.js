const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { notificationTrackingDB } = require('../../../database/firebaseDB/notificationTrackingDB');

const logger = getModuleLogger('notifications-api');

/**
 * GET /api/notifications/platform-status
 * Get platform notification statuses
 * Query params: platform, dealType, success
 */
router.get('/platform-status', async (req, res, next) => {
  try {
    const { platform, dealType, success } = req.query;
    
    const filters = {};
    if (platform) filters.platform = platform;
    if (dealType) filters.dealType = dealType;
    if (success !== undefined) filters.success = success === 'true';
    
    const statuses = await notificationTrackingDB.getAllNotificationStatuses(filters);
    
    res.json({
      success: true,
      data: statuses,
      count: statuses.length
    });
  } catch (error) {
    logger.error('Error fetching platform statuses', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/notifications/deal/:productCode
 * Get notification history for a specific deal
 */
router.get('/deal/:productCode', async (req, res, next) => {
  try {
    const { productCode } = req.params;
    const status = await notificationTrackingDB.getNotificationStatus(productCode);
    
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
    logger.error('Error fetching notification status', { 
      productCode: req.params.productCode, 
      error: error.message 
    });
    next(error);
  }
});

/**
 * GET /api/notifications/failed
 * Get all failed notifications
 */
router.get('/failed', async (req, res, next) => {
  try {
    const failed = await notificationTrackingDB.getFailedNotifications();
    
    res.json({
      success: true,
      data: failed,
      count: failed.length
    });
  } catch (error) {
    logger.error('Error fetching failed notifications', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics by platform
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await notificationTrackingDB.getPlatformStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching notification stats', { error: error.message });
    next(error);
  }
});

module.exports = router;


















