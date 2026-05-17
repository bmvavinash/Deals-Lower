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
 * GET /api/execution/detailed
 * Get detailed execution status with platform and category breakdown
 */
router.get('/detailed', async (req, res) => {
  try {
    const status = executionTracker.getCurrentStatus();
    
    let breakdown = null;
    if (status.currentExecution && status.currentExecution.type === 'bulk_update') {
      const execution = status.currentExecution;
      breakdown = {
        platforms: {},
        categories: {},
        summary: {
          totalPlatforms: 0,
          completedPlatforms: 0,
          totalCategories: 0,
          completedCategories: 0,
          runningCategories: 0,
          pendingCategories: 0,
          zeroProductCategories: 0
        }
      };
      
      if (execution.platforms && typeof execution.platforms === 'object') {
        const platforms = Object.keys(execution.platforms);
        breakdown.summary.totalPlatforms = platforms.length;
        
        for (const [platform, platformData] of Object.entries(execution.platforms)) {
          const categories = platformData.categories || {};
          const categoryKeys = Object.keys(categories);
          
          let completedCount = 0;
          let runningCount = 0;
          let zeroCount = 0;
          
          const categoryDetails = {};
          for (const [category, categoryData] of Object.entries(categories)) {
            const total = categoryData.totalProducts || 0;
            const processed = categoryData.processed || 0;
            
            let status = 'pending';
            if (total === 0 && processed === 0) {
              status = 'zero';
              zeroCount++;
            } else if (processed >= total && total > 0) {
              status = 'completed';
              completedCount++;
            } else if (processed > 0) {
              status = 'running';
              runningCount++;
            }
            
            categoryDetails[category] = {
              status,
              totalProducts: total,
              processed: processed,
              created: categoryData.created || 0,
              updated: categoryData.updated || 0,
              errors: categoryData.errors || 0,
              startTime: categoryData.startTime,
              lastUpdate: categoryData.lastUpdate
            };
            
            breakdown.categories[category] = categoryDetails[category];
          }
          
          breakdown.platforms[platform] = {
            status: runningCount > 0 ? 'running' : (completedCount === categoryKeys.length && categoryKeys.length > 0 ? 'completed' : 'pending'),
            totalCategories: categoryKeys.length,
            completedCategories: completedCount,
            runningCategories: runningCount,
            zeroProductCategories: zeroCount,
            totalProducts: platformData.totalProducts || 0,
            processedProducts: platformData.totalProcessed || 0,
            created: platformData.totalCreated || 0,
            updated: platformData.totalUpdated || 0,
            categories: categoryDetails,
            startTime: platformData.startTime,
            lastUpdate: platformData.lastUpdate
          };
          
          if (completedCount === categoryKeys.length && categoryKeys.length > 0) {
            breakdown.summary.completedPlatforms++;
          }
          
          breakdown.summary.totalCategories += categoryKeys.length;
          breakdown.summary.completedCategories += completedCount;
          breakdown.summary.runningCategories += runningCount;
          breakdown.summary.zeroProductCategories += zeroCount;
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        ...status,
        breakdown
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting detailed execution status', { error: error.message });
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




