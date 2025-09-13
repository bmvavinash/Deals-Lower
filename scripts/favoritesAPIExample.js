#!/usr/bin/env node

/**
 * Example API endpoints for Favorites Management
 * This shows how to create REST API endpoints for user favorites
 */

const express = require('express');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('favoritesAPI');
const app = express();
app.use(express.json());

// Middleware for user authentication (implement your own)
function authenticateUser(req, res, next) {
  // This is a placeholder - implement your authentication logic
  const userId = req.headers['user-id'] || req.body.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' });
  }
  req.userId = userId;
  next();
}

// GET /api/favorites - Get user's favorite products
app.get('/api/favorites', authenticateUser, async (req, res) => {
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
app.post('/api/favorites', authenticateUser, async (req, res) => {
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
app.delete('/api/favorites/:productCode', authenticateUser, async (req, res) => {
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

// GET /api/tracked-products - Get user's tracked products
app.get('/api/tracked-products', authenticateUser, async (req, res) => {
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

// POST /api/tracked-products - Add product to tracking
app.post('/api/tracked-products', authenticateUser, async (req, res) => {
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

// DELETE /api/tracked-products/:productCode - Remove product from tracking
app.delete('/api/tracked-products/:productCode', authenticateUser, async (req, res) => {
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

// GET /api/user/preferences - Get user preferences
app.get('/api/user/preferences', authenticateUser, async (req, res) => {
  try {
    const preferences = await userFavoritesDB.getUserPreferences(req.userId);
    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('Error getting user preferences', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
});

// PUT /api/user/preferences - Update user preferences
app.put('/api/user/preferences', authenticateUser, async (req, res) => {
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

// POST /api/user - Create new user
app.post('/api/user', async (req, res) => {
  try {
    const { userId, userData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const success = await userFavoritesDB.createUser(userId, userData);
    
    if (success) {
      res.json({ success: true, message: 'User created successfully' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  } catch (error) {
    logger.error('Error creating user', { error: error.message });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Favorites API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Favorites API server running on port ${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET    /api/health`);
    console.log(`   GET    /api/favorites`);
    console.log(`   POST   /api/favorites`);
    console.log(`   DELETE /api/favorites/:productCode`);
    console.log(`   GET    /api/tracked-products`);
    console.log(`   POST   /api/tracked-products`);
    console.log(`   DELETE /api/tracked-products/:productCode`);
    console.log(`   GET    /api/user/preferences`);
    console.log(`   PUT    /api/user/preferences`);
    console.log(`   POST   /api/user`);
    console.log(`\n💡 Example usage:`);
    console.log(`   curl -H "user-id: test-user-123" http://localhost:${PORT}/api/favorites`);
    console.log(`   curl -X POST -H "user-id: test-user-123" -H "Content-Type: application/json" -d '{"productCode":"PROD123","productData":{"title":"Test Product"}}' http://localhost:${PORT}/api/favorites`);
  });
}

module.exports = app;

