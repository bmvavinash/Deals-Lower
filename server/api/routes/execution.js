const express = require('express');
const router = express.Router();
const { executionTracker } = require('../../../services/executionTracker');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('execution-api');

/**
 * GET /api/execution/status
 * Get current execution status
 * Query params: type (bulk_update|telegram_bot|all)
 */
router.get('/status', async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const status = executionTracker.getCurrentStatus();
    
    // Filter by type if specified
    let filteredStatus = status;
    if (type !== 'all' && status.currentExecution) {
      if (status.currentExecution.type !== type) {
        // Return empty execution if type doesn't match
        filteredStatus = {
          ...status,
          currentExecution: null
        };
      }
    }
    
    res.json({
      success: true,
      data: filteredStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/analytics
 * Get execution analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = executionTracker.getAnalytics();
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/history
 * Get execution history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = executionTracker.getHistory(limit);
    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/product/:productCode
 * Get product details by product code from current execution
 */
router.get('/product/:productCode', async (req, res) => {
  try {
    const { productCode } = req.params;
    const status = executionTracker.getCurrentStatus();
    
    if (!status.currentExecution) {
      return res.status(404).json({
        success: false,
        error: 'No active execution'
      });
    }

    // Search for product in execution data
    let productDetails = null;
    const platforms = status.currentExecution.platforms || {};
    
    for (const [platform, platformData] of Object.entries(platforms)) {
      const categories = platformData.categories || {};
      for (const [category, categoryData] of Object.entries(categories)) {
        const pages = categoryData.pages || {};
        for (const [pageKey, pageData] of Object.entries(pages)) {
          const products = pageData.products || [];
          const found = products.find((p) => p.productCode === productCode);
          if (found) {
            productDetails = {
              ...found,
              platform,
              category,
              page: pageKey,
              executionId: status.currentExecution.id
            };
            break;
          }
        }
        if (productDetails) break;
      }
      if (productDetails) break;
    }

    // If not found in execution, try to get from database
    if (!productDetails) {
      try {
        const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
        const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
        const snapshot = await productDealsDB.productdealsRef.child(safeKey).once('value');
        const dbProduct = snapshot.val();
        
        if (dbProduct) {
          productDetails = {
            ...dbProduct,
            productCode,
            source: 'database'
          };
        }
      } catch (dbError) {
        logger.warn('Error fetching product from DB', { productCode, error: dbError.message });
      }
    }

    if (!productDetails) {
      return res.status(404).json({
        success: false,
        error: 'Product not found in current execution or database'
      });
    }

    res.json({
      success: true,
      data: productDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting product details', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;




