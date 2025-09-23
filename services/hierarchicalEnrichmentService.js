const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { handleProductProcessing } = require('../dataSources/handleProductProcessing');
const { comprehensiveLoggingService } = require('./comprehensiveLoggingService');
const { missingDetailsTracker } = require('../utils/missingDetailsTracker');
const { systemHealthMonitor } = require('./systemHealthMonitor');
const { normalizeProduct } = require('../dataSources/batchProductExtractor');
const constants = require('../config/constants');

const logger = getModuleLogger('hierarchicalEnrichmentService');

class HierarchicalEnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.enrichmentStats = {
      totalProcessed: 0,
      hierarchicalFixed: 0,
      missingFieldsFixed: 0,
      failedEnrichments: 0
    };
  }

  /**
   * Main function to enrich products with missing hierarchical data during idle time
   */
  async enrichProductsWithMissingHierarchy(driver) {
    if (this.isProcessing) {
      logger.debug('Hierarchical enrichment already in progress, skipping');
      return;
    }

    const startTime = Date.now();
    const operationId = `hierarchical_enrichment_${Date.now()}`;

    try {
      this.isProcessing = true;
      logger.info('🔍 Starting hierarchical enrichment for products with missing data', {
        operationId,
        timestamp: new Date().toISOString()
      });

      // 1. Pre-enrichment health check
      await this.performPreEnrichmentHealthCheck();

      // 2. Get products with missing hierarchical data
      const productsNeedingEnrichment = await this.getProductsWithMissingHierarchy();
      
      if (productsNeedingEnrichment.length === 0) {
        logger.info('✅ No products need hierarchical enrichment', { operationId });
        return;
      }

      logger.info(`🎯 Found ${productsNeedingEnrichment.length} products needing hierarchical enrichment`, {
        operationId,
        productsCount: productsNeedingEnrichment.length,
        topPriorities: productsNeedingEnrichment.slice(0, 3).map(p => ({
          productKey: p.productKey,
          priority: p.priority,
          reasons: p.reasons
        }))
      });

      // 3. Process products in batches
      const batchSize = 5; // Process 5 products at a time
      let totalProcessed = 0;
      
      for (let i = 0; i < productsNeedingEnrichment.length; i += batchSize) {
        const batch = productsNeedingEnrichment.slice(i, i + batchSize);
        const batchId = `batch_${Math.floor(i / batchSize) + 1}`;
        
        logger.info(`🔄 Processing ${batchId}`, {
          operationId,
          batchId,
          batchSize: batch.length,
          progress: `${totalProcessed}/${productsNeedingEnrichment.length}`
        });

        try {
          await this.processEnrichmentBatch(driver, batch, operationId, batchId);
          totalProcessed += batch.length;
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (batchError) {
          logger.error(`❌ Error processing ${batchId}`, {
            operationId,
            batchId,
            error: batchError.message,
            fixSteps: systemHealthMonitor.getFixSteps('hierarchical_category_failed').steps
          });
          
          // Record failure for health monitoring
          systemHealthMonitor.recordFailure('hierarchicalEnrichmentService', batchError, {
            operationId,
            batchId,
            batchSize: batch.length
          });
        }
      }

      // 4. Log final statistics
      const duration = Date.now() - startTime;
      this.logEnrichmentStats(operationId, duration, totalProcessed);

    } catch (error) {
      logger.error('❌ Critical error in hierarchical enrichment', { 
        operationId,
        error: error.message,
        stack: error.stack,
        fixSteps: systemHealthMonitor.getFixSteps('hierarchical_category_failed').steps
      });
      
      // Record critical failure
      systemHealthMonitor.recordFailure('hierarchicalEnrichmentService', error, {
        operationId,
        phase: 'main_enrichment_loop'
      });
      
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get products that need hierarchical enrichment
   */
  async getProductsWithMissingHierarchy() {
    try {
      // Get all products from productdeals database
      const snapshot = await productDealsDB.ref.once('value');
      const allProducts = snapshot.val() || {};
      
      const productsNeedingEnrichment = [];

      for (const [productKey, product] of Object.entries(allProducts)) {
        if (!product || !product.productUrl) continue;

        // Check if product needs enrichment
        const needsEnrichment = this.productNeedsHierarchicalEnrichment(product);
        
        if (needsEnrichment.needsEnrichment) {
          productsNeedingEnrichment.push({
            productKey,
            product,
            reasons: needsEnrichment.reasons,
            priority: this.calculateEnrichmentPriority(product, needsEnrichment.reasons)
          });
        }
      }

      // Sort by priority (highest first)
      productsNeedingEnrichment.sort((a, b) => b.priority - a.priority);

      return productsNeedingEnrichment.slice(0, 20); // Limit to 20 products per run

    } catch (error) {
      logger.error('Error getting products with missing hierarchy', { error: error.message });
      return [];
    }
  }

  /**
   * Check if a product needs hierarchical enrichment
   */
  productNeedsHierarchicalEnrichment(product) {
    const reasons = [];
    let needsEnrichment = false;

    // Check for missing critical fields
    const criticalFields = ['title', 'brand', 'price'];
    const missingCritical = criticalFields.filter(field => 
      !product[field] || product[field] === '' || product[field] === 'undefined' || product[field] === 'NA'
    );

    if (missingCritical.length > 0) {
      reasons.push(`missing_critical_fields: ${missingCritical.join(', ')}`);
      needsEnrichment = true;
    }

    // Check for missing or dummy hierarchical data
    const hierarchicalFields = [
      'productCategory', 'productSubcategory', 'productStyle',
      'categoryLevel1', 'categoryLevel2', 'categoryLevel3',
      'hierarchicalCategory'
    ];

    const missingHierarchical = hierarchicalFields.filter(field => 
      !product[field] || product[field] === '' || product[field] === 'undefined' || 
      product[field] === 'General' || product[field] === 'Products'
    );

    if (missingHierarchical.length > 0) {
      reasons.push(`missing_hierarchical: ${missingHierarchical.join(', ')}`);
      needsEnrichment = true;
    }

    // Check for dummy category values
    const dummyCategories = ['General', 'Products', 'Unknown', 'N/A', 'NA'];
    const hasDummyCategories = hierarchicalFields.some(field => 
      dummyCategories.includes(product[field])
    );

    if (hasDummyCategories) {
      reasons.push('dummy_categories_detected');
      needsEnrichment = true;
    }

    // Check if hierarchicalCategory is missing or incomplete
    if (!product.hierarchicalCategory || 
        !product.hierarchicalCategory.mainCategory || 
        product.hierarchicalCategory.mainCategory === 'General') {
      reasons.push('incomplete_hierarchical_category');
      needsEnrichment = true;
    }

    return { needsEnrichment, reasons };
  }

  /**
   * Calculate enrichment priority based on missing data
   */
  calculateEnrichmentPriority(product, reasons) {
    let priority = 0;

    // Higher priority for missing critical fields
    if (reasons.some(r => r.includes('missing_critical_fields'))) {
      priority += 50;
    }

    // Higher priority for missing hierarchical data
    if (reasons.some(r => r.includes('missing_hierarchical'))) {
      priority += 30;
    }

    // Higher priority for dummy categories
    if (reasons.some(r => r.includes('dummy_categories_detected'))) {
      priority += 25;
    }

    // Higher priority for incomplete hierarchical category
    if (reasons.some(r => r.includes('incomplete_hierarchical_category'))) {
      priority += 20;
    }

    // Boost priority for products with URLs (easier to process)
    if (product.productUrl && product.productUrl.includes('amazon.in')) {
      priority += 10;
    }

    return priority;
  }

  /**
   * Perform pre-enrichment health check
   */
  async performPreEnrichmentHealthCheck() {
    try {
      logger.info('🏥 Performing pre-enrichment health check...');
      
      // Check database connectivity
      const testRef = productDealsDB.ref.child('health_check');
      await testRef.set({ timestamp: Date.now() });
      await testRef.remove();
      
      // Check driver availability
      if (!global.driver || !global.driver.getCurrentUrl) {
        throw new Error('WebDriver not available for enrichment');
      }
      
      logger.info('✅ Pre-enrichment health check passed');
      
    } catch (error) {
      logger.error('❌ Pre-enrichment health check failed', {
        error: error.message,
        fixSteps: systemHealthMonitor.getFixSteps('database_connection_failed').steps
      });
      
      systemHealthMonitor.recordFailure('hierarchicalEnrichmentService', error, {
        phase: 'pre_enrichment_health_check'
      });
      
      throw error;
    }
  }

  /**
   * Process a batch of products for enrichment
   */
  async processEnrichmentBatch(driver, batch, operationId, batchId) {
    logger.info(`🔄 Processing enrichment batch of ${batch.length} products`, {
      operationId,
      batchId,
      batchSize: batch.length
    });

    let batchSuccessCount = 0;
    let batchFailureCount = 0;

    for (const { productKey, product, reasons } of batch) {
      const productStartTime = Date.now();
      
      try {
        logger.debug(`🔧 Starting enrichment for product ${productKey}`, {
          operationId,
          batchId,
          productKey,
          reasons: reasons.join(', ')
        });

        await this.enrichIndividualProduct(driver, productKey, product, reasons, operationId, batchId);
        this.enrichmentStats.totalProcessed++;
        batchSuccessCount++;
        
        const productDuration = Date.now() - productStartTime;
        logger.debug(`✅ Product ${productKey} enriched successfully`, {
          operationId,
          batchId,
          productKey,
          duration: `${productDuration}ms`
        });
        
        // Small delay between products
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`❌ Error enriching product ${productKey}`, { 
          operationId,
          batchId,
          productKey,
          error: error.message,
          stack: error.stack,
          fixSteps: systemHealthMonitor.getFixSteps('product_extraction_failed').steps
        });
        
        this.enrichmentStats.failedEnrichments++;
        batchFailureCount++;
        
        // Record individual product failure
        systemHealthMonitor.recordFailure('hierarchicalEnrichmentService', error, {
          operationId,
          batchId,
          productKey,
          phase: 'individual_product_enrichment'
        });
      }
    }

    logger.info(`📊 Batch ${batchId} completed`, {
      operationId,
      batchId,
      totalProducts: batch.length,
      successful: batchSuccessCount,
      failed: batchFailureCount,
      successRate: batch.length > 0 ? `${((batchSuccessCount / batch.length) * 100).toFixed(2)}%` : '0%'
    });
  }

  /**
   * Enrich individual product with missing data
   */
  async enrichIndividualProduct(driver, productKey, product, reasons, operationId, batchId) {
    const productStartTime = Date.now();
    
    try {
      logger.info(`🔧 Enriching product ${productKey}`, { 
        operationId,
        batchId,
        productKey,
        url: product.productUrl,
        reasons: reasons.join(', ')
      });

      // Extract fresh data from the product URL
      const enrichedData = await this.extractFreshProductData(driver, product.productUrl, product, operationId, batchId);
      
      if (!enrichedData) {
        logger.warn(`⚠️ No enriched data extracted for product ${productKey}`, {
          operationId,
          batchId,
          productKey,
          fixSteps: systemHealthMonitor.getFixSteps('product_extraction_failed').steps
        });
        return;
      }

      // Generate hierarchical categories for the enriched data
      const hierarchicalData = await this.generateHierarchicalCategories(enrichedData, product, operationId, batchId);
      
      // Merge enriched data with hierarchical data
      const finalEnrichedData = {
        ...enrichedData,
        ...hierarchicalData
      };

      // Update the product in database
      await this.updateProductInDatabase(productKey, finalEnrichedData, product, operationId, batchId);

      // Track what was fixed
      this.trackFixedFields(product, finalEnrichedData, reasons);

      const productDuration = Date.now() - productStartTime;
      logger.info(`✅ Successfully enriched product ${productKey}`, {
        operationId,
        batchId,
        productKey,
        duration: `${productDuration}ms`,
        fixedFields: Object.keys(finalEnrichedData),
        hierarchicalCategory: finalEnrichedData.hierarchicalCategory?.mainCategory
      });

    } catch (error) {
      const productDuration = Date.now() - productStartTime;
      logger.error(`❌ Error enriching individual product ${productKey}`, { 
        operationId,
        batchId,
        productKey,
        duration: `${productDuration}ms`,
        error: error.message,
        stack: error.stack,
        fixSteps: systemHealthMonitor.getFixSteps('product_extraction_failed').steps
      });
      throw error;
    }
  }

  /**
   * Extract fresh product data from URL
   */
  async extractFreshProductData(driver, productUrl, existingProduct, operationId, batchId) {
    const extractionStartTime = Date.now();
    
    try {
      logger.debug(`🔍 Extracting fresh data for ${productUrl}`, {
        operationId,
        batchId,
        productUrl
      });

      // Use existing product processing pipeline
      const result = await handleProductProcessing(
        driver, 
        productUrl, 
        existingProduct.productText || existingProduct.title || '', 
        0, 
        '', 
        {}, 
        {}, 
        'hierarchical_enrichment'
      );

      if (result && result.productData) {
        // Filter to only include fields that were missing
        const filteredData = this.filterEnrichedFields(result.productData, existingProduct);
        
        const extractionDuration = Date.now() - extractionStartTime;
        logger.debug(`✅ Fresh data extracted successfully`, {
          operationId,
          batchId,
          productUrl,
          duration: `${extractionDuration}ms`,
          extractedFields: Object.keys(filteredData || {})
        });
        
        return filteredData;
      }

      logger.warn(`⚠️ No product data extracted from ${productUrl}`, {
        operationId,
        batchId,
        productUrl,
        duration: `${Date.now() - extractionStartTime}ms`
      });

      return null;
    } catch (error) {
      const extractionDuration = Date.now() - extractionStartTime;
      logger.error(`❌ Error extracting fresh data for ${productUrl}`, { 
        operationId,
        batchId,
        productUrl,
        duration: `${extractionDuration}ms`,
        error: error.message,
        stack: error.stack,
        fixSteps: systemHealthMonitor.getFixSteps('product_extraction_failed').steps
      });
      return null;
    }
  }

  /**
   * Generate hierarchical categories for enriched data
   */
  async generateHierarchicalCategories(enrichedData, existingProduct, operationId, batchId) {
    const categoryStartTime = Date.now();
    
    try {
      logger.debug(`🏷️ Generating hierarchical categories`, {
        operationId,
        batchId,
        hasTitle: !!(enrichedData.title || existingProduct.title),
        hasBrand: !!(enrichedData.brand || existingProduct.brand),
        hasUrl: !!existingProduct.productUrl
      });

      // Create a raw product object for category extraction
      const rawProduct = {
        name: enrichedData.title || existingProduct.title || '',
        brand: enrichedData.brand || existingProduct.brand || '',
        description: enrichedData.description || existingProduct.description || '',
        productUrl: existingProduct.productUrl || '',
        price: enrichedData.price || existingProduct.price || '',
        originalPrice: enrichedData.originalPrice || existingProduct.originalPrice || ''
      };

      // Use the normalizeProduct function to get hierarchical categories
      const normalizedProduct = await normalizeProduct(rawProduct, 'website', 'hierarchical_enrichment', 'productdeals');
      
      // Extract hierarchical data
      const hierarchicalData = {
        productCategory: normalizedProduct.productCategory,
        productSubcategory: normalizedProduct.productSubcategory,
        productStyle: normalizedProduct.productStyle,
        categoryLevel1: normalizedProduct.categoryLevel1,
        categoryLevel2: normalizedProduct.categoryLevel2,
        categoryLevel3: normalizedProduct.categoryLevel3,
        subcategory1: normalizedProduct.subcategory1,
        subcategory2: normalizedProduct.subcategory2,
        categoryPath: normalizedProduct.categoryPath,
        categoryDepth: normalizedProduct.categoryDepth,
        hierarchicalCategory: normalizedProduct.hierarchicalCategory,
        categorySource: normalizedProduct.categorySource
      };

      const categoryDuration = Date.now() - categoryStartTime;
      logger.debug(`✅ Hierarchical categories generated`, {
        operationId,
        batchId,
        duration: `${categoryDuration}ms`,
        mainCategory: hierarchicalData.productCategory,
        subcategory: hierarchicalData.productSubcategory,
        confidence: hierarchicalData.hierarchicalCategory?.confidence
      });

      return hierarchicalData;

    } catch (error) {
      const categoryDuration = Date.now() - categoryStartTime;
      logger.error('❌ Error generating hierarchical categories', { 
        operationId,
        batchId,
        duration: `${categoryDuration}ms`,
        error: error.message,
        stack: error.stack,
        fixSteps: systemHealthMonitor.getFixSteps('hierarchical_category_failed').steps
      });
      return {};
    }
  }

  /**
   * Filter enriched data to only include missing fields
   */
  filterEnrichedFields(enrichedData, existingProduct) {
    const updates = {};

    // Fields to check for enrichment
    const fieldsToCheck = [
      'title', 'brand', 'description', 'price', 'originalPrice', 'discountPercentage',
      'offers', 'color', 'materialCare', 'seller', 'sizeFit', 'sizes', 
      'rating', 'ratingsCount', 'reviewsCount', 'photo'
    ];

    for (const field of fieldsToCheck) {
      const existingValue = existingProduct[field];
      const enrichedValue = enrichedData[field];
      
      // Only update if field was missing or empty
      if (enrichedValue && 
          (!existingValue || existingValue === '' || existingValue === 'undefined' || existingValue === 'NA')) {
        updates[field] = enrichedValue;
      }
    }

    return updates;
  }

  /**
   * Update product in database with enriched data
   */
  async updateProductInDatabase(productKey, enrichedData, existingProduct, operationId, batchId) {
    const updateStartTime = Date.now();
    
    try {
      logger.debug(`💾 Updating product ${productKey} in database`, {
        operationId,
        batchId,
        productKey,
        fieldsToUpdate: Object.keys(enrichedData)
      });

      // Merge with existing product data
      const updatedProduct = {
        ...existingProduct,
        ...enrichedData,
        lastEnriched: new Date().toISOString(),
        enrichmentSource: 'hierarchical_enrichment_service',
        enrichmentOperationId: operationId,
        enrichmentBatchId: batchId
      };

      // Update in database
      await productDealsDB.updateIndividualProduct(productKey, updatedProduct, 'productdeals');
      
      const updateDuration = Date.now() - updateStartTime;
      logger.info(`📝 Updated product ${productKey} in database`, {
        operationId,
        batchId,
        productKey,
        duration: `${updateDuration}ms`,
        updatedFields: Object.keys(enrichedData)
      });

    } catch (error) {
      const updateDuration = Date.now() - updateStartTime;
      logger.error(`❌ Error updating product ${productKey} in database`, { 
        operationId,
        batchId,
        productKey,
        duration: `${updateDuration}ms`,
        error: error.message,
        stack: error.stack,
        fixSteps: systemHealthMonitor.getFixSteps('database_connection_failed').steps
      });
      throw error;
    }
  }

  /**
   * Track which fields were fixed
   */
  trackFixedFields(originalProduct, enrichedData, reasons) {
    const fixedFields = [];

    // Check critical fields
    const criticalFields = ['title', 'brand', 'price', 'originalPrice', 'discountPercentage'];
    criticalFields.forEach(field => {
      const originalValue = originalProduct[field];
      const enrichedValue = enrichedData[field];
      
      if ((!originalValue || originalValue === '' || originalValue === 'undefined' || originalValue === 'NA') 
          && enrichedValue && enrichedValue !== '' && enrichedValue !== 'undefined' && enrichedValue !== 'NA') {
        fixedFields.push(field);
        this.enrichmentStats.missingFieldsFixed++;
      }
    });

    // Check hierarchical fields
    const hierarchicalFields = ['productCategory', 'productSubcategory', 'productStyle', 'hierarchicalCategory'];
    let hierarchicalFixed = false;
    hierarchicalFields.forEach(field => {
      const originalValue = originalProduct[field];
      const enrichedValue = enrichedData[field];
      
      if ((!originalValue || originalValue === 'General' || originalValue === 'Products') 
          && enrichedValue && enrichedValue !== 'General' && enrichedValue !== 'Products') {
        hierarchicalFixed = true;
      }
    });

    if (hierarchicalFixed) {
      this.enrichmentStats.hierarchicalFixed++;
    }

    // Update missing details tracker
    if (fixedFields.length > 0) {
      missingDetailsTracker.markProductAsFixed(originalProduct.productCode || originalProduct.asin, fixedFields);
    }
  }

  /**
   * Log enrichment statistics
   */
  logEnrichmentStats(operationId, duration, totalProcessed) {
    const successRate = this.enrichmentStats.totalProcessed > 0 
      ? ((this.enrichmentStats.totalProcessed - this.enrichmentStats.failedEnrichments) / this.enrichmentStats.totalProcessed * 100).toFixed(2) + '%'
      : '0%';

    const stats = {
      operationId,
      duration: `${duration}ms`,
      totalProcessed: this.enrichmentStats.totalProcessed,
      hierarchicalFixed: this.enrichmentStats.hierarchicalFixed,
      missingFieldsFixed: this.enrichmentStats.missingFieldsFixed,
      failedEnrichments: this.enrichmentStats.failedEnrichments,
      successRate,
      averageTimePerProduct: this.enrichmentStats.totalProcessed > 0 
        ? `${Math.round(duration / this.enrichmentStats.totalProcessed)}ms`
        : '0ms'
    };

    logger.info('📊 Hierarchical Enrichment Statistics', stats);

    // Log recommendations based on results
    if (this.enrichmentStats.failedEnrichments > 0) {
      logger.warn('⚠️ Enrichment Issues Detected', {
        operationId,
        failedCount: this.enrichmentStats.failedEnrichments,
        recommendations: [
          'Check network connectivity for failed product URLs',
          'Verify WebDriver is functioning properly',
          'Review product extraction selectors',
          'Check for website layout changes'
        ]
      });
    }

    if (this.enrichmentStats.hierarchicalFixed === 0 && this.enrichmentStats.totalProcessed > 0) {
      logger.warn('⚠️ No Hierarchical Categories Fixed', {
        operationId,
        recommendations: [
          'Check category hierarchy database',
          'Verify category extraction logic',
          'Update category mapping rules',
          'Review product data completeness'
        ]
      });
    }

    return stats;
  }

  /**
   * Get enrichment statistics
   */
  getEnrichmentStats() {
    return { ...this.enrichmentStats };
  }

  /**
   * Reset enrichment statistics
   */
  resetStats() {
    this.enrichmentStats = {
      totalProcessed: 0,
      hierarchicalFixed: 0,
      missingFieldsFixed: 0,
      failedEnrichments: 0
    };
  }
}

// Create singleton instance
const hierarchicalEnrichmentService = new HierarchicalEnrichmentService();

module.exports = { HierarchicalEnrichmentService, hierarchicalEnrichmentService };
