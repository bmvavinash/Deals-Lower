const express = require('express');
const router = express.Router();
const { bannerDB, testBannerDB } = require('../../../database/firebaseDB/bannerDB');
const { getModuleLogger } = require('../../../logger/logger');
const { BannerExtractor } = require('../../../dataSources/bannerExtractor');
const { bannerUrlFixer } = require('../../../services/bannerUrlFixer');

const logger = getModuleLogger('banners-api');

// Helpers to normalize and deduplicate banners
// Use URL-based uniqueness: image URL or clickRedirectUrl (whichever is available)
const normalizeValue = (value) => (value || '').toString().trim().toLowerCase();
const normalizeUrl = (url) => {
  if (!url) return '';
  // Remove query parameters and fragments for better matching
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (e) {
    // If URL parsing fails, return normalized string
    return normalizeValue(url);
  }
};

const buildBannerKey = (banner = {}) => {
  // Primary: Use image URL (banner.url)
  const imageUrl = normalizeUrl(banner.url);
  // Secondary: Use clickRedirectUrl if image URL is not available
  const clickUrl = normalizeUrl(banner.clickRedirectUrl);
  
  // Use image URL as primary key, fallback to clickRedirectUrl
  const primaryUrl = imageUrl || clickUrl;
  
  if (!primaryUrl) {
    // If no URL available, fallback to ID
    return banner.id ? `id:${banner.id}` : null;
  }
  
  // Return normalized URL as the key
  return primaryUrl;
};

const dedupeBannerArray = (bannerArray = []) => {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  bannerArray.forEach((banner) => {
    const key = buildBannerKey(banner);
    if (key && seen.has(key)) {
      duplicates.push(banner);
      return;
    }
    if (key) seen.add(key);
    unique.push(banner);
  });

  return { unique, duplicates };
};

// Store the current source globally (default: test-banners.json)
let bannerSource = 'test-banners';

/**
 * GET /api/banners/source
 * Get current banner source (test-banners or production)
 */
router.get('/source', (req, res) => {
  res.json({
    success: true,
    data: {
      current: bannerSource,
      available: ['test-banners', 'production']
    }
  });
});

/**
 * POST /api/banners/source/toggle
 * Toggle banner source between test-banners.json and production
 */
router.post('/source/toggle', (req, res) => {
  const previousSource = bannerSource;
  bannerSource = bannerSource === 'test-banners' ? 'production' : 'test-banners';
  
  logger.info(`Banner source toggled from ${previousSource} to ${bannerSource}`);
  
  res.json({
    success: true,
    message: `Switched from ${previousSource} to ${bannerSource}`,
    data: {
      previous: previousSource,
      current: bannerSource
    }
  });
});

/**
 * POST /api/banners/source/set
 * Set banner source explicitly
 * Body: { source: "test-banners" | "production" }
 */
router.post('/source/set', (req, res) => {
  const { source } = req.body;
  
  if (!source || !['test-banners', 'production'].includes(source)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid source. Must be "test-banners" or "production"'
    });
  }
  
  const previousSource = bannerSource;
  bannerSource = source;
  
  logger.info(`Banner source set to ${source}`);
  
  res.json({
    success: true,
    message: `Source set to ${source}`,
    data: {
      previous: previousSource,
      current: bannerSource
    }
  });
});

/**
 * POST /api/banners/trigger
 * Trigger fetching banners from configured source
 * Returns banner details after fetching
 */
router.post('/trigger', async (req, res, next) => {
  try {
    logger.info(`Triggering banner fetch from ${bannerSource}`);
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    const result = await bannerDbInstance.getAllBanners ? 
      await bannerDbInstance.getAllBanners() : 
      await bannerDbInstance.getAllTestBanners();
    
    if (result.status !== 200) {
      return res.status(result.status || 500).json({
        success: false,
        error: result.message || 'Error fetching banners',
        source: bannerSource
      });
    }
    
    const banners = result.data || {};
    const bannerArray = Object.entries(banners).map(([id, data]) => ({
      id,
      ...data
    }));

    const { unique, duplicates } = dedupeBannerArray(bannerArray);

    // Clean duplicates from test-banners store when possible
    if (bannerSource === 'test-banners' && duplicates.length > 0) {
      const duplicateIds = duplicates.map(b => b.id).filter(Boolean);
      if (duplicateIds.length > 0 && typeof testBannerDB.bulkDeleteTestBanners === 'function') {
        testBannerDB.bulkDeleteTestBanners(duplicateIds)
          .then(result => logger.info('Removed duplicate test banners', { removed: result.deleted, ids: duplicateIds }))
          .catch(err => logger.warn('Failed to remove duplicate test banners', { error: err.message }));
      }
    }
    
    // Calculate statistics
    const stats = {
    total: unique.length,
    active: unique.filter(b => b && b.isActive).length,
    inactive: unique.filter(b => b && !b.isActive).length,
      byPlatform: {},
      byCategory: {}
    };
    
  unique.forEach(banner => {
      if (banner && banner.platform) {
        stats.byPlatform[banner.platform] = (stats.byPlatform[banner.platform] || 0) + 1;
      }
      if (banner && banner.category) {
        stats.byCategory[banner.category] = (stats.byCategory[banner.category] || 0) + 1;
      }
    });
    
  logger.info(`Banner trigger completed. Source: ${bannerSource}, Total: ${unique.length}, DuplicatesRemoved: ${duplicates.length}`);
    
    res.json({
      success: true,
      source: bannerSource,
      data: {
      banners: unique,
        stats: stats,
      triggeredAt: new Date().toISOString(),
      dedupe: {
        removed: duplicates.length,
        duplicateIds: duplicates.map(b => b.id)
      }
      }
    });
  } catch (error) {
    logger.error('Error triggering banners', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/banners/stats
 * Get banner statistics
 * NOTE: Must be defined BEFORE /:id route to avoid route conflict
 */
router.get('/stats', async (req, res, next) => {
  try {
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    const result = await (bannerDbInstance.getAllBanners ? 
      bannerDbInstance.getAllBanners() : 
      bannerDbInstance.getAllTestBanners());
    
    if (result.status !== 200) {
      return res.status(result.status || 500).json({
        success: false,
        error: result.message || 'Error fetching banner statistics'
      });
    }
    
    const banners = result.data || {};
  const bannerArray = Object.values(banners);
  const { unique, duplicates } = dedupeBannerArray(bannerArray);
    
    const stats = {
    total: unique.length,
    active: unique.filter(b => b && b.isActive).length,
    inactive: unique.filter(b => b && !b.isActive).length,
      byPlatform: {},
    byCategory: {},
    source: bannerSource
    };
    
    // Calculate by platform
  unique.forEach(banner => {
      if (banner && banner.platform) {
        stats.byPlatform[banner.platform] = (stats.byPlatform[banner.platform] || 0) + 1;
      }
      if (banner && banner.category) {
        stats.byCategory[banner.category] = (stats.byCategory[banner.category] || 0) + 1;
      }
    });
    
    res.json({ 
      success: true, 
    data: {
      ...stats,
      duplicatesRemoved: duplicates.length
    } 
    });
  } catch (error) {
    logger.error('Error getting banner stats', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/banners
 * Get all banners with optional filters
 * Query params: platform, activeOnly, source
 */
router.get('/', async (req, res, next) => {
  try {
    const { platform, activeOnly, source } = req.query;
    
    // Allow overriding source in query
    const currentSource = source || bannerSource;
    const bannerDbInstance = currentSource === 'test-banners' ? testBannerDB : bannerDB;
    
    let result;
    
    if (platform) {
      result = bannerDbInstance.getBannersByPlatform ? 
        await bannerDbInstance.getBannersByPlatform(platform) :
        await bannerDbInstance.getTestBannersByPlatform(platform);
    } else if (activeOnly === 'true') {
      result = bannerDbInstance.getActiveBanners ? 
        await bannerDbInstance.getActiveBanners() :
        await bannerDbInstance.getActiveTestBanners();
    } else {
      result = bannerDbInstance.getAllBanners ? 
        await bannerDbInstance.getAllBanners() :
        await bannerDbInstance.getAllTestBanners();
    }
    
    if (result.status === 200) {
    const rawData = result.data || {};
    const bannerArray = Array.isArray(rawData) ? rawData : Object.entries(rawData).map(([id, data]) => ({ id, ...data }));
    const { unique, duplicates } = dedupeBannerArray(bannerArray);
    const normalized = unique.reduce((acc, banner) => {
      acc[banner.id] = banner;
      return acc;
    }, {});

      res.json({ 
        success: true, 
      data: normalized,
      source: currentSource,
      dedupe: {
        removed: duplicates.length,
        duplicateIds: duplicates.map(b => b.id)
      }
      });
    } else {
      res.status(result.status || 500).json({ 
        success: false, 
        error: result.message || 'Error fetching banners' 
      });
    }
  } catch (error) {
    logger.error('Error getting banners', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/:id/toggle-active
 * Toggle banner active status
 */
router.post('/:id/toggle-active', async (req, res, next) => {
  try {
    const bannerId = req.params.id;
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // First get current banner status
    const getBannerResult = bannerDbInstance.getBanner ? 
      await bannerDbInstance.getBanner(bannerId) :
      await bannerDbInstance.getTestBanner(bannerId);
    
    if (getBannerResult.status !== 200) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }
    
    const currentBanner = getBannerResult.data;
    const newStatus = !currentBanner.isActive;
    
    // Update the banner
    const updateResult = bannerDbInstance.storeBanner ? 
      await bannerDbInstance.storeBanner({
        ...currentBanner,
        id: bannerId,
        isActive: newStatus,
        updateTimestamp: new Date().toISOString()
      }) :
      await bannerDbInstance.storeTestBanner({
        ...currentBanner,
        id: bannerId,
        isActive: newStatus,
        updateTimestamp: new Date().toISOString()
      });
    
    if (updateResult.status === 200 || updateResult.status === 201) {
      logger.info(`Banner ${bannerId} active status toggled to ${newStatus}`);
      res.json({
        success: true,
        message: `Banner ${newStatus ? 'activated' : 'deactivated'}`,
        data: {
          bannerId,
          isActive: newStatus,
          previousStatus: currentBanner.isActive
        }
      });
    } else {
      res.status(updateResult.status || 500).json({
        success: false,
        error: updateResult.message || 'Failed to toggle banner status'
      });
    }
  } catch (error) {
    logger.error('Error toggling banner status', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/:id/mark-product-image
 * Mark/unmark a banner as a product image
 * Body: { isProductImage: true | false }
 */
router.post('/:id/mark-product-image', async (req, res, next) => {
  try {
    const bannerId = req.params.id;
    const { isProductImage } = req.body;
    
    if (typeof isProductImage !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isProductImage must be a boolean'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // First get current banner
    const getBannerResult = bannerDbInstance.getBanner ? 
      await bannerDbInstance.getBanner(bannerId) :
      await bannerDbInstance.getTestBanner(bannerId);
    
    if (getBannerResult.status !== 200) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }
    
    const currentBanner = getBannerResult.data;
    
    // Update the banner
    const updateResult = bannerDbInstance.storeBanner ? 
      await bannerDbInstance.storeBanner({
        ...currentBanner,
        id: bannerId,
        isProductImage: isProductImage,
        updateTimestamp: new Date().toISOString()
      }) :
      await bannerDbInstance.storeTestBanner({
        ...currentBanner,
        id: bannerId,
        isProductImage: isProductImage,
        updateTimestamp: new Date().toISOString()
      });
    
    if (updateResult.status === 200 || updateResult.status === 201) {
      logger.info(`Banner ${bannerId} marked as ${isProductImage ? 'product image' : 'not product image'}`);
      res.json({
        success: true,
        message: `Banner ${isProductImage ? 'marked as product image' : 'unmarked as product image'}`,
        data: {
          bannerId,
          isProductImage: isProductImage
        }
      });
    } else {
      res.status(updateResult.status || 500).json({
        success: false,
        error: updateResult.message || 'Failed to mark banner'
      });
    }
  } catch (error) {
    logger.error('Error marking banner as product image', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/bulk-mark-product-image
 * Mark/unmark multiple banners as product images
 * Body: { bannerIds: string[], isProductImage: true | false }
 */
router.post('/bulk-mark-product-image', async (req, res, next) => {
  try {
    const { bannerIds, isProductImage } = req.body;
    
    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'bannerIds must be a non-empty array'
      });
    }
    
    if (typeof isProductImage !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isProductImage must be a boolean'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const bannerId of bannerIds) {
      try {
        // Get current banner
        const getBannerResult = bannerDbInstance.getBanner ? 
          await bannerDbInstance.getBanner(bannerId) :
          await bannerDbInstance.getTestBanner(bannerId);
        
        if (getBannerResult.status !== 200) {
          errorCount++;
          results.push({ bannerId, success: false, error: 'Banner not found' });
          continue;
        }
        
        const currentBanner = getBannerResult.data;
        
        // Update the banner
        const updateResult = bannerDbInstance.storeBanner ? 
          await bannerDbInstance.storeBanner({
            ...currentBanner,
            id: bannerId,
            isProductImage: isProductImage,
            updateTimestamp: new Date().toISOString()
          }) :
          await bannerDbInstance.storeTestBanner({
            ...currentBanner,
            id: bannerId,
            isProductImage: isProductImage,
            updateTimestamp: new Date().toISOString()
          });
        
        if (updateResult.status === 200 || updateResult.status === 201) {
          successCount++;
          results.push({ bannerId, success: true });
        } else {
          errorCount++;
          results.push({ bannerId, success: false, error: updateResult.message });
        }
      } catch (error) {
        errorCount++;
        results.push({ bannerId, success: false, error: error.message });
      }
    }
    
    logger.info(`Bulk marked ${successCount} banners as ${isProductImage ? 'product images' : 'not product images'}`);
    res.json({
      success: true,
      message: `Marked ${successCount} banner(s) as ${isProductImage ? 'product images' : 'not product images'}`,
      data: {
        total: bannerIds.length,
        success: successCount,
        errors: errorCount,
        results: results
      }
    });
  } catch (error) {
    logger.error('Error bulk marking banners as product images', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/:id/set-active
 * Set banner active status explicitly
 * Body: { isActive: true | false }
 */
router.post('/:id/set-active', async (req, res, next) => {
  try {
    const bannerId = req.params.id;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // First get current banner
    const getBannerResult = bannerDbInstance.getBanner ? 
      await bannerDbInstance.getBanner(bannerId) :
      await bannerDbInstance.getTestBanner(bannerId);
    
    if (getBannerResult.status !== 200) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found'
      });
    }
    
    const currentBanner = getBannerResult.data;
    
    // Update the banner
    const updateResult = bannerDbInstance.storeBanner ? 
      await bannerDbInstance.storeBanner({
        ...currentBanner,
        id: bannerId,
        isActive,
        updateTimestamp: new Date().toISOString()
      }) :
      await bannerDbInstance.storeTestBanner({
        ...currentBanner,
        id: bannerId,
        isActive,
        updateTimestamp: new Date().toISOString()
      });
    
    if (updateResult.status === 200 || updateResult.status === 201) {
      logger.info(`Banner ${bannerId} active status set to ${isActive}`);
      res.json({
        success: true,
        message: `Banner ${isActive ? 'activated' : 'deactivated'}`,
        data: {
          bannerId,
          isActive,
          previousStatus: currentBanner.isActive
        }
      });
    } else {
      res.status(updateResult.status || 500).json({
        success: false,
        error: updateResult.message || 'Failed to set banner status'
      });
    }
  } catch (error) {
    logger.error('Error setting banner status', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/extract-all
 * Extract banners from all stores/platforms and store them in DB
 * All banners will be stored with isActive: false (visibility off)
 * Returns extraction results with counts
 */
router.post('/extract-all', async (req, res, next) => {
  try {
    logger.info(`Starting banner extraction from all stores (source: ${bannerSource})`);
    
    // Create extractor with visibility OFF by default
    // Use normal headless browser (no Chrome debugger needed for banners)
    const extractor = new BannerExtractor({ 
      visibility: false, // Ensure all banners are stored with isActive: false
      useExistingChrome: false, // Always use headless browser for banners (no login needed)
      requiresLogin: false // Banners don't require login
    });
    
    // Extract banners from all platforms
    const extractedBanners = await extractor.extractAllBanners();
    logger.info(`Extracted ${extractedBanners.length} banners from all platforms`);
    
    // Fix URLs if needed
    let processedBanners = extractedBanners;
    if (extractedBanners.length > 0) {
      logger.info('Starting banner URL verification and fixing...');
      processedBanners = await bannerUrlFixer.fixBannerUrls(extractedBanners);
      
      const urlFixStats = bannerUrlFixer.getStatistics();
      logger.info('Banner URL fixing completed', {
        total: urlFixStats.total,
        fixed: urlFixStats.fixed,
        errors: urlFixStats.errors,
        skipped: urlFixStats.skipped
      });
    }
    
    // Ensure all banners have isActive: false
    processedBanners = processedBanners.map(banner => ({
      ...banner,
      isActive: false // Force visibility OFF
    }));
    
    // Store banners in the current source (test-banners or production)
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    let storeResult;
    if (bannerSource === 'test-banners') {
      storeResult = await testBannerDB.storeMultipleTestBanners(processedBanners);
    } else {
      storeResult = await bannerDB.storeMultipleBanners(processedBanners);
    }
    
    // Count successful stores, duplicates skipped, and product images filtered
    const stored = storeResult.filter(r => r.status === 200 || r.status === 201).length;
    const duplicates = storeResult.filter(r => r.status === 409).length;
    const productImagesFiltered = storeResult.filter(r => r.status === 410).length;
    const errors = storeResult.filter(r => r.status === 500).length;
    
    logger.info(`Banner extraction completed. Extracted: ${extractedBanners.length}, Stored: ${stored}, Duplicates: ${duplicates}, Product Images Filtered: ${productImagesFiltered}, Errors: ${errors}`);
    
    res.json({
      success: true,
      source: bannerSource,
      data: {
        extracted: extractedBanners.length,
        stored: stored,
        duplicates: duplicates,
        productImagesFiltered: productImagesFiltered,
        errors: errors,
        allInactive: true, // All banners stored with isActive: false
        extractedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error extracting banners from all stores', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract banners from all stores'
    });
  }
});

/**
 * DELETE /api/banners/:id
 * Delete a specific banner by ID
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const bannerId = req.params.id;
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    const deleteResult = bannerDbInstance.deleteBanner ? 
      await bannerDbInstance.deleteBanner(bannerId) :
      await bannerDbInstance.deleteTestBanner(bannerId);
    
    if (deleteResult.status === 200) {
      logger.info(`Banner ${bannerId} deleted successfully`);
      res.json({
        success: true,
        message: 'Banner deleted successfully',
        data: {
          bannerId,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete banner'
      });
    }
  } catch (error) {
    logger.error('Error deleting banner', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/bulk-delete
 * Delete multiple banners by IDs
 * Body: { bannerIds: string[] }
 */
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { bannerIds } = req.body;
    
    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'bannerIds must be a non-empty array'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    const deleteResult = bannerDbInstance.bulkDeleteBanners ? 
      await bannerDbInstance.bulkDeleteBanners(bannerIds) :
      await bannerDbInstance.bulkDeleteTestBanners(bannerIds);
    
    if (deleteResult.status === 200) {
      logger.info(`Bulk deleted ${bannerIds.length} banners`);
      res.json({
        success: true,
        message: deleteResult.message || 'Banners deleted successfully',
        data: {
          deletedCount: deleteResult.deleted || bannerIds.length,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete banners'
      });
    }
  } catch (error) {
    logger.error('Error bulk deleting banners', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/delete-by-keyword
 * Delete all banners containing specific keywords
 * Body: { keywords: string[] }
 */
router.post('/delete-by-keyword', async (req, res, next) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'keywords must be a non-empty array'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // Get all banners
    const getAllResult = bannerDbInstance.getAllBanners ? 
      await bannerDbInstance.getAllBanners() :
      await bannerDbInstance.getAllTestBanners();
    
    if (getAllResult.status !== 200) {
      return res.status(getAllResult.status || 500).json({
        success: false,
        error: getAllResult.message || 'Failed to fetch banners'
      });
    }
    
    const allBanners = getAllResult.data || {};
    const bannersToDelete = [];
    
    // Find banners matching keywords
    for (const [bannerId, bannerData] of Object.entries(allBanners)) {
      const searchText = [
        bannerData.title || '',
        bannerData.description || '',
        bannerData.category || '',
        bannerData.platform || '',
        bannerData.url || ''
      ].join(' ').toLowerCase();
      
      // Check if any keyword matches
      const matches = keywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
      
      if (matches) {
        bannersToDelete.push(bannerId);
      }
    }
    
    if (bannersToDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No banners found matching the keywords',
        data: {
          deletedCount: 0,
          keywords: keywords
        }
      });
    }
    
    // Delete matching banners
    const deleteResult = bannerDbInstance.bulkDeleteBanners ? 
      await bannerDbInstance.bulkDeleteBanners(bannersToDelete) :
      await bannerDbInstance.bulkDeleteTestBanners(bannersToDelete);
    
    if (deleteResult.status === 200) {
      logger.info(`Deleted ${bannersToDelete.length} banners matching keywords: ${keywords.join(', ')}`);
      res.json({
        success: true,
        message: `Deleted ${bannersToDelete.length} banner(s) matching keywords`,
        data: {
          deletedCount: deleteResult.deleted || bannersToDelete.length,
          keywords: keywords,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete banners'
      });
    }
  } catch (error) {
    logger.error('Error deleting banners by keyword', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/delete-duplicates
 * Find and delete duplicate banners based on URL (image URL or clickRedirectUrl)
 * Keeps the first occurrence (oldest by creationTimestamp)
 * NOTE: This route must be defined BEFORE any /:id routes to avoid route conflicts
 */
router.post('/delete-duplicates', async (req, res, next) => {
  try {
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // Get all banners
    const getAllResult = bannerDbInstance.getAllBanners ? 
      await bannerDbInstance.getAllBanners() :
      await bannerDbInstance.getAllTestBanners();
    
    if (getAllResult.status !== 200) {
      return res.status(getAllResult.status || 500).json({
        success: false,
        error: getAllResult.message || 'Error fetching banners'
      });
    }
    
    const banners = getAllResult.data || {};
    const bannerArray = Object.entries(banners).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Find duplicates using URL-based key
    const urlMap = new Map(); // url -> array of banners with that URL
    bannerArray.forEach(banner => {
      const key = buildBannerKey(banner);
      if (key && !key.startsWith('id:')) { // Only process URL-based keys
        if (!urlMap.has(key)) {
          urlMap.set(key, []);
        }
        urlMap.get(key).push(banner);
      }
    });
    
    // Find duplicates (URLs with more than one banner)
    const duplicatesToDelete = [];
    urlMap.forEach((bannersWithSameUrl, urlKey) => {
      if (bannersWithSameUrl.length > 1) {
        // Sort by creationTimestamp (oldest first) - keep the first one
        bannersWithSameUrl.sort((a, b) => {
          const timeA = a.creationTimestamp || a.updateTimestamp || '';
          const timeB = b.creationTimestamp || b.updateTimestamp || '';
          return timeA.localeCompare(timeB);
        });
        
        // Mark all except the first one for deletion
        for (let i = 1; i < bannersWithSameUrl.length; i++) {
          duplicatesToDelete.push(bannersWithSameUrl[i].id);
        }
      }
    });
    
    if (duplicatesToDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicate banners found',
        data: {
          deletedCount: 0,
          duplicatesFound: 0
        }
      });
    }
    
    // Delete duplicates
    const deleteResult = bannerDbInstance.bulkDeleteBanners ? 
      await bannerDbInstance.bulkDeleteBanners(duplicatesToDelete) :
      await bannerDbInstance.bulkDeleteTestBanners(duplicatesToDelete);
    
    if (deleteResult.status === 200) {
      logger.info(`Deleted ${duplicatesToDelete.length} duplicate banners`);
      res.json({
        success: true,
        message: `Deleted ${duplicatesToDelete.length} duplicate banner(s)`,
        data: {
          deletedCount: deleteResult.deleted || duplicatesToDelete.length,
          duplicatesFound: duplicatesToDelete.length,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete duplicates'
      });
    }
  } catch (error) {
    logger.error('Error deleting duplicate banners', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/delete-product-images
 * Delete all banners that are likely product images
 */
router.post('/delete-product-images', async (req, res, next) => {
  try {
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // Get all banners
    const getAllResult = bannerDbInstance.getAllBanners ? 
      await bannerDbInstance.getAllBanners() :
      await bannerDbInstance.getAllTestBanners();
    
    if (getAllResult.status !== 200) {
      return res.status(getAllResult.status || 500).json({
        success: false,
        error: getAllResult.message || 'Failed to fetch banners'
      });
    }
    
    const allBanners = getAllResult.data || {};
    const bannersToDelete = [];
    
    // Product image patterns
    const productImagePatterns = [
      '/images/i/', '/images/g/', '._ac_', '/media/images/', // Amazon
      '/images/', '/product/', // Myntra/Ajio
      '/medias/', // Ajio
      '/150x150', '/200x200', '/250x250', '/300x300', // Small images
      'w=150', 'h=150', 'w=200', 'h=200', // Size parameters
      'thumbnail', 'thumb', 'small' // Thumbnail indicators
    ];
    
    // Product keywords
    const productKeywords = [
      'product', 'item', 'buy now', 'add to cart', 'price', '₹', 'rs.',
      'mobile', 'phone', 'laptop', 'watch', 'shirt', 'shoes', 'bag',
      'men', 'women', 'boys', 'girls', 'dress', 'jeans', 'buy', 'add to bag'
    ];
    
    // Find banners that match product image patterns
    for (const [bannerId, bannerData] of Object.entries(allBanners)) {
      const imageUrl = (bannerData.url || '').toLowerCase();
      const altText = (bannerData.title || bannerData.description || bannerData.alt || '').toLowerCase();
      
      // Check if URL matches product image patterns
      const matchesUrlPattern = productImagePatterns.some(pattern => imageUrl.includes(pattern));
      
      // Check if alt text contains product keywords
      const matchesKeywords = productKeywords.some(keyword => altText.includes(keyword));
      
      // If both URL pattern and keywords match, it's likely a product image
      if (matchesUrlPattern && matchesKeywords) {
        bannersToDelete.push(bannerId);
        continue;
      }
      
      // Also check for small square images (common product image format)
      if (imageUrl.includes('/150x150') || imageUrl.includes('/200x200') || 
          imageUrl.includes('/250x250') || imageUrl.includes('/300x300')) {
        if (matchesKeywords || altText.includes('product') || altText.includes('item')) {
          bannersToDelete.push(bannerId);
        }
      }
    }
    
    if (bannersToDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No product images found',
        data: {
          deletedCount: 0
        }
      });
    }
    
    // Delete matching banners
    const deleteResult = bannerDbInstance.bulkDeleteBanners ? 
      await bannerDbInstance.bulkDeleteBanners(bannersToDelete) :
      await bannerDbInstance.bulkDeleteTestBanners(bannersToDelete);
    
    if (deleteResult.status === 200) {
      logger.info(`Deleted ${bannersToDelete.length} product image banners`);
      res.json({
        success: true,
        message: `Deleted ${bannersToDelete.length} product image banner(s)`,
        data: {
          deletedCount: deleteResult.deleted || bannersToDelete.length,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete banners'
      });
    }
  } catch (error) {
    logger.error('Error deleting product images', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/banners/delete-by-year
 * Delete all banners from years before the specified year
 * Body: { year: number } (defaults to 2026 if not provided)
 */
router.post('/delete-by-year', async (req, res, next) => {
  try {
    const { year = 2026 } = req.body;
    
    if (typeof year !== 'number' || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'year must be a valid number between 2000 and 2100'
      });
    }
    
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    
    // Get all banners
    const getAllResult = bannerDbInstance.getAllBanners ? 
      await bannerDbInstance.getAllBanners() :
      await bannerDbInstance.getAllTestBanners();
    
    if (getAllResult.status !== 200) {
      return res.status(getAllResult.status || 500).json({
        success: false,
        error: getAllResult.message || 'Failed to fetch banners'
      });
    }
    
    const allBanners = getAllResult.data || {};
    const bannersToDelete = [];
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`).getTime();
    
    // Find banners created before the specified year
    for (const [bannerId, bannerData] of Object.entries(allBanners)) {
      const timestamp = bannerData.creationTimestamp || bannerData.updateTimestamp || bannerData.timestamp;
      
      if (!timestamp) {
        // If no timestamp, we'll keep it (safer approach)
        continue;
      }
      
      try {
        const bannerDate = new Date(timestamp);
        if (isNaN(bannerDate.getTime())) {
          // Invalid date, skip
          continue;
        }
        
        const bannerYear = bannerDate.getFullYear();
        
        // Delete banners from years before the specified year
        if (bannerYear < year) {
          bannersToDelete.push(bannerId);
        }
      } catch (error) {
        logger.debug(`Error parsing timestamp for banner ${bannerId}:`, { timestamp, error: error.message });
        // Skip banners with invalid timestamps
        continue;
      }
    }
    
    if (bannersToDelete.length === 0) {
      return res.json({
        success: true,
        message: `No banners found from years before ${year}`,
        data: {
          deletedCount: 0,
          year: year,
          keptYear: year
        }
      });
    }
    
    // Delete matching banners
    const deleteResult = bannerDbInstance.bulkDeleteBanners ? 
      await bannerDbInstance.bulkDeleteBanners(bannersToDelete) :
      await bannerDbInstance.bulkDeleteTestBanners(bannersToDelete);
    
    if (deleteResult.status === 200) {
      logger.info(`Deleted ${bannersToDelete.length} banners from years before ${year}`);
      res.json({
        success: true,
        message: `Deleted ${bannersToDelete.length} banner(s) from years before ${year}`,
        data: {
          deletedCount: deleteResult.deleted || bannersToDelete.length,
          year: year,
          keptYear: year,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(deleteResult.status || 500).json({
        success: false,
        error: deleteResult.message || 'Failed to delete banners'
      });
    }
  } catch (error) {
    logger.error('Error deleting banners by year', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/banners/:id
 * Get a specific banner by ID
 * NOTE: Must be defined AFTER /stats route to avoid route conflict
 */
router.get('/:id', async (req, res, next) => {
  try {
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    const result = bannerDbInstance.getBanner ? 
      await bannerDbInstance.getBanner(req.params.id) :
      await bannerDbInstance.getTestBanner(req.params.id);
    
    if (result.status === 200) {
      res.json({ 
        success: true, 
        data: result.data 
      });
    } else {
      res.status(result.status || 404).json({ 
        success: false, 
        error: result.message || 'Banner not found' 
      });
    }
  } catch (error) {
    logger.error('Error getting banner', { error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
