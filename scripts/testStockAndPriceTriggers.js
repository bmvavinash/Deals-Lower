const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { favoritesNotificationService } = require('../services/favoritesBasedNotificationService');
const constants = require('../config/constants');

// Enable service in-memory for testing
constants.notifications = constants.notifications || {};
constants.notifications.enableFavoritesService = true;
constants.notifications.enableTelegram = true; // allow stats trigger
constants.notifications.enableWhatsapp = true;

// Mock product database in-memory to prevent hangs/timeouts due to network/SSL errors
const mockDbData = {};

productDealsDB.productdealsRef = {
  child: (key) => ({
    once: async (event) => ({
      val: () => mockDbData[key] || null
    })
  })
};
productDealsDB.dealsRef = productDealsDB.productdealsRef;

// Override bulkUpsertProducts to run locally in-memory for this test
productDealsDB.bulkUpsertProducts = async function(products, targetDb = 'deals') {
  for (const product of products) {
    const key = product.productCode || product.id || '';
    const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
    
    const existingProduct = mockDbData[safeKey];
    
    if (existingProduct) {
      // Check price drops
      if (product.price && existingProduct.price) {
        await favoritesNotificationService.checkPriceDrops(product.productCode, product.price, existingProduct.price);
      }
      // Check stock status changes
      await favoritesNotificationService.checkStockStatusChanges(product.productCode, product, existingProduct);
    }
    
    // Save to mock database
    mockDbData[safeKey] = { ...existingProduct, ...product };
  }
  return { status: 200, message: 'Mock upsert successful' };
};

// Mock notifyService methods so we don't try to send real HTTP requests to WhatsApp/Telegram
const notifyService = require('../services/notifyService');
notifyService.notifyWhatsapp = async () => true;
notifyService.notifyTelegram = async () => true;

async function runTest() {
  console.log('🧪 Starting stock and price trigger integration tests (Local Mock Mode)...');
  
  const testUser = 'trigger-test-user-99';
  const testProd = 'TEST_PROD_ABC';

  // 1. Setup mock favorite & tracker for the test user
  console.log('1. Setting up mock user, favorites and tracker...');
  await userFavoritesDB.createUser(testUser, {
    preferences: {
      notifications: { enabled: true, channels: { telegram: true } }
    },
    channels: {
      telegram: { chatId: 'mock-chat-id-123' }
    }
  });

  await userFavoritesDB.addFavorite(testUser, testProd, {
    title: 'Super Deluxe Widget',
    price: 100,
    productUrl: 'https://www.amazon.in/dp/TEST_PROD_ABC'
  });

  await userFavoritesDB.addTrackedProduct(testUser, testProd, {
    trackedPrice: 100,
    dropThreshold: 0.05 // 5% drop
  });

  // Reset daily stats to get fresh results
  favoritesNotificationService.resetDailyStats();

  // 2. Perform initial upsert (product is in stock at price ₹100)
  console.log('2. Upserting initial product state (Price: ₹100, In Stock)...');
  const initialProduct = {
    productCode: testProd,
    title: 'Super Deluxe Widget',
    price: 100,
    isOutOfStock: false,
    storeType: 'Amazon',
    productUrl: 'https://www.amazon.in/dp/TEST_PROD_ABC'
  };
  await productDealsDB.bulkUpsertProducts([initialProduct]);

  // 3. Test price drop trigger (Price drop to ₹80)
  console.log('3. Triggering price drop (Price: ₹80)...');
  const priceDroppedProduct = {
    ...initialProduct,
    price: 80
  };
  
  await productDealsDB.bulkUpsertProducts([priceDroppedProduct]);
  let stats = favoritesNotificationService.getStats();
  console.log('Stats after price drop:', JSON.stringify(stats.byType));
  
  if (stats.byType.price_drop > 0) {
    console.log('✅ Price drop notification triggered successfully!');
  } else {
    console.log('❌ Price drop notification failed to trigger.');
  }

  // Reset daily stats for next checks
  favoritesNotificationService.resetDailyStats();

  // 4. Test out-of-stock trigger
  console.log('4. Triggering out-of-stock status...');
  const outOfStockProduct = {
    ...priceDroppedProduct,
    isOutOfStock: true
  };
  await productDealsDB.bulkUpsertProducts([outOfStockProduct]);
  stats = favoritesNotificationService.getStats();
  console.log('Stats after out-of-stock:', JSON.stringify(stats.byType));

  if (stats.byType.out_of_stock > 0) {
    console.log('✅ Out-of-stock notification triggered successfully!');
  } else {
    console.log('❌ Out-of-stock notification failed to trigger.');
  }

  // Reset daily stats for next checks
  favoritesNotificationService.resetDailyStats();

  // 5. Test back-in-stock trigger
  console.log('5. Triggering back-in-stock status...');
  const backInStockProduct = {
    ...outOfStockProduct,
    isOutOfStock: false
  };
  await productDealsDB.bulkUpsertProducts([backInStockProduct]);
  stats = favoritesNotificationService.getStats();
  console.log('Stats after back-in-stock:', JSON.stringify(stats.byType));

  if (stats.byType.back_in_stock > 0) {
    console.log('✅ Back-in-stock notification triggered successfully!');
  } else {
    console.log('❌ Back-in-stock notification failed to trigger.');
  }

  // Clean up
  console.log('6. Cleaning up test user...');
  await userFavoritesDB.deleteUser(testUser);
  console.log('🎉 Tests completed!');
}

runTest().catch(console.error);
