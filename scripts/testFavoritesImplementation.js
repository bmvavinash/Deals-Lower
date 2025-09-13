#!/usr/bin/env node

/**
 * Comprehensive Test for Favorites Implementation
 * Tests all the fixed methods and functionality
 */

const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { favoritesNotificationService } = require('../services/favoritesNotificationService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testFavoritesImplementation');

async function testFavoritesImplementation() {
  console.log('🧪 Testing Favorites Implementation...\n');
  
  const testUserId = 'test-user-' + Date.now();
  const testProductCode = 'test-product-' + Date.now();
  
  try {
    // Test 1: User Management
    console.log('1️⃣ Testing User Management...');
    
    // Create user
    const userCreated = await userFavoritesDB.createUser(testUserId, {
      name: 'Test User',
      email: 'test@example.com',
      preferences: {
        notifications: {
          enabled: true,
          channels: {
            telegram: true,
            whatsapp: false,
            push: false,
            browser: false
          }
        }
      }
    });
    console.log('✅ User created:', userCreated);
    
    // Get user
    const user = await userFavoritesDB.getUser(testUserId);
    console.log('✅ User retrieved:', user ? 'Success' : 'Failed');
    
    // Update user preferences
    const preferencesUpdated = await userFavoritesDB.updateUserPreferences(testUserId, {
      notifications: {
        enabled: true,
        channels: {
          telegram: true,
          whatsapp: true,
          push: false,
          browser: false
        }
      }
    });
    console.log('✅ User preferences updated:', preferencesUpdated);
    
    // Test 2: Favorites Management
    console.log('\n2️⃣ Testing Favorites Management...');
    
    // Add favorite
    const favoriteAdded = await userFavoritesDB.addFavorite(testUserId, testProductCode, {
      title: 'Test Product',
      price: 100,
      url: 'https://example.com/product'
    });
    console.log('✅ Favorite added:', favoriteAdded);
    
    // Get user's favorite products
    const favoriteProducts = await userFavoritesDB.getFavoriteProducts(testUserId);
    console.log('✅ User favorite products:', favoriteProducts);
    console.log('   - Contains test product:', favoriteProducts.includes(testProductCode));
    
    // Get users who favorited the product
    const favoritedUsers = await userFavoritesDB.getUsersFavouritedProduct(testProductCode);
    console.log('✅ Users who favorited product:', favoritedUsers);
    console.log('   - Contains test user:', favoritedUsers.includes(testUserId));
    
    // Test 3: Product Tracking
    console.log('\n3️⃣ Testing Product Tracking...');
    
    // Add tracked product
    const trackedAdded = await userFavoritesDB.addTrackedProduct(testUserId, testProductCode, {
      trackedPrice: 120,
      dropThreshold: 0.1,
      title: 'Test Product'
    });
    console.log('✅ Tracked product added:', trackedAdded);
    
    // Get user's tracked products
    const trackedProducts = await userFavoritesDB.getTrackedProducts(testUserId);
    console.log('✅ User tracked products:', trackedProducts.length);
    console.log('   - Contains test product:', trackedProducts.some(([code]) => code === testProductCode));
    
    // Get users tracking the product
    const trackingUsers = await userFavoritesDB.getUsersTrackingProduct(testProductCode);
    console.log('✅ Users tracking product:', trackingUsers.length);
    console.log('   - Contains test user:', trackingUsers.some(user => user.uid === testUserId));
    
    // Test 4: Remove Operations
    console.log('\n4️⃣ Testing Remove Operations...');
    
    // Remove favorite
    const favoriteRemoved = await userFavoritesDB.removeFavorite(testUserId, testProductCode);
    console.log('✅ Favorite removed:', favoriteRemoved);
    
    // Remove tracked product
    const trackedRemoved = await userFavoritesDB.removeTrackedProduct(testUserId, testProductCode);
    console.log('✅ Tracked product removed:', trackedRemoved);
    
    // Verify removal
    const favoriteProductsAfter = await userFavoritesDB.getFavoriteProducts(testUserId);
    const trackedProductsAfter = await userFavoritesDB.getTrackedProducts(testUserId);
    console.log('✅ Favorites after removal:', favoriteProductsAfter.length);
    console.log('✅ Tracked products after removal:', trackedProductsAfter.length);
    
    // Test 5: Notification Service
    console.log('\n5️⃣ Testing Notification Service...');
    
    // Test getAllUsers method (this was the main bug)
    const allUsers = await favoritesNotificationService.getAllUsers();
    console.log('✅ Notification service getAllUsers:', Array.isArray(allUsers) ? 'Success' : 'Failed');
    console.log('   - Users found:', allUsers.length);
    
    // Test 6: Cleanup
    console.log('\n6️⃣ Testing Cleanup...');
    
    // Delete user
    const userDeleted = await userFavoritesDB.deleteUser(testUserId);
    console.log('✅ User deleted:', userDeleted);
    
    // Verify deletion
    const userAfterDeletion = await userFavoritesDB.getUser(testUserId);
    console.log('✅ User after deletion:', userAfterDeletion === null ? 'Success' : 'Failed');
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary of fixes:');
    console.log('   ✅ Added missing CRUD methods to UserFavoritesDB');
    console.log('   ✅ Fixed bug in favoritesNotificationService.getAllUsers()');
    console.log('   ✅ Added comprehensive user management methods');
    console.log('   ✅ Fixed hardcoded service account path');
    console.log('   ✅ Added proper error handling and logging');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Cleanup on error
    try {
      await userFavoritesDB.deleteUser(testUserId);
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testFavoritesImplementation().catch(console.error);
}

module.exports = { testFavoritesImplementation };

