const { getModuleLogger } = require("../logger/logger");
const { productDealsDB } = require("../database/firebaseDB/productDealsDB");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
const { getExtrapeUrl } = require("../affiliate/extrape");
const constants = require("../config/constants");

const logger = getModuleLogger('productUrlFixer');

class ProductUrlFixer {
  constructor() {
    this.fixedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.fixLog = [];
  }

  /**
   * Main function to verify and fix all product URLs in the database
   */
  async fixAllProductUrls() {
    if (!constants.enableProductUrlFix) {
      logger.info('Product URL fixing is disabled via flag');
      return { success: false, reason: 'disabled' };
    }

    logger.info('Starting product URL verification and fixing process...');
    
    try {
      // Get all products from productdeals database
      const snapshot = await productDealsDB.ref.once('value');
      const products = snapshot.val() || {};
      
      logger.info(`Found ${Object.keys(products).length} products to verify`);
      
      // Process each product
      for (const [productId, product] of Object.entries(products)) {
        if (!product || !product.links) continue;
        
        await this.fixProductUrl(productId, product);
      }
      
      // Also process deals database for safety
      await this.fixDealsDatabaseUrls();
      
      const summary = {
        totalProcessed: Object.keys(products).length,
        fixed: this.fixedCount,
        errors: this.errorCount,
        skipped: this.skippedCount,
        fixLog: this.fixLog
      };
      
      logger.info('Product URL fixing completed', summary);
      return { success: true, summary };
      
    } catch (error) {
      logger.error('Error in product URL fixing process:', { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix URLs for a single product
   */
  async fixProductUrl(productId, product) {
    try {
      const platform = this.detectPlatform(product);
      const currentUrl = product.links?.avinashbmvINR || '';
      
      if (!currentUrl) {
        this.skippedCount++;
        logger.debug(`Skipping product ${productId} - no avinashbmvINR URL`);
        return;
      }
      
      const expectedUrl = await this.generateCorrectUrl(product, platform, currentUrl);
      
      if (expectedUrl && expectedUrl !== currentUrl) {
        // Update the URL in database
        await productDealsDB.ref.child(productId).child('links').child('avinashbmvINR').set(expectedUrl);
        
        this.fixedCount++;
        this.fixLog.push({
          productId,
          platform,
          oldUrl: currentUrl,
          newUrl: expectedUrl,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Fixed URL for product ${productId}`, {
          platform,
          oldUrl: currentUrl,
          newUrl: expectedUrl
        });
      } else {
        this.skippedCount++;
        logger.debug(`URL already correct for product ${productId}`);
      }
      
    } catch (error) {
      this.errorCount++;
      logger.error(`Error fixing URL for product ${productId}:`, { error: error.message });
    }
  }

  /**
   * Detect platform from product data
   */
  detectPlatform(product) {
    // Check productUrl first
    if (product.productUrl) {
      if (product.productUrl.includes('amazon.')) return 'amazon';
      if (product.productUrl.includes('flipkart.')) return 'flipkart';
      if (product.productUrl.includes('myntra.')) return 'myntra';
      if (product.productUrl.includes('ajio.')) return 'ajio';
    }
    
    // Check avinashbmvINR URL
    if (product.links?.avinashbmvINR) {
      if (product.links.avinashbmvINR.includes('amazon.')) return 'amazon';
      if (product.links.avinashbmvINR.includes('flipkart.')) return 'flipkart';
      if (product.links.avinashbmvINR.includes('myntra.')) return 'myntra';
      if (product.links.avinashbmvINR.includes('ajio.')) return 'ajio';
    }
    
    return 'unknown';
  }

  /**
   * Generate the correct URL for a product based on platform
   */
  async generateCorrectUrl(product, platform, currentUrl) {
    try {
      switch (platform) {
        case 'amazon':
          return await this.generateAmazonUrl(product, currentUrl);
        case 'flipkart':
        case 'myntra':
        case 'ajio':
          return await this.generateNonAmazonUrl(product, currentUrl);
        default:
          logger.warn(`Unknown platform for product: ${platform}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error generating URL for platform ${platform}:`, { error: error.message });
      return null;
    }
  }

  /**
   * Generate correct Amazon URL
   */
  async generateAmazonUrl(product, currentUrl) {
    try {
      // Check if current URL has inrdeals.com (blunder case)
      if (currentUrl.includes('inrdeals.com')) {
        logger.warn('Amazon product has inrdeals.com URL - attempting to fix');
        
        // Try to use amazonLinkGenerator if we have a driver
        if (global.driver && product.productUrl) {
          try {
            const amazonLink = await amazonLinkGenerator(global.driver);
            if (amazonLink) {
              return amazonLink;
            }
          } catch (error) {
            logger.error('Error using amazonLinkGenerator:', { error: error.message });
          }
        }
        
        // Fallback: try to extract productCode from productUrl
        if (product.productUrl) {
          const productCode = this.extractAmazonProductCode(product.productUrl);
          if (productCode) {
            // Use original productUrl and add tag, don't reconstruct with title
            const hasQuery = product.productUrl.includes('?');
            return product.productUrl + (hasQuery ? '&' : '?') + 'tag=dealshubglo0c-21';
          }
        }
        
        return null;
      }
      
      // Check if current URL has correct tag
      if (!currentUrl.includes('tag=dealshubglo0c-21')) {
        // Add or fix the tag
        const hasQuery = currentUrl.includes('?');
        const hasTag = /[?&]tag=/.test(currentUrl);
        
        if (hasTag) {
          return currentUrl.replace(/([?&]tag=)[^&]*/i, '$1dealshubglo0c-21');
        } else {
          return currentUrl + (hasQuery ? '&' : '?') + 'tag=dealshubglo0c-21';
        }
      }
      
      return currentUrl; // URL is already correct
      
    } catch (error) {
      logger.error('Error generating Amazon URL:', { error: error.message });
      return null;
    }
  }

  /**
   * Generate correct non-Amazon URL
   */
  async generateNonAmazonUrl(product, currentUrl) {
    try {
      // Check if current URL has tag=dealshubglo0c-21 (blunder case)
      if (currentUrl.includes('tag=dealshubglo0c-21')) {
        logger.warn('Non-Amazon product has Amazon tag - attempting to fix');
        
        // Try to use extrape if we have a driver
        if (global.driver && product.productUrl) {
          try {
            const extrapeUrl = await getExtrapeUrl(global.driver, product.productUrl);
            if (extrapeUrl) {
              return extrapeUrl;
            }
          } catch (error) {
            logger.error('Error using extrape:', { error: error.message });
          }
        }
        
        // Fallback: use productUrl with inrdeals.com wrapper
        if (product.productUrl) {
          return `inrdeals.com/avi646476329/${product.productUrl}`;
        }
        
        return null;
      }
      
      // Check if current URL is already in correct format
      if (currentUrl.startsWith('inrdeals.com/avi646476329/')) {
        return currentUrl; // URL is already correct
      }
      
      // If URL doesn't start with inrdeals.com, wrap it
      if (product.productUrl) {
        return `inrdeals.com/avi646476329/${product.productUrl}`;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Error generating non-Amazon URL:', { error: error.message });
      return null;
    }
  }

  /**
   * Extract Amazon product code from URL
   */
  extractAmazonProductCode(url) {
    try {
      const match = url.match(/\/dp\/([A-Z0-9]{10})/);
      return match ? match[1] : null;
    } catch (error) {
      logger.error('Error extracting Amazon product code:', { error: error.message });
      return null;
    }
  }

  /**
   * Sanitize title for URL
   */
  sanitizeTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Fix URLs in deals database for safety
   */
  async fixDealsDatabaseUrls() {
    try {
      logger.info('Starting deals database URL verification...');
      
      // Get deals database reference
      const dealsRef = productDealsDB.ref.parent?.child('deals');
      if (!dealsRef) {
        logger.warn('Deals database reference not found');
        return;
      }
      
      const snapshot = await dealsRef.once('value');
      const deals = snapshot.val() || {};
      
      logger.info(`Found ${Object.keys(deals).length} deals to verify`);
      
      // Process each deal
      for (const [dealId, deal] of Object.entries(deals)) {
        if (!deal || !deal.links) continue;
        
        await this.fixProductUrl(dealId, deal);
      }
      
      logger.info('Deals database URL verification completed');
      
    } catch (error) {
      logger.error('Error fixing deals database URLs:', { error: error.message });
    }
  }

  /**
   * Get fix statistics
   */
  getStatistics() {
    return {
      fixed: this.fixedCount,
      errors: this.errorCount,
      skipped: this.skippedCount,
      total: this.fixedCount + this.errorCount + this.skippedCount,
      fixLog: this.fixLog
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.fixedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.fixLog = [];
  }
}

// Create singleton instance
const productUrlFixer = new ProductUrlFixer();

module.exports = { productUrlFixer };
