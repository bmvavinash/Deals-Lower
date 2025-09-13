#!/usr/bin/env node

/**
 * Test User Favorites Database Connection
 * Verifies that the secondary Firebase app can connect and read user data
 */

// Load environment variables (dotenv is optional)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, that's okay - we'll use process.env directly
}
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testUserFavorites');

async function testConnection() {
  try {
    console.log('🔗 Testing User Favorites Database Connection...');
    
    // Check if service account path is set
    console.log('📋 Checking configuration...');
    const constants = require('../config/constants.js');
    
    if (!constants.userFirebase?.serviceAccountPath) {
      console.log('❌ Missing service account path');
      console.log('\n💡 Set the service account path in config/constants.js:');
      console.log('userFirebase: {');
      console.log('  serviceAccountPath: "path/to/your/users-service-account.json",');
      console.log('  databaseURL: "https://dealshub-users-default-rtdb.asia-southeast1.firebasedatabase.app"');
      console.log('}');
      return;
    }
    
    console.log('✅ Service account path is set');
    
    // Test Firebase initialization (this will fail with permission denied, which is expected)
    console.log('📊 Testing Firebase initialization...');
    const testUserId = 'test-user-123';
    
    try {
      const preferences = await userFavoritesDB.getUserPreferences(testUserId);
      console.log('✅ Preferences:', preferences);
      
      const channels = await userFavoritesDB.getUserChannels(testUserId);
      console.log('✅ Channels:', channels);
      
      const favoritedUsers = await userFavoritesDB.getUsersFavouritedProduct('test-product-456');
      console.log('✅ Favorited users:', favoritedUsers);
      
      console.log('✅ All tests passed! User Favorites DB is working correctly.');
      
    } catch (error) {
      console.log('⚠️  Error accessing user data:', error.message);
      console.log('💡 This might be because:');
      console.log('   1. Service account JSON path is incorrect');
      console.log('   2. Service account doesn\'t have access to users database');
      console.log('   3. Users database structure is different');
      console.log('   4. Test user doesn\'t exist in database');
    }
    
    console.log('✅ Firebase Admin SDK initialization successful!');
    console.log('📝 Next steps:');
    console.log('   1. Make sure service account has access to users database');
    console.log('   2. Test with real user IDs from your database');
    console.log('   3. Enable notifications in constants.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testConnection().catch(console.error);
