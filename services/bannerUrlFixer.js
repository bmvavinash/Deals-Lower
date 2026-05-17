const { getModuleLogger } = require("../logger/logger");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
const { getExtrapeUrl } = require("../affiliate/extrape");
const constants = require("../config/constants");

const logger = getModuleLogger('bannerUrlFixer');

class BannerUrlFixer {
  constructor() {
    this.fixedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
    this.fixLog = [];
  }

  /**
   * Fix URLs for a single banner
   */
  async fixBannerUrl(banner) {
    try {
      const platform = this.detectPlatform(banner);
      const currentUrl = banner.clickRedirectUrl || '';
      
      if (!currentUrl) {
        this.skippedCount++;
        logger.debug(`Skipping banner ${banner.id} - no clickRedirectUrl`);
        return banner;
      }
      
      const expectedUrl = await this.generateCorrectUrl(banner, platform, currentUrl);
      
      if (expectedUrl && expectedUrl !== currentUrl) {
        // Update the banner with the fixed URL
        const fixedBanner = {
          ...banner,
          clickRedirectUrl: expectedUrl,
          originalUrl: currentUrl,
          urlFixed: true,
          urlFixTimestamp: new Date().toISOString()
        };
        
        this.fixedCount++;
        this.fixLog.push({
          bannerId: banner.id,
          platform,
          oldUrl: currentUrl,
          newUrl: expectedUrl,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Fixed URL for banner ${banner.id}`, {
          platform,
          oldUrl: currentUrl,
          newUrl: expectedUrl
        });
        
        return fixedBanner;
      } else {
        this.skippedCount++;
        logger.debug(`URL already correct for banner ${banner.id}`);
        return banner;
      }
      
    } catch (error) {
      this.errorCount++;
      logger.error(`Error fixing URL for banner ${banner.id}:`, { error: error.message });
      return banner; // Return original banner on error
    }
  }

  /**
   * Detect platform from banner data
   */
  detectPlatform(banner) {
    // Check clickRedirectUrl first
    if (banner.clickRedirectUrl) {
      if (banner.clickRedirectUrl.includes('amazon.')) return 'amazon';
      if (banner.clickRedirectUrl.includes('flipkart.')) return 'flipkart';
      if (banner.clickRedirectUrl.includes('myntra.')) return 'myntra';
      if (banner.clickRedirectUrl.includes('ajio.')) return 'ajio';
    }
    
    // Check platform field
    if (banner.platform) {
      return banner.platform.toLowerCase();
    }
    
    return 'unknown';
  }

  /**
   * Generate the correct URL for a banner based on platform
   */
  async generateCorrectUrl(banner, platform, currentUrl) {
    try {
      switch (platform) {
        case 'amazon':
          return await this.generateAmazonUrl(banner, currentUrl);
        case 'flipkart':
        case 'myntra':
        case 'ajio':
          return await this.generateNonAmazonUrl(banner, currentUrl);
        default:
          logger.warn(`Unknown platform for banner: ${platform}`);
          return null;
      }
    } catch (error) {
      logger.error(`Error generating URL for platform ${platform}:`, { error: error.message });
      return null;
    }
  }

  /**
   * Generate correct Amazon URL for banner
   */
  async generateAmazonUrl(banner, currentUrl) {
    try {
      // Check if current URL has inrdeals.com (blunder case)
      if (currentUrl.includes('inrdeals.com')) {
        logger.warn('Amazon banner has inrdeals.com URL - attempting to fix');
        
        // Try to use amazonLinkGenerator if we have a driver
        if (global.driver) {
          try {
            // Navigate to the product page first
            await global.driver.get(currentUrl);
            const amazonLink = await amazonLinkGenerator(global.driver);
            if (amazonLink) {
              return amazonLink;
            }
          } catch (error) {
            logger.error('Error using amazonLinkGenerator for banner:', { error: error.message });
          }
        }
        
        // Fallback: try to extract productCode and reconstruct URL
        const productCode = this.extractAmazonProductCode(currentUrl);
        if (productCode) {
          return `https://www.amazon.in/dp/${productCode}/?tag=dealshubglo0c-21`;
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
      logger.error('Error generating Amazon URL for banner:', { error: error.message });
      return null;
    }
  }

  /**
   * Generate correct non-Amazon URL for banner
   */
  async generateNonAmazonUrl(banner, currentUrl) {
    try {
      // Check if current URL has tag=dealshubglo0c-21 (blunder case)
      if (currentUrl.includes('tag=dealshubglo0c-21')) {
        logger.warn('Non-Amazon banner has Amazon tag - attempting to fix');
        
        // Try to use extrape if we have a driver
        if (global.driver) {
          try {
            const extrapeUrl = await getExtrapeUrl(global.driver, currentUrl);
            if (extrapeUrl) {
              return extrapeUrl;
            }
          } catch (error) {
            logger.error('Error using extrape for banner:', { error: error.message });
          }
        }
        
        // Fallback: use inrdeals.com wrapper with https://
        const cleanUrl = currentUrl.replace(/^https?:\/\//, '').replace(/^inrdeals\.com\/avi646476329\//, '');
        return `https://inrdeals.com/avi646476329/${cleanUrl}`;
      }
      
      // Check if current URL is already in correct format
      if (currentUrl.includes('inrdeals.com/avi646476329/')) {
        // Ensure it has https://
        if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
          return `https://${currentUrl}`;
        }
        return currentUrl; // URL is already correct
      }
      
      // If URL doesn't start with inrdeals.com, wrap it with https://
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      return `https://inrdeals.com/avi646476329/${cleanUrl}`;
      
    } catch (error) {
      logger.error('Error generating non-Amazon URL for banner:', { error: error.message });
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
   * Fix URLs for multiple banners
   */
  async fixBannerUrls(banners) {
    if (!constants.enableProductUrlFix) {
      logger.info('Banner URL fixing is disabled via flag');
      return banners;
    }

    logger.info(`Starting banner URL verification and fixing for ${banners.length} banners...`);
    
    const fixedBanners = [];
    
    for (const banner of banners) {
      const fixedBanner = await this.fixBannerUrl(banner);
      fixedBanners.push(fixedBanner);
    }
    
    const summary = {
      totalProcessed: banners.length,
      fixed: this.fixedCount,
      errors: this.errorCount,
      skipped: this.skippedCount,
      fixLog: this.fixLog
    };
    
    logger.info('Banner URL fixing completed', summary);
    return fixedBanners;
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
const bannerUrlFixer = new BannerUrlFixer();

module.exports = { bannerUrlFixer };
