const { getModuleLogger } = require('../logger/logger');
const { scrapePage } = require('../pageScheduler');
const { loadConfig } = require('../pageScheduler');
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require('../utils/commonUtils');

const logger = getModuleLogger('missingDataRecoveryService');

class MissingDataRecoveryService {
  constructor() {
    this.recoveryAttempts = new Map(); // Track recovery attempts per product
    this.maxRecoveryAttempts = 3;
  }

  /**
   * Check if product is missing critical data
   */
  isMissingCriticalData(product) {
    if (!product) return false;
    return !product.title || !product.brand || !product.price || !product.photo;
  }

  /**
   * Generate pagination parameters for different platforms
   */
  generatePaginationParams(platform, originalUrl) {
    const paginationParams = {
      amazon: {
        page: 1,
        ref: 'sr_pg_1',
        s: 'relevanceblender'
      },
      flipkart: {
        page: 1,
        sort: 'relevance'
      },
      myntra: {
        page: 1,
        sort: 'relevance'
      },
      ajio: {
        page: 1,
        sort: 'relevance'
      }
    };

    return paginationParams[platform] || {};
  }

  /**
   * Build source URL with pagination parameters
   */
  buildSourceUrlWithPagination(originalUrl, platform) {
    try {
      const url = new URL(originalUrl);
      const paginationParams = this.generatePaginationParams(platform, originalUrl);
      
      // Add pagination parameters
      Object.entries(paginationParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      // Add additional parameters for better scraping
      url.searchParams.set('_t', Date.now()); // Cache busting
      
      return url.toString();
    } catch (error) {
      logger.error('Error building source URL with pagination:', { 
        originalUrl, 
        platform, 
        error: error.message 
      });
      return originalUrl;
    }
  }

  /**
   * Extract product identifier from URL for better targeting
   */
  extractProductIdentifier(url, platform) {
    try {
      switch (platform) {
        case 'amazon':
          return getAsin(url);
        case 'flipkart':
          return getFlipkartProductId(url);
        case 'ajio':
          return getAjioCode(url);
        case 'myntra':
          return getMyntraCode(url);
        default:
          return null;
      }
    } catch (error) {
      logger.error('Error extracting product identifier:', { 
        url, 
        platform, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Get enhanced selectors for missing data recovery
   */
  getEnhancedSelectors(platform, pageType = 'searchPage') {
    const enhancedSelectors = {
      amazon: {
        searchPage: {
          productContainer: 'div[data-component-type="s-search-result"]',
          title: 'h2 a span, .s-size-mini .s-color-base',
          brand: '[data-cy="title-recipe-title"] span, .a-size-base-plus',
          price: '.a-price-whole, .a-offscreen',
          image: 'img[data-image-latency]',
          rating: '.a-icon-alt',
          reviews: '.a-size-base',
          link: 'h2 a'
        },
        productPage: {
          title: '#productTitle, h1.a-size-large',
          brand: '#bylineInfo, .a-size-base',
          price: '.a-price-whole, .a-offscreen',
          image: '#landingImage, #imgTagWrapperId img',
          rating: '.a-icon-alt',
          reviews: '#acrCustomerReviewText'
        }
      },
      flipkart: {
        searchPage: {
          productContainer: 'div[data-id]',
          title: 'a[title]',
          brand: '._2WkVRV',
          price: '._30jeq3',
          image: '._396cs4',
          rating: '._3LWZlK',
          reviews: '._2_R_DZ',
          link: 'a[href*="/p/"]'
        }
      },
      myntra: {
        searchPage: {
          productContainer: '.product-base',
          title: '.product-product',
          brand: '.product-brand',
          price: '.product-discountedPrice',
          image: '.product-image img',
          rating: '.product-ratingsContainer',
          link: '.product-base a'
        }
      },
      ajio: {
        searchPage: {
          productContainer: '.item',
          title: '.nameCls',
          brand: '.brand',
          price: '.price',
          image: '.imgHolder img',
          link: '.item a'
        }
      }
    };

    return enhancedSelectors[platform]?.[pageType] || {};
  }

  /**
   * Attempt to recover missing data using source URL
   */
  async recoverMissingData(product, driver) {
    try {
      const productCode = product.productCode || product.id || product.key;
      
      // Skip if no valid product code
      if (!productCode) {
        logger.warn('No valid product code found for recovery', { 
          product: {
            productCode: product.productCode,
            id: product.id,
            key: product.key
          }
        });
        return product;
      }
      
      // Check if we've already attempted recovery for this product
      const attempts = this.recoveryAttempts.get(productCode) || 0;
      if (attempts >= this.maxRecoveryAttempts) {
        logger.warn('Max recovery attempts reached for product', { 
          productCode,
          attempts,
          maxAttempts: this.maxRecoveryAttempts
        });
        return product;
      }

      // Increment attempt counter
      this.recoveryAttempts.set(productCode, attempts + 1);

      // Determine platform from storeType
      const platform = product.storeType?.toLowerCase() || 'amazon';
      
      // Build source URL with pagination
      const sourceUrl = this.buildSourceUrlWithPagination(
        product.productUrl || product.sourceUrl, 
        platform
      );

      logger.info('Attempting missing data recovery', {
        productCode,
        platform,
        sourceUrl,
        attempt: attempts + 1,
        missingFields: {
          title: !product.title,
          brand: !product.brand,
          price: !product.price,
          photo: !product.photo
        }
      });

      // Get enhanced selectors
      const selectors = this.getEnhancedSelectors(platform, 'searchPage');
      
      // Load page configuration
      let pageConfig = {};
      try {
        pageConfig = await loadConfig(platform, 'searchPage');
      } catch (error) {
        logger.warn('Failed to load page config, using default', { 
          platform, 
          error: error.message 
        });
      }
      
      // Scrape the page with enhanced selectors
      let scrapedData = null;
      try {
        scrapedData = await scrapePage(
          sourceUrl,
          'searchPage',
          driver,
          platform,
          selectors,
          pageConfig
        );
      } catch (error) {
        logger.error('Failed to scrape page for recovery', { 
          sourceUrl, 
          platform, 
          error: error.message 
        });
        return product;
      }

      if (scrapedData && scrapedData.products && scrapedData.products.length > 0) {
        // Find the matching product in scraped data
        const productIdentifier = this.extractProductIdentifier(
          product.productUrl || product.sourceUrl, 
          platform
        );
        
        let matchingProduct = null;
        
        if (productIdentifier) {
          // Try to find exact match by identifier
          matchingProduct = scrapedData.products.find(p => 
            p.productCode === productIdentifier || 
            p.asin === productIdentifier ||
            p.productId === productIdentifier
          );
        }
        
        // If no exact match, try to find by title similarity
        if (!matchingProduct && product.title) {
          matchingProduct = scrapedData.products.find(p => 
            p.title && product.title && 
            p.title.toLowerCase().includes(product.title.toLowerCase().substring(0, 20))
          );
        }
        
        // If still no match, use the first product as fallback
        if (!matchingProduct) {
          matchingProduct = scrapedData.products[0];
        }

        if (matchingProduct) {
          // Update missing fields
          const updatedProduct = { ...product };
          
          if (!updatedProduct.title && matchingProduct.title) {
            updatedProduct.title = matchingProduct.title;
            logger.info('Recovered title', { productCode, title: matchingProduct.title });
          }
          
          if (!updatedProduct.brand && matchingProduct.brand) {
            updatedProduct.brand = matchingProduct.brand;
            logger.info('Recovered brand', { productCode, brand: matchingProduct.brand });
          }
          
          if (!updatedProduct.price && matchingProduct.price) {
            updatedProduct.price = matchingProduct.price;
            logger.info('Recovered price', { productCode, price: matchingProduct.price });
          }
          
          if (!updatedProduct.photo && matchingProduct.photo) {
            updatedProduct.photo = matchingProduct.photo;
            logger.info('Recovered photo', { productCode, photo: matchingProduct.photo });
          }

          // Update other useful fields if missing
          if (!updatedProduct.rating && matchingProduct.rating) {
            updatedProduct.rating = matchingProduct.rating;
          }
          
          if (!updatedProduct.reviewsCount && matchingProduct.reviewsCount) {
            updatedProduct.reviewsCount = matchingProduct.reviewsCount;
          }

          // Mark as recovered
          updatedProduct.dataRecovered = true;
          updatedProduct.recoverySource = sourceUrl;
          updatedProduct.recoveryTimestamp = Date.now();

          // Clear recovery attempts for this product since it was successfully recovered
          this.recoveryAttempts.delete(productCode);

          logger.info('Successfully recovered missing data', {
            productCode,
            recoveredFields: {
              title: !!updatedProduct.title,
              brand: !!updatedProduct.brand,
              price: !!updatedProduct.price,
              photo: !!updatedProduct.photo
            }
          });

          return updatedProduct;
        }
      }

      logger.warn('No matching product found for recovery', { productCode, sourceUrl });
      return product;

    } catch (error) {
      logger.error('Error in missing data recovery', {
        productCode: product.productCode || product.id,
        error: error.message,
        stack: error.stack
      });
      return product;
    }
  }

  /**
   * Process multiple products for missing data recovery
   */
  async processProductsForRecovery(products, driver) {
    const results = {
      processed: 0,
      recovered: 0,
      failed: 0,
      errors: []
    };

    for (const product of products) {
      try {
        results.processed++;
        
        if (this.isMissingCriticalData(product)) {
          const recoveredProduct = await this.recoverMissingData(product, driver);
          
          if (recoveredProduct.dataRecovered) {
            results.recovered++;
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          productCode: product.productCode || product.id,
          error: error.message
        });
      }
    }

    logger.info('Missing data recovery batch completed', results);
    return results;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return {
      totalAttempts: this.recoveryAttempts.size,
      attemptsByProduct: Object.fromEntries(this.recoveryAttempts)
    };
  }

  /**
   * Reset recovery attempts for a product
   */
  resetRecoveryAttempts(productCode) {
    this.recoveryAttempts.delete(productCode);
  }

  /**
   * Clear all recovery attempts
   */
  clearAllRecoveryAttempts() {
    this.recoveryAttempts.clear();
  }

  /**
   * Reset recovery attempts for products that no longer have missing data
   */
  resetRecoveryAttemptsForCompleteProducts(products) {
    let resetCount = 0;
    
    for (const product of products) {
      const productCode = product.productCode || product.id || product.key;
      
      if (productCode && !this.isMissingCriticalData(product)) {
        if (this.recoveryAttempts.has(productCode)) {
          this.recoveryAttempts.delete(productCode);
          resetCount++;
        }
      }
    }
    
    logger.info('Reset recovery attempts for complete products', { resetCount });
    return resetCount;
  }
}

module.exports = new MissingDataRecoveryService();
