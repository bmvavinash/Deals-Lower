const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { favoritesNotificationService } = require('../services/favoritesBasedNotificationService');
const constants = require('../config/constants');

// Enable service in-memory for testing
constants.notifications = constants.notifications || {};
constants.notifications.enableFavoritesService = true;
constants.notifications.enableWhatsapp = true;

// Mock product database in-memory to prevent hangs/timeouts due to network/SSL errors
const mockDbData = {
  TEST_WHATSAPP_PROD: {
    productCode: 'TEST_WHATSAPP_PROD',
    title: 'Real WhatsApp Integration Test Product',
    price: 80,
    isOutOfStock: false,
    storeType: 'Amazon',
    productUrl: 'https://www.amazon.in/dp/TEST_WHATSAPP_PROD'
  }
};

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
    
    mockDbData[safeKey] = { ...existingProduct, ...product };
  }
  return { status: 200, message: 'Mock upsert successful' };
};

async function runTest() {
  console.log('🧪 Starting REAL WhatsApp Notification test...');
  
  const testUser = 'whatsapp-real-test-user';
  const testProd = 'TEST_WHATSAPP_PROD';
  const phoneNumber = '919951797149'; // Avinash's number from Information.js

  // 1. Setup real favorite, tracker, and contact details
  console.log(`1. Setting up user details for ${testUser} with phone ${phoneNumber}...`);
  await userFavoritesDB.createUser(testUser, {
    preferences: {
      notifications: { enabled: true, channels: { whatsapp: true } },
      whatsapp: { phone: phoneNumber }
    },
    channels: {
      whatsapp: { phone: phoneNumber }
    }
  });

  await userFavoritesDB.addFavorite(testUser, testProd, {
    title: 'Real WhatsApp Integration Test Product',
    price: 100,
    productUrl: 'https://www.amazon.in/dp/TEST_WHATSAPP_PROD'
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
    title: 'Real WhatsApp Integration Test Product',
    price: 100,
    isOutOfStock: false,
    storeType: 'Amazon',
    productUrl: 'https://www.amazon.in/dp/TEST_WHATSAPP_PROD'
  };
  await productDealsDB.bulkUpsertProducts([initialProduct]);

  // 3. Trigger price drop to ₹80
  console.log('3. Triggering price drop (Price: ₹80) to invoke WhatsApp alert...');
  const priceDroppedProduct = {
    ...initialProduct,
    price: 80
  };
  
  await productDealsDB.bulkUpsertProducts([priceDroppedProduct]);
  
  let stats = favoritesNotificationService.getStats();
  console.log('Stats after trigger:', JSON.stringify(stats.byType));
  console.log('WhatsApp channel stats:', JSON.stringify(stats.byChannel.whatsapp));

  // Clean up
  console.log('4. Cleaning up test user...');
  await userFavoritesDB.deleteUser(testUser);
  console.log('🎉 REAL WhatsApp Notification test done!');
}

runTest().catch(console.error);
