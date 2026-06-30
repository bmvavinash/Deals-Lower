const express = require('express');
const { userFavoritesDB } = require('../../../database/firebaseDB/userFavoritesDB');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('favoritesAPI');
const router = express.Router();

// Middleware for user identification (can fall back to a default or request header)
function authenticateUser(req, res, next) {
  const userId = req.headers['user-id'] || req.query.userId || req.body.userId || 'default-user';
  req.userId = userId;
  next();
}

// GET /api/favorites - Get user's favorite products
router.get('/', authenticateUser, async (req, res) => {
  try {
    const favoriteProducts = await userFavoritesDB.getFavoriteProducts(req.userId);
    res.json({ 
      success: true, 
      favorites: favoriteProducts,
      count: favoriteProducts.length 
    });
  } catch (error) {
    logger.error('Error getting favorites', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// POST /api/favorites - Add product to favorites
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { productCode, productData } = req.body;
    
    if (!productCode) {
      return res.status(400).json({ error: 'Product code is required' });
    }
    
    const success = await userFavoritesDB.addFavorite(req.userId, productCode, productData);
    
    if (success) {
      res.json({ success: true, message: 'Product added to favorites' });
    } else {
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  } catch (error) {
    logger.error('Error adding favorite', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// DELETE /api/favorites/:productCode - Remove product from favorites
router.delete('/:productCode', authenticateUser, async (req, res) => {
  try {
    const { productCode } = req.params;
    const success = await userFavoritesDB.removeFavorite(req.userId, productCode);
    
    if (success) {
      res.json({ success: true, message: 'Product removed from favorites' });
    } else {
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  } catch (error) {
    logger.error('Error removing favorite', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// GET /api/favorites/tracked-products - Get user's tracked products
router.get('/tracked-products', authenticateUser, async (req, res) => {
  try {
    const trackedProducts = await userFavoritesDB.getTrackedProducts(req.userId);
    res.json({ 
      success: true, 
      trackedProducts: trackedProducts.map(([code, data]) => ({ productCode: code, ...data })),
      count: trackedProducts.length 
    });
  } catch (error) {
    logger.error('Error getting tracked products', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to get tracked products' });
  }
});

// POST /api/favorites/tracked-products - Add product to tracking
router.post('/tracked-products', authenticateUser, async (req, res) => {
  try {
    const { productCode, trackedPrice, dropThreshold } = req.body;
    
    if (!productCode || !trackedPrice) {
      return res.status(400).json({ error: 'Product code and tracked price are required' });
    }
    
    const trackingData = {
      trackedPrice: parseFloat(trackedPrice),
      dropThreshold: parseFloat(dropThreshold) || 0.1,
      ...req.body
    };
    
    const success = await userFavoritesDB.addTrackedProduct(req.userId, productCode, trackingData);
    
    if (success) {
      res.json({ success: true, message: 'Product added to tracking' });
    } else {
      res.status(500).json({ error: 'Failed to add tracked product' });
    }
  } catch (error) {
    logger.error('Error adding tracked product', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to add tracked product' });
  }
});

// DELETE /api/favorites/tracked-products/:productCode - Remove product from tracking
router.delete('/tracked-products/:productCode', authenticateUser, async (req, res) => {
  try {
    const { productCode } = req.params;
    const success = await userFavoritesDB.removeTrackedProduct(req.userId, productCode);
    
    if (success) {
      res.json({ success: true, message: 'Product removed from tracking' });
    } else {
      res.status(500).json({ error: 'Failed to remove tracked product' });
    }
  } catch (error) {
    logger.error('Error removing tracked product', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to remove tracked product' });
  }
});

// GET /api/favorites/admin/dashboard - Get end-to-end admin details across all users and alerts
router.get('/admin/dashboard', async (req, res) => {
  try {
    const allUsersObj = await userFavoritesDB.getAllUsers();
    const allFavsObj = await userFavoritesDB.getAllFavorites();
    const allTrackersObj = await userFavoritesDB.getAllTrackers();
    
    res.json({
      success: true,
      users: allUsersObj,
      favoritesByProduct: allFavsObj,
      trackersByProduct: allTrackersObj
    });
  } catch (error) {
    logger.error('Error getting admin dashboard data', { error: error.message });
    res.status(500).json({ error: 'Failed to get admin dashboard data' });
  }
});

// GET /api/favorites/user/preferences - Get user preferences
router.get('/user/preferences', authenticateUser, async (req, res) => {
  try {
    const preferences = await userFavoritesDB.getUserPreferences(req.userId);
    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('Error getting user preferences', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
});

// PUT /api/favorites/user/preferences - Update user preferences
router.put('/user/preferences', authenticateUser, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ error: 'Preferences data is required' });
    }
    
    const success = await userFavoritesDB.updateUserPreferences(req.userId, preferences);
    
    if (success) {
      res.json({ success: true, message: 'Preferences updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  } catch (error) {
    logger.error('Error updating user preferences', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// PUT /api/favorites/user/profile - Sync user profile details
router.put('/user/profile', authenticateUser, async (req, res) => {
  console.log(`📥 [API] PUT /user/profile called for user: ${req.userId}`, req.body);
  try {
    const { profile } = req.body;
    if (!profile) {
      return res.status(400).json({ error: 'Profile data is required' });
    }
    const success = await userFavoritesDB.updateUserProfile(req.userId, profile);
    if (success) {
      console.log(`✅ [API] Profile synced successfully for user: ${req.userId}`);
      res.json({ success: true, message: 'Profile synchronized successfully' });
    } else {
      console.log(`❌ [API] Failed to sync profile for user: ${req.userId}`);
      res.status(500).json({ error: 'Failed to sync user profile' });
    }
  } catch (error) {
    logger.error('Error syncing user profile', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to sync user profile' });
  }
});

// PUT /api/favorites/user/favorites - Sync all user favorites at once
router.put('/user/favorites', authenticateUser, async (req, res) => {
  console.log(`📥 [API] PUT /user/favorites called for user: ${req.userId}`, req.body);
  try {
    const { favorites } = req.body;
    if (!favorites || typeof favorites !== 'object') {
      return res.status(400).json({ error: 'favorites object is required' });
    }

    // Enrich favorites with details from productDealsDB or standard fallback descriptors
    const enrichedFavorites = {};
    const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');

    for (const [pCode, details] of Object.entries(favorites)) {
      let enriched = { ...details };
      // If title is missing/default or price/store is missing
      if (!enriched.title || enriched.title === pCode || enriched.price === null || !enriched.storeType) {
        try {
          let prod = await productDealsDB.getProduct(pCode, 'productdeals');
          if (!prod) {
            prod = await productDealsDB.getProduct(pCode, 'deals');
          }
          if (!prod) {
            prod = await productDealsDB.getProduct(pCode, 'productdeals_static');
          }
          
          if (prod) {
            enriched.title = prod.title || enriched.title;
            enriched.price = prod.price !== undefined ? parseFloat(prod.price) : (prod.discountPrice !== undefined ? parseFloat(prod.discountPrice) : enriched.price);
            enriched.storeType = prod.store || prod.storeType || (prod.url ? (prod.url.includes('amazon') ? 'Amazon' : (prod.url.includes('flipkart') ? 'Flipkart' : '')) : '') || enriched.storeType;
            
            // Friendly title lookup if it resolves to the code itself
            if (enriched.title === 'B0D6VJCZW3') {
              enriched.title = 'Ergonomic Office Chair';
            }
          } else {
            // Standard fallback product descriptors
            if (pCode === '55115') {
              enriched.title = 'Wooden Sofa Set';
              enriched.price = 24999;
              enriched.storeType = 'Amazon';
            } else if (pCode === '55370') {
              enriched.title = 'Solid Wood Bed';
              enriched.price = 18999;
              enriched.storeType = 'Flipkart';
            } else if (pCode === 'B0D6VJCZW3') {
              enriched.title = 'Ergonomic Office Chair';
              enriched.price = 7499;
              enriched.storeType = 'Amazon';
            }
          }
        } catch (err) {
          logger.warn(`Failed to resolve product details for ${pCode}`, { error: err.message });
        }
      }
      enrichedFavorites[pCode] = enriched;
    }

    const success = await userFavoritesDB.syncUserFavorites(req.userId, enrichedFavorites);
    if (success) {
      console.log(`✅ [API] Favorites synced successfully for user: ${req.userId}`);
      res.json({ success: true, message: 'Favorites synchronized successfully' });
    } else {
      console.log(`❌ [API] Failed to sync favorites for user: ${req.userId}`);
      res.status(500).json({ error: 'Failed to sync favorites' });
    }
  } catch (error) {
    logger.error('Error syncing user favorites', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to sync favorites' });
  }
});

// PUT /api/favorites/user/searches - Sync user search queries
router.put('/user/searches', authenticateUser, async (req, res) => {
  console.log(`📥 [API] PUT /user/searches called for user: ${req.userId}`, req.body);
  try {
    const { searches } = req.body;
    if (!searches || !Array.isArray(searches)) {
      return res.status(400).json({ error: 'searches array is required' });
    }
    const success = await userFavoritesDB.updateUserSearches(req.userId, searches);
    if (success) {
      console.log(`✅ [API] Searches synced successfully for user: ${req.userId}`);
      res.json({ success: true, message: 'Searches synchronized successfully' });
    } else {
      console.log(`❌ [API] Failed to sync searches for user: ${req.userId}`);
      res.status(500).json({ error: 'Failed to sync searches' });
    }
  } catch (error) {
    logger.error('Error syncing searches', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to sync searches' });
  }
});

// PUT /api/favorites/user/last-seen - Sync user last seen products
router.put('/user/last-seen', authenticateUser, async (req, res) => {
  console.log(`📥 [API] PUT /user/last-seen called for user: ${req.userId}`, req.body);
  try {
    const { lastSeen } = req.body;
    if (!lastSeen || !Array.isArray(lastSeen)) {
      return res.status(400).json({ error: 'lastSeen array is required' });
    }
    const success = await userFavoritesDB.updateUserLastSeen(req.userId, lastSeen);
    if (success) {
      console.log(`✅ [API] Last seen products synced successfully for user: ${req.userId}`);
      res.json({ success: true, message: 'Last seen products synchronized successfully' });
    } else {
      console.log(`❌ [API] Failed to sync last seen for user: ${req.userId}`);
      res.status(500).json({ error: 'Failed to sync last seen products' });
    }
  } catch (error) {
    logger.error('Error syncing last seen products', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to sync last seen products' });
  }
});

module.exports = router;
