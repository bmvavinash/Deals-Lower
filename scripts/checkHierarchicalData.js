#!/usr/bin/env node

const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { missingDetailsTracker } = require('../utils/missingDetailsTracker');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('checkHierarchicalData');

async function analyzeHierarchicalData() {
  try {
    logger.info('🔍 Analyzing hierarchical data in productdeals database...');
    
    // Get all products from database
    const snapshot = await productDealsDB.ref.once('value');
    const allProducts = snapshot.val() || {};
    
    const analysis = {
      totalProducts: Object.keys(allProducts).length,
      productsWithCompleteHierarchy: 0,
      productsWithMissingHierarchy: 0,
      productsWithDummyCategories: 0,
      productsWithMissingCriticalFields: 0,
      hierarchicalIssues: {
        missingProductCategory: 0,
        missingProductSubcategory: 0,
        missingProductStyle: 0,
        missingCategoryLevel1: 0,
        missingCategoryLevel2: 0,
        missingCategoryLevel3: 0,
        missingHierarchicalCategory: 0,
        dummyCategories: 0
      },
      categoryDistribution: {},
      topIssues: []
    };

    // Analyze each product
    for (const [productKey, product] of Object.entries(allProducts)) {
      if (!product) continue;

      // Check critical fields
      const criticalFields = ['title', 'brand', 'price'];
      const missingCritical = criticalFields.filter(field => 
        !product[field] || product[field] === '' || product[field] === 'undefined' || product[field] === 'NA'
      );

      if (missingCritical.length > 0) {
        analysis.productsWithMissingCriticalFields++;
      }

      // Check hierarchical fields
      const hierarchicalFields = [
        'productCategory', 'productSubcategory', 'productStyle',
        'categoryLevel1', 'categoryLevel2', 'categoryLevel3',
        'hierarchicalCategory'
      ];

      let hasHierarchicalIssues = false;
      let hasDummyCategories = false;

      hierarchicalFields.forEach(field => {
        const value = product[field];
        
        if (!value || value === '' || value === 'undefined') {
          analysis.hierarchicalIssues[`missing${field.charAt(0).toUpperCase() + field.slice(1)}`]++;
          hasHierarchicalIssues = true;
        } else if (['General', 'Products', 'Unknown', 'N/A', 'NA'].includes(value)) {
          analysis.hierarchicalIssues.dummyCategories++;
          hasDummyCategories = true;
        }
      });

      // Check hierarchicalCategory structure
      if (!product.hierarchicalCategory || 
          !product.hierarchicalCategory.mainCategory || 
          product.hierarchicalCategory.mainCategory === 'General') {
        analysis.hierarchicalIssues.missingHierarchicalCategory++;
        hasHierarchicalIssues = true;
      }

      if (hasHierarchicalIssues) {
        analysis.productsWithMissingHierarchy++;
      }

      if (hasDummyCategories) {
        analysis.productsWithDummyCategories++;
      }

      if (!hasHierarchicalIssues && !hasDummyCategories) {
        analysis.productsWithCompleteHierarchy++;
      }

      // Track category distribution
      if (product.productCategory && product.productCategory !== 'General') {
        analysis.categoryDistribution[product.productCategory] = 
          (analysis.categoryDistribution[product.productCategory] || 0) + 1;
      }
    }

    // Generate top issues
    const issueCounts = Object.entries(analysis.hierarchicalIssues)
      .filter(([key, count]) => count > 0)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    analysis.topIssues = issueCounts.map(([issue, count]) => ({
      issue,
      count,
      percentage: ((count / analysis.totalProducts) * 100).toFixed(2) + '%'
    }));

    // Log analysis results
    logger.info('📊 Hierarchical Data Analysis Results', {
      totalProducts: analysis.totalProducts,
      productsWithCompleteHierarchy: analysis.productsWithCompleteHierarchy,
      productsWithMissingHierarchy: analysis.productsWithMissingHierarchy,
      productsWithDummyCategories: analysis.productsWithDummyCategories,
      productsWithMissingCriticalFields: analysis.productsWithMissingCriticalFields,
      completenessRate: analysis.totalProducts > 0 
        ? ((analysis.productsWithCompleteHierarchy / analysis.totalProducts) * 100).toFixed(2) + '%'
        : '0%'
    });

    logger.info('🔍 Top Hierarchical Issues', analysis.topIssues);

    logger.info('📈 Category Distribution', Object.entries(analysis.categoryDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }))
    );

    // Check missing details tracker
    const missingDetailsSummary = missingDetailsTracker.getSummary();
    logger.info('📋 Missing Details Tracker Summary', missingDetailsSummary);

    return analysis;

  } catch (error) {
    logger.error('❌ Error analyzing hierarchical data', { error: error.message });
    throw error;
  }
}

async function main() {
  try {
    logger.info('🚀 Starting hierarchical data analysis...');
    
    const analysis = await analyzeHierarchicalData();
    
    // Provide recommendations
    logger.info('💡 Recommendations:');
    
    if (analysis.productsWithMissingHierarchy > 0) {
      logger.info(`   - Run hierarchical enrichment for ${analysis.productsWithMissingHierarchy} products with missing hierarchy`);
    }
    
    if (analysis.productsWithDummyCategories > 0) {
      logger.info(`   - Fix ${analysis.productsWithDummyCategories} products with dummy categories`);
    }
    
    if (analysis.productsWithMissingCriticalFields > 0) {
      logger.info(`   - Enrich ${analysis.productsWithMissingCriticalFields} products with missing critical fields`);
    }
    
    if (analysis.productsWithCompleteHierarchy === analysis.totalProducts) {
      logger.info('   ✅ All products have complete hierarchical data!');
    }
    
    logger.info('✅ Hierarchical data analysis completed successfully');
    
  } catch (error) {
    logger.error('❌ Error in main function', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error('❌ Unhandled error in main function', { error: error.message });
  process.exit(1);
});
