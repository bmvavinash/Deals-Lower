const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { favoritesNotificationService } = require('../services/favoritesBasedNotificationService');
const constants = require('../config/constants');

// Enable service settings for testing
constants.notifications = constants.notifications || {};
constants.notifications.enableFavoritesService = true;
constants.notifications.enableWhatsapp = true;
constants.notifications.enableTelegram = true;

// Mock product database in-memory to prevent hangs/timeouts due to network/SSL errors
const mockDbData = {
  TEST_DUAL_PROD: {
    productCode: 'TEST_DUAL_PROD',
    title: 'Dual WhatsApp & Telegram Integration Test Product',
    price: 80,
    isOutOfStock: false,
    storeType: 'Amazon',
    productUrl: 'https://www.amazon.in/dp/TEST_DUAL_PROD',
    photo: 'https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg'
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
  console.log('🧪 Starting REAL Dual WhatsApp & Telegram Notification test...');
  
  const testUserWA = 'whatsapp-real-test-user-dual';
  const testUserTG = 'telegram-real-test-user-dual';
  const testProd = 'TEST_DUAL_PROD';
  const waPhone = '919951797149'; // Avinash's WhatsApp number
  const tgChatId = '@dealshubglobal'; // Telegram channel handle

  // 1. Setup User A (WhatsApp)
  console.log(`1a. Setting up WhatsApp user details for ${testUserWA} (phone: ${waPhone})...`);
  await userFavoritesDB.createUser(testUserWA, {
    preferences: {
      notifications: { enabled: true, channels: { whatsapp: true } },
      whatsapp: { phone: waPhone }
    },
    channels: {
      whatsapp: { phone: waPhone }
    }
  });

  await userFavoritesDB.addFavorite(testUserWA, testProd, {
    title: 'Dual WhatsApp & Telegram Integration Test Product',
    price: 100,
    productUrl: 'https://www.amazon.in/dp/TEST_DUAL_PROD',
    photo: 'https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg'
  });

  await userFavoritesDB.addTrackedProduct(testUserWA, testProd, {
    trackedPrice: 100,
    dropThreshold: 0.05
  });

  // 2. Setup User B (Telegram)
  console.log(`1b. Setting up Telegram user details for ${testUserTG} (chat_id: ${tgChatId})...`);
  await userFavoritesDB.createUser(testUserTG, {
    preferences: {
      notifications: { enabled: true, channels: { telegram: true } },
      telegram: { chatId: tgChatId }
    },
    channels: {
      telegram: { chatId: tgChatId }
    }
  });

  await userFavoritesDB.addFavorite(testUserTG, testProd, {
    title: 'Dual WhatsApp & Telegram Integration Test Product',
    price: 100,
    productUrl: 'https://www.amazon.in/dp/TEST_DUAL_PROD',
    photo: 'https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg'
  });

  await userFavoritesDB.addTrackedProduct(testUserTG, testProd, {
    trackedPrice: 100,
    dropThreshold: 0.05
  });

  // Reset daily stats to get fresh results
  favoritesNotificationService.resetDailyStats();

  // 3. Perform initial upsert (product is in stock at price ₹100)
  console.log('2. Upserting initial product state (Price: ₹100, In Stock)...');
  const initialProduct = {
    productCode: testProd,
    title: 'Dual WhatsApp & Telegram Integration Test Product',
    price: 100,
    isOutOfStock: false,
    storeType: 'Amazon',
    productUrl: 'https://www.amazon.in/dp/TEST_DUAL_PROD',
    photo: 'https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg'
  };
  await productDealsDB.bulkUpsertProducts([initialProduct]);

  // 4. Trigger price drop to ₹80
  console.log('3. Triggering price drop (Price: ₹80) to invoke WhatsApp & Telegram alerts...');
  const priceDroppedProduct = {
    ...initialProduct,
    price: 80
  };
  
  await productDealsDB.bulkUpsertProducts([priceDroppedProduct]);
  
  let stats = favoritesNotificationService.getStats();
  console.log('\n--- Final Notification Stats ---');
  console.log('Stats by Type:', JSON.stringify(stats.byType));
  console.log('WhatsApp stats:', JSON.stringify(stats.byChannel.whatsapp));
  console.log('Telegram stats:', JSON.stringify(stats.byChannel.telegram));

  // Clean up
  console.log('\n4. Cleaning up test users...');
  await userFavoritesDB.deleteUser(testUserWA);
  await userFavoritesDB.deleteUser(testUserTG);
  console.log('🎉 REAL Dual WhatsApp & Telegram Notification test done!');
}

runTest().catch(console.error);
