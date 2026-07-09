const { getModuleLogger } = require('../logger/logger');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const urgencyUtils = require('../utils/urgencyUtils');
const { notifyService } = require('./notifyService');
const { comprehensiveLoggingService } = require('./comprehensiveLoggingService');
const { executionTracker } = require('./executionTracker');
const constants = require('../config/constants');

const logger = getModuleLogger('favoritesNotificationService');

class FavoritesNotificationService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  // Start hourly favorites processing
  start() {
    if (!constants.notifications || constants.notifications.enableFavoritesService === false) {
      logger.info('Favorites notification service disabled via config flag');
      return;
    }
    if (this.isRunning) {
      logger.warn('Favorites notification service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting favorites notification service - hourly processing');

    // Run immediately on start
    this.processFavoritesAndNotifications('scheduler');

    // Set up hourly interval
    this.intervalId = setInterval(() => {
      this.processFavoritesAndNotifications('scheduler');
    }, 60 * 60 * 1000); // 1 hour
  }

  // Stop the service
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Favorites notification service stopped');
  }

  // Run once for orchestrator
  async runOnce() {
    if (!constants.notifications || constants.notifications.enableFavoritesService === false) {
      logger.info('Favorites notification service disabled via config flag');
      return { success: false, reason: 'disabled' };
    }
    try {
      logger.info('Running favorites notification service one-time check');
      await this.processFavoritesAndNotifications('cli');
      return { success: true };
    } catch (error) {
      logger.error('Error in runOnce', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Main processing function
  async processFavoritesAndNotifications(sourceType = 'scheduler') {
    const startTime = comprehensiveLoggingService.logFavoritesProcessingStart();
    await executionTracker.startFavoritesExecution(sourceType);
    
    try {
      logger.info('❤️ Starting favorites and notifications processing');

      // 1. Get all users from users database
      const users = await this.getAllUsers();
      logger.info(`Processing notifications for ${users.length} users`);

      let totalFavorites = 0;
      let totalNotifications = 0;
      let priceTracking = 0;
      let lowStock = 0;
      let dealExpiry = 0;

      // 2. Process each user's favorites and notifications
      for (const user of users) {
        const userStats = await this.processUserNotifications(user) || {};
        totalFavorites += userStats.favorites || 0;
        totalNotifications += userStats.notifications || 0;
        priceTracking += userStats.priceTracking || 0;
        lowStock += userStats.lowStock || 0;
        dealExpiry += userStats.dealExpiry || 0;
      }

      // 3. Process deal expiry notifications
      const expiryStats = await this.processDealExpiryNotifications();
      dealExpiry += expiryStats.notificationsSent || 0;

      logger.info('✅ Favorites and notifications processing completed', {
        users: users.length,
        totalFavorites,
        totalNotifications,
        priceTracking,
        lowStock,
        dealExpiry
      });

      // Log comprehensive stats
      comprehensiveLoggingService.logFavoritesProcessingComplete(
        startTime, 
        users.length, 
        totalFavorites, 
        totalNotifications, 
        priceTracking, 
        lowStock, 
        dealExpiry
      );

      await executionTracker.endFavoritesExecution('completed', {
        usersCount: users.length,
        totalFavorites,
        totalNotifications,
        priceTracking,
        lowStock,
        dealExpiry
      });

    } catch (error) {
      logger.error('❌ Error in processFavoritesAndNotifications', { error: error.message });
      await executionTracker.endFavoritesExecution('failed', { error: error.message });
    }
  }

  // Get all users from the database
  async getAllUsers() {
    try {
      const usersData = await userFavoritesDB.getAllUsers();
      
      const users = Object.entries(usersData).map(([uid, userData]) => ({
        uid,
        ...userData
      }));

      return users;
    } catch (error) {
      logger.error('Error getting all users', { error: error.message });
      return [];
    }
  }

  // Process notifications for a specific user
  async processUserNotifications(user) {
    try {
      const { uid, preferences = {} } = user;

      // Check if user has notifications enabled
      if (!preferences.notifications?.enabled) {
        logger.debug(`Notifications disabled for user ${uid}`);
        return {};
      }

      // Check DND (Do Not Disturb)
      if (notifyService.isWithinDND(preferences)) {
        logger.debug(`User ${uid} is in DND period`);
        return {};
      }

      // 1. Price tracking notifications
      await this.processPriceTrackingNotifications(uid, preferences);

      // 2. Favorite products low stock notifications
      await this.processLowStockNotifications(uid, preferences);

      // 3. Favorite deals expiring notifications
      await this.processFavoriteDealsExpiring(uid, preferences);

      // 4. Favorite state changes (Price Drop and In-Stock Transitions)
      await this.processFavoriteStateChanges(uid, preferences);

      return {}; // return empty stats object to prevent undefined errors
    } catch (error) {
      logger.error(`Error processing notifications for user ${user.uid}`, { error: error.message });
      return {};
    }
  }

  // Process state changes for all favorites (price drop and out-of-stock -> in-stock)
  async processFavoriteStateChanges(uid, preferences) {
    try {
      const favoritesData = await userFavoritesDB.getFavoriteProductsData(uid);
      
      for (const [productCode, favoriteData] of Object.entries(favoritesData)) {
        const currentProduct = await this.getCurrentProductData(productCode);
        if (!currentProduct) continue;

        let needsUpdate = false;
        let updateData = {};
        
        const currentPrice = parseFloat(currentProduct.price) || 0;
        const previousPrice = parseFloat(favoriteData.lastCheckedPrice) || parseFloat(favoriteData.price) || 0;
        const currentStockStatus = currentProduct.availability || 'in_stock';
        const previousStockStatus = favoriteData.lastStockStatus || 'unknown';
        const favPrefs = favoriteData.preferences || {};
        const targetPrice = parseFloat(favPrefs.targetPrice) || 0;

        let notifyChannels = { ...preferences?.notifications?.channels };
        if (favPrefs.notifyTelegram !== undefined) notifyChannels.telegram = favPrefs.notifyTelegram;
        if (favPrefs.notifyWhatsapp !== undefined) notifyChannels.whatsapp = favPrefs.notifyWhatsapp;
        
        const mergedPreferences = {
           ...preferences,
           notifications: {
             ...preferences.notifications,
             channels: notifyChannels
           }
        };

        // Check for Price Drop
        let priceAlert = false;
        if (currentPrice > 0) {
          if (targetPrice > 0 && currentPrice <= targetPrice && previousPrice > targetPrice) {
            priceAlert = true;
          } else if (previousPrice > 0 && currentPrice < previousPrice) {
            const dropPercent = ((previousPrice - currentPrice) / previousPrice) * 100;
            if (dropPercent >= 5) {
              priceAlert = true;
            }
          }
        }

        if (priceAlert) {
          const message = `📉 Price Dropped on Your Favorite!\n\n${currentProduct.title}\nOld Price: ₹${previousPrice}\nNew Price: ₹${currentPrice}\n${targetPrice > 0 ? `Target Price: ₹${targetPrice}\n` : ''}${currentProduct.links?.avinashbmv || currentProduct.links?.avinashbmvINR || currentProduct.productUrl || ''}`;
          await this.sendNotification(uid, message, mergedPreferences, 'favorite_price_drop');
        }

        // Check for Stock Transition
        if (previousStockStatus === 'out_of_stock' && currentStockStatus === 'in_stock') {
          const message = `🎉 Back in Stock!\n\nYour favorite item is back:\n${currentProduct.title}\nPrice: ₹${currentPrice}\n${currentProduct.links?.avinashbmv || currentProduct.links?.avinashbmvINR || currentProduct.productUrl || ''}`;
          await this.sendNotification(uid, message, mergedPreferences, 'favorite_back_in_stock');
        }

        // Always update the last checked states if they changed
        if (previousPrice !== currentPrice) {
          updateData.lastCheckedPrice = currentPrice;
          needsUpdate = true;
        }
        if (previousStockStatus !== currentStockStatus) {
          updateData.lastStockStatus = currentStockStatus;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await userFavoritesDB.updateFavoriteStatus(uid, productCode, updateData);
        }
      }
    } catch (error) {
      logger.error(`Error processing favorite state changes for user ${uid}`, { error: error.message });
    }
  }

  // Process price tracking notifications
  async processPriceTrackingNotifications(uid, preferences) {
    try {
      const trackedProducts = await userFavoritesDB.getTrackedProducts(uid);
      
      for (const [productCode, trackingData] of trackedProducts) {
        const currentProduct = await this.getCurrentProductData(productCode);
        
        if (currentProduct && this.shouldNotifyPriceDrop(currentProduct, trackingData)) {
          const message = this.buildPriceDropMessage(currentProduct, trackingData);
          await this.sendNotification(uid, message, preferences, 'price_drop');
        }
      }
    } catch (error) {
      logger.error(`Error processing price tracking for user ${uid}`, { error: error.message });
    }
  }

  // Process low stock notifications for favorite products
  async processLowStockNotifications(uid, preferences) {
    try {
      const favoriteProducts = await userFavoritesDB.getFavoriteProducts(uid);
      
      for (const productCode of favoriteProducts) {
        const currentProduct = await this.getCurrentProductData(productCode);
        
        if (currentProduct && currentProduct.stock !== undefined && urgencyUtils.isLowStock(Number(currentProduct.stock))) {
          const message = this.buildLowStockMessage(currentProduct);
          await this.sendNotification(uid, message, preferences, 'low_stock');
        }
      }
    } catch (error) {
      logger.error(`Error processing low stock notifications for user ${uid}`, { error: error.message });
    }
  }

  // Process favorite deals expiring notifications
  async processFavoriteDealsExpiring(uid, preferences) {
    try {
      const favoriteProducts = await userFavoritesDB.getFavoriteProducts(uid);
      
      for (const productCode of favoriteProducts) {
        const currentProduct = await this.getCurrentProductData(productCode);
        
        const timerVal = currentProduct.timer || currentProduct.dealEndAt;
        if (currentProduct && timerVal && urgencyUtils.isExpiringSoon(timerVal)) {
          const message = this.buildDealExpiringMessage(currentProduct);
          await this.sendNotification(uid, message, preferences, 'deal_expiring');
        }
      }
    } catch (error) {
      logger.error(`Error processing deal expiry notifications for user ${uid}`, { error: error.message });
    }
  }

  // Process deal expiry notifications for all products with timers
  async processDealExpiryNotifications() {
    let notificationsSent = 0;
    try {
      logger.info('Processing deal expiry notifications');

      // Get products with timers from both databases
      const [productdealsWithTimers, dealsWithTimers] = await Promise.all([
        productDealsDB.getProductsWithTimers('productdeals'),
        productDealsDB.getProductsWithTimers('deals')
      ]);

      const allProductsWithTimers = [...productdealsWithTimers, ...dealsWithTimers];

      for (const [productCode, product] of allProductsWithTimers) {
        const timerVal = product.timer || product.dealEndAt;
        if (timerVal && urgencyUtils.isExpiringSoon(timerVal)) {
          const sent = await this.notifyUsersAboutExpiringDeal(productCode, product);
          notificationsSent += sent;
        }
      }

      logger.info(`Processed ${allProductsWithTimers.length} products with timers`);
    } catch (error) {
      logger.error('Error processing deal expiry notifications', { error: error.message });
    }
    return { notificationsSent };
  }

  // Notify users about expiring deals
  async notifyUsersAboutExpiringDeal(productCode, product) {
    let sentCount = 0;
    try {
      const users = await this.getAllUsers();
      
      for (const user of users) {
        const { uid, preferences = {} } = user;
        
        // Check if user has this product in favorites
        const favoriteProducts = await userFavoritesDB.getFavoriteProducts(uid);
        
        if (favoriteProducts.includes(productCode)) {
          const message = this.buildDealExpiringMessage(product);
          await this.sendNotification(uid, message, preferences, 'deal_expiring');
          sentCount++;
        }
      }
    } catch (error) {
      logger.error(`Error notifying users about expiring deal ${productCode}`, { error: error.message });
    }
    return sentCount;
  }

  // Get current product data from both databases
  async getCurrentProductData(productCode) {
    try {
      // Try productdeals first, then deals
      const [productdealsSnapshot, dealsSnapshot] = await Promise.all([
        productDealsDB.productdealsRef.child(productCode).once('value'),
        productDealsDB.dealsRef.child(productCode).once('value')
      ]);

      return productdealsSnapshot.val() || dealsSnapshot.val() || null;
    } catch (error) {
      logger.error(`Error getting current product data for ${productCode}`, { error: error.message });
      return null;
    }
  }

  // Check if price drop notification should be sent
  shouldNotifyPriceDrop(currentProduct, trackingData) {
    const currentPrice = parseFloat(currentProduct.price) || 0;
    const trackedPrice = parseFloat(trackingData.trackedPrice) || 0;
    const dropThreshold = parseFloat(trackingData.dropThreshold) || 0.1; // 10% default

    if (currentPrice === 0 || trackedPrice === 0) return false;

    const priceDrop = (trackedPrice - currentPrice) / trackedPrice;
    return priceDrop >= dropThreshold;
  }

  // Build notification messages
  buildPriceDropMessage(product, trackingData) {
    const priceDrop = ((trackingData.trackedPrice - product.price) / trackingData.trackedPrice * 100).toFixed(1);
    return `💰 Price Drop Alert!\n\n${product.title}\nPrice dropped by ${priceDrop}%\nNew Price: ₹${product.price}\n${product.productUrl}`;
  }

  buildLowStockMessage(product) {
    return `⚠️ Low Stock Alert!\n\n${product.title}\nOnly a few left in stock!\nPrice: ₹${product.price}\n${product.productUrl}`;
  }

  buildDealExpiringMessage(product) {
    const timeLeft = product.timer || 'soon';
    return `⏰ Deal Expiring Soon!\n\n${product.title}\nTime left: ${timeLeft}\nPrice: ₹${product.price}\n${product.productUrl}`;
  }

  // Send notification to user
  async sendNotification(uid, message, preferences, notificationType) {
    try {
      const channels = preferences.notifications?.channels || {};
      
      // Send via enabled channels
      if (channels.telegram && preferences.telegram?.chatId) {
        await notifyService.notifyTelegram(preferences.telegram.chatId, message);
      }
      
      if (channels.whatsapp && preferences.whatsapp?.phone) {
        await notifyService.notifyWhatsapp(preferences.whatsapp.phone, message);
      }
      
      if (channels.push && preferences.push?.token) {
        await notifyService.notifyPush(preferences.push.token, 'Deal Alert', message);
      }
      
      if (channels.browser && preferences.browser?.subscription) {
        await notifyService.notifyBrowser(preferences.browser.subscription, 'Deal Alert', message);
      }

      logger.info(`Notification sent to user ${uid} via ${notificationType}`, { 
        channels: Object.keys(channels).filter(k => channels[k]),
        preview: message.slice(0, 100)
      });

    } catch (error) {
      logger.error(`Error sending notification to user ${uid}`, { error: error.message });
    }
  }
}

const favoritesNotificationService = new FavoritesNotificationService();
module.exports = { favoritesNotificationService };
