const { favoritesNotificationService } = require('../services/favoritesNotificationService');
const { userFavoritesDB, getSecondaryApp } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const admin = require('firebase-admin');

async function runTest() {
  console.log("Starting test for hourly favorites check...");
  
  const testUserId = 'test_iphone_user_123';
  const testProductCode = 'TEST_PROD_1';

  // 1. Create a dummy product in productDealsDB
  console.log("Creating dummy product...");
  await productDealsDB.productdealsRef.child(testProductCode).set({
    title: 'Test iPhone Case',
    price: 500, // New price, old price was 600
    availability: 'in_stock', // New stock, old was out_of_stock
    productUrl: 'https://example.com/case',
    productCode: testProductCode
  });

  // 2. Set user preference
  console.log("Creating test user and setting preferences...");
  await userFavoritesDB.createUser(testUserId, {
    preferences: {
      notifications: { enabled: true },
      telegram: { chatId: '123456789' }
    },
    channels: { telegram: true }
  });

  // 3. Add to favorites with older price and out of stock status
  console.log("Adding product to favorites with previous states and preferences...");
  await userFavoritesDB.addFavorite(testUserId, testProductCode, {
    title: 'Test iPhone Case',
    price: 600, // Should trigger price drop
    lastCheckedPrice: 600,
    lastStockStatus: 'out_of_stock', // Should trigger back in stock
    preferences: {
      targetPrice: 550, // 500 is <= 550 so it should trigger price drop
      notifyTelegram: true,
      notifyWhatsapp: false
    }
  });

  // 4. Run processFavoriteStateChanges
  console.log("Running processFavoriteStateChanges...");
  await favoritesNotificationService.processFavoriteStateChanges(testUserId, {
    notifications: { enabled: true, channels: { telegram: true } },
    telegram: { chatId: '123456789' }
  });

  // 5. Verify the updated values
  console.log("Verifying updated values in database...");
  const favoritesData = await userFavoritesDB.getFavoriteProductsData(testUserId);
  const updatedFav = favoritesData[testProductCode];
  
  if (updatedFav.lastCheckedPrice === 500 && updatedFav.lastStockStatus === 'in_stock') {
    console.log("✅ Values successfully updated to current values");
  } else {
    console.log("❌ Values NOT updated correctly:", updatedFav);
  }

  console.log("Cleaning up...");
  await productDealsDB.productdealsRef.child(testProductCode).remove();
  await userFavoritesDB.deleteUser(testUserId);
  
  console.log("Test finished.");
  process.exit(0);
}

runTest().catch(console.error);
