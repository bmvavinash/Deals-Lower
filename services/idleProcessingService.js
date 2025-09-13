const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { handleProductProcessing } = require('../dataSources/handleProductProcessing');
const { comprehensiveLoggingService } = require('./comprehensiveLoggingService');
const constants = require('../config/constants');

const logger = getModuleLogger('idleProcessingService');

class IdleProcessingService {
  constructor() {
    this.isProcessing = false;
    this.currentDatabase = 'productdeals'; // Start with productdeals
    this.processingIndex = 0;
  }

  // Main idle processing function
  async processIdleTime(driver) {
    if (this.isProcessing) {
      logger.debug('Idle processing already in progress, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      logger.info('Starting idle time processing');

      // 1. Process productdeals.json first
      await this.processDatabaseProducts(driver, 'productdeals');

      // 2. If still idle, process deals.json
      await this.processDatabaseProducts(driver, 'deals');

      logger.info('Idle time processing completed');
    } catch (error) {
      logger.error('Error in idle processing', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  // Process products from a specific database
  async processDatabaseProducts(driver, targetDb) {
    const startTime = comprehensiveLoggingService.logIdleProcessingStart(targetDb);
    
    try {
      logger.info(`⏳ Processing products from ${targetDb} database`);

      // Get products that need enrichment
      const productsNeedingUpdate = await productDealsDB.getProductsForIdleProcessing(targetDb, 5);
      
      if (productsNeedingUpdate.length === 0) {
        logger.info(`No products need updating in ${targetDb}`);
        comprehensiveLoggingService.logIdleProcessingComplete(targetDb, startTime, 0, 0, 0);
        return;
      }

      logger.info(`Found ${productsNeedingUpdate.length} products needing update in ${targetDb}`);

      let successCount = 0;
      let failedCount = 0;

      // Process each product
      for (const [productKey, product] of productsNeedingUpdate) {
        try {
          const success = await this.enrichProduct(driver, productKey, product, targetDb);
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
          
          // Small delay between products to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          logger.error(`❌ Error enriching product ${productKey} in ${targetDb}`, { error: error.message });
          failedCount++;
        }
      }

      // Log comprehensive stats
      comprehensiveLoggingService.logIdleProcessingComplete(targetDb, startTime, productsNeedingUpdate.length, successCount, failedCount);

    } catch (error) {
      logger.error(`❌ Error processing ${targetDb} database`, { error: error.message });
      comprehensiveLoggingService.logIdleProcessingComplete(targetDb, startTime, 0, 0, 1);
    }
  }

  // Enrich individual product with missing details
  async enrichProduct(driver, productKey, product, targetDb) {
    try {
      if (!product.productUrl) {
        logger.warn(`Product ${productKey} has no productUrl, skipping enrichment`);
        return;
      }

      logger.info(`Enriching product ${productKey} from ${targetDb}`, { 
        url: product.productUrl,
        missingFields: this.getMissingFields(product)
      });

      // Use existing product processing pipeline
      const enrichedData = await this.extractProductDetails(driver, product.productUrl, product);

      if (enrichedData) {
        // Update the product with enriched data
        await productDealsDB.updateIndividualProduct(productKey, enrichedData, targetDb);
        logger.info(`Successfully enriched product ${productKey} in ${targetDb}`);
      }

    } catch (error) {
      logger.error(`Error enriching product ${productKey}`, { error: error.message });
    }
  }

  // Extract product details using existing pipeline
  async extractProductDetails(driver, productUrl, existingProduct) {
    try {
      // Use the existing handleProductProcessing function
      const result = await handleProductProcessing(
        driver, 
        productUrl, 
        existingProduct.productText || existingProduct.title || '', 
        0, 
        '', 
        {}, 
        {}, 
        'idle_enrichment'
      );

      if (result && result.productData) {
        return this.filterEnrichedData(result.productData, existingProduct);
      }

      return null;
    } catch (error) {
      logger.error(`Error extracting product details for ${productUrl}`, { error: error.message });
      return null;
    }
  }

  // Filter and return only the enriched data that was missing
  filterEnrichedData(enrichedData, existingProduct) {
    const updates = {};

    // Only update fields that were missing or empty
    const fieldsToCheck = [
      'brand', 'title', 'description', 'offers', 'color', 'materialCare', 
      'seller', 'sizeFit', 'sizes', 'rating', 'ratingsCount', 'reviewsCount'
    ];

    for (const field of fieldsToCheck) {
      if (enrichedData[field] && (!existingProduct[field] || existingProduct[field] === '')) {
        updates[field] = enrichedData[field];
      }
    }

    // Always update offers if available
    if (enrichedData.offers && Array.isArray(enrichedData.offers) && enrichedData.offers.length > 0) {
      updates.offers = enrichedData.offers;
    }

    // Update description if available
    if (enrichedData.description && (!existingProduct.description || existingProduct.description === '')) {
      updates.description = enrichedData.description;
    }

    return Object.keys(updates).length > 0 ? updates : null;
  }

  // Get list of missing fields for logging
  getMissingFields(product) {
    const missingFields = [];
    const fieldsToCheck = [
      'brand', 'title', 'description', 'offers', 'color', 'materialCare', 
      'seller', 'sizeFit', 'sizes', 'rating', 'ratingsCount', 'reviewsCount'
    ];

    for (const field of fieldsToCheck) {
      if (!product[field] || product[field] === '') {
        missingFields.push(field);
      }
    }

    return missingFields;
  }

  // Process deal expiry tracking during idle time
  async processDealExpiryTracking() {
    try {
      logger.info('Processing deal expiry tracking during idle time');

      // Get products with timers from both databases
      const [productdealsWithTimers, dealsWithTimers] = await Promise.all([
        productDealsDB.getProductsWithTimers('productdeals'),
        productDealsDB.getProductsWithTimers('deals')
      ]);

      const allProductsWithTimers = [...productdealsWithTimers, ...dealsWithTimers];

      for (const [productKey, product] of allProductsWithTimers) {
        try {
          await this.updateDealTimer(productKey, product);
        } catch (error) {
          logger.error(`Error updating deal timer for ${productKey}`, { error: error.message });
        }
      }

      logger.info(`Processed ${allProductsWithTimers.length} products with deal timers`);
    } catch (error) {
      logger.error('Error in deal expiry tracking', { error: error.message });
    }
  }

  // Update deal timer information
  async updateDealTimer(productKey, product) {
    try {
      // Parse timer information and update if needed
      const timer = product.timer;
      if (!timer) return;

      // Check if timer indicates deal is expiring soon (1 hour or 15 minutes)
      const isExpiringSoon = this.isDealExpiringSoon(timer);
      
      if (isExpiringSoon) {
        // Update the product to mark it as expiring
        await productDealsDB.updateIndividualProduct(productKey, {
          isDealExpiring: true,
          dealExpiryWarning: this.getExpiryWarning(timer)
        }, product.storeType === 'productdeals' ? 'productdeals' : 'deals');
        
        logger.info(`Marked product ${productKey} as expiring soon`, { timer });
      }

    } catch (error) {
      logger.error(`Error updating deal timer for ${productKey}`, { error: error.message });
    }
  }

  // Check if deal is expiring soon based on timer
  isDealExpiringSoon(timer) {
    try {
      // Parse timer string (e.g., "2h 30m", "45m", "15m")
      const timerStr = timer.toLowerCase();
      
      // Check for 1 hour or less
      if (timerStr.includes('1h') || timerStr.includes('0h')) {
        return true;
      }
      
      // Check for 15 minutes or less
      if (timerStr.includes('15m') || timerStr.includes('10m') || timerStr.includes('5m')) {
        return true;
      }
      
      // Check for minutes only (less than 60)
      const minutesMatch = timerStr.match(/(\d+)m/);
      if (minutesMatch && parseInt(minutesMatch[1]) <= 60) {
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error parsing timer ${timer}`, { error: error.message });
      return false;
    }
  }

  // Get expiry warning message
  getExpiryWarning(timer) {
    const timerStr = timer.toLowerCase();
    
    if (timerStr.includes('15m') || timerStr.includes('10m') || timerStr.includes('5m')) {
      return 'DEAL_EXPIRING_15MIN';
    }
    
    if (timerStr.includes('1h') || timerStr.includes('0h')) {
      return 'DEAL_EXPIRING_1HOUR';
    }
    
    return 'DEAL_EXPIRING_SOON';
  }
}

const idleProcessingService = new IdleProcessingService();
module.exports = { idleProcessingService };
