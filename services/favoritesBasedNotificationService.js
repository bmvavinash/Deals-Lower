/**
 * Favorites-Based Notification Service
 * Sends notifications to users when their favorited products have:
 * - Price drops
 * - New deals
 * - Category deals matching their favorites
 */
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { notificationTrackingDB } = require('../database/firebaseDB/notificationTrackingDB');
const { notifyWhatsapp, notifyTelegram } = require('./notifyService');
const { getModuleLogger } = require('../logger/logger');
const constants = require('../config/constants');

const logger = getModuleLogger('favoritesNotificationService');

function isFavoritesEnabled() {
  return constants.notifications?.enableFavoritesService === true;
}

class FavoritesBasedNotificationService {
  constructor() {
    this.notificationStats = {
      totalTriggered: 0,
      totalSent: 0,
      byChannel: {
        whatsapp: { triggered: 0, sent: 0, failed: 0 },
        telegram: { triggered: 0, sent: 0, failed: 0 }
      },
      byType: {
        price_drop: 0,
        new_deal: 0,
        category_deal: 0
      },
      usersNotified: new Set(),
      productsNotified: new Set()
    };
  }

  /**
   * Check if product price has dropped for favorited users
   */
  async checkPriceDrops(productCode, currentPrice, previousPrice) {
    try {
      if (!isFavoritesEnabled()) return;
      if (!productCode || !currentPrice || !previousPrice) return;

      const currentPriceNum = parseFloat(String(currentPrice).replace(/[^\d.]/g, ''));
      const previousPriceNum = parseFloat(String(previousPrice).replace(/[^\d.]/g, ''));

      if (currentPriceNum >= previousPriceNum) return; // No price drop

      const priceDropPercent = ((previousPriceNum - currentPriceNum) / previousPriceNum) * 100;
      if (priceDropPercent < 5) return; // Only notify for 5%+ drops

      // Get users who favorited this product
      const userIds = await userFavoritesDB.getUsersFavouritedProduct(productCode);
      if (!userIds || userIds.length === 0) return;

      logger.info('Price drop detected for favorited product', {
        productCode,
        previousPrice: previousPriceNum,
        currentPrice: currentPriceNum,
        dropPercent: priceDropPercent.toFixed(2),
        usersCount: userIds.length
      });

      // Get product details
      const productSnapshot = await productDealsDB.productdealsRef.child(productCode.replace(/[.#$/\[\]]/g, '_')).once('value');
      const product = productSnapshot.val();

      if (!product) return;

      // Notify users (batch to avoid spam)
      await this.notifyUsersForProduct(userIds, product, 'price_drop', {
        previousPrice: previousPriceNum,
        currentPrice: currentPriceNum,
        dropPercent: priceDropPercent.toFixed(2)
      });

    } catch (error) {
      logger.error('Error checking price drops', { productCode, error: error.message, stack: error.stack });
    }
  }

  /**
   * Check for new deals on favorited products
   */
  async checkNewDeals(productCode, productData) {
    try {
      if (!isFavoritesEnabled()) return;
      if (!productCode || !productData) return;

      // Get users who favorited this product
      const userIds = await userFavoritesDB.getUsersFavouritedProduct(productCode);
      if (!userIds || userIds.length === 0) return;

      // Check if this is a new deal (has discount, is hot deal, etc.)
      const hasDiscount = productData.discount && parseFloat(productData.discount) > 0;
      const isHotDeal = productData.isHotDeal || productData.dealType === 'hotDeal';

      if (!hasDiscount && !isHotDeal) return;

      logger.info('New deal detected for favorited product', {
        productCode,
        hasDiscount,
        isHotDeal,
        usersCount: userIds.length
      });

      await this.notifyUsersForProduct(userIds, productData, 'new_deal');

    } catch (error) {
      logger.error('Error checking new deals', { productCode, error: error.message });
    }
  }

  /**
   * Check for category deals matching user favorites
   */
  async checkCategoryDeals(category, productData) {
    try {
      if (!isFavoritesEnabled()) return;
      if (!category || !productData) return;

      // Get all users and their favorites
      const allUsers = await userFavoritesDB.getAllUsers();
      if (!allUsers || Object.keys(allUsers).length === 0) return;

      const categoryLower = category.toLowerCase();
      const matchingUsers = [];

      // Get products in this category to check against user favorites
      const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
      const snapshot = await productDealsDB.productdealsRef.once('value');
      const allProducts = snapshot.val() || {};

      // Find users who have favorites in this category
      for (const [userId, userData] of Object.entries(allUsers)) {
        if (!userData.favorites) continue;

        // Check if user has any favorite product in this category
        const userFavoriteCodes = Object.keys(userData.favorites);
        const hasCategoryFavorite = userFavoriteCodes.some(productCode => {
          const safeKey = productCode.replace(/[.#$/\[\]]/g, '_');
          const product = allProducts[safeKey];
          if (!product) return false;
          
          // Check if product category matches
          const productCategory = product.category?.mainCategory || 
                                 product.hierarchicalCategory?.mainCategory ||
                                 product.categoryLevel1 || '';
          
          return productCategory.toLowerCase().includes(categoryLower) ||
                 categoryLower.includes(productCategory.toLowerCase());
        });

        if (hasCategoryFavorite) {
          matchingUsers.push(userId);
        }
      }

      if (matchingUsers.length === 0) return;

      logger.info('Category deal detected for favorited category', {
        category,
        usersCount: matchingUsers.length
      });

      // Notify users (limit to avoid spam - max 1-2 messages per user)
      const limitedUsers = matchingUsers.slice(0, 100); // Limit batch size
      await this.notifyUsersForCategory(limitedUsers, category, productData);

    } catch (error) {
      logger.error('Error checking category deals', { category, error: error.message });
    }
  }

  /**
   * Check if stock status has changed (e.g. Back in Stock) for favorited users
   */
  async checkStockStatusChanges(productCode, currentProduct, previousProduct) {
    try {
      if (!isFavoritesEnabled()) return;
      if (!productCode || !currentProduct || !previousProduct) return;

      const currentOutOfStock = !!currentProduct.isOutOfStock;
      const previousOutOfStock = !!previousProduct.isOutOfStock;

      if (previousOutOfStock && !currentOutOfStock) {
        // Product went from out of stock to in stock -> Back in Stock!
        const userIds = await userFavoritesDB.getUsersFavouritedProduct(productCode);
        if (!userIds || userIds.length === 0) return;

        logger.info('Back in stock detected for favorited product', {
          productCode,
          title: currentProduct.title,
          usersCount: userIds.length
        });

        await this.notifyUsersForProduct(userIds, currentProduct, 'back_in_stock');
      } else if (!previousOutOfStock && currentOutOfStock) {
        // Product went from in stock to out of stock -> Out of Stock!
        const userIds = await userFavoritesDB.getUsersFavouritedProduct(productCode);
        if (!userIds || userIds.length === 0) return;

        logger.info('Out of stock detected for favorited product', {
          productCode,
          title: currentProduct.title,
          usersCount: userIds.length
        });

        await this.notifyUsersForProduct(userIds, currentProduct, 'out_of_stock');
      }
    } catch (error) {
      logger.error('Error checking stock status changes', { productCode, error: error.message });
    }
  }

  /**
   * Notify users about a specific product
   */
  async notifyUsersForProduct(userIds, product, notificationType, extraData = {}) {
    if (!userIds || userIds.length === 0) return;

    this.notificationStats.totalTriggered += userIds.length;
    this.notificationStats.byType[notificationType] = (this.notificationStats.byType[notificationType] || 0) + userIds.length;

    // Get user preferences and channels
    const allUsers = await userFavoritesDB.getAllUsers();
    let notifiedCount = 0;

    for (const userId of userIds) {
      try {
        const user = allUsers[userId];
        if (!user || !user.channels) continue;

        // Check if user already notified today (prevent spam)
        const today = new Date().toISOString().split('T')[0];
        const notificationKey = `${userId}_${product.productCode}_${today}`;
        if (this.notificationStats.usersNotified.has(notificationKey)) {
          continue; // Already notified today
        }

        const channels = user.channels;
        const preferences = user.preferences || {};

        // Build message
        const message = this.buildNotificationMessage(product, notificationType, extraData);

        // Send via WhatsApp (preferred) or Telegram
        let sent = false;
        const photoUrl = product.photo || product.image || '';
        if (channels.whatsapp && preferences.whatsapp?.phone && constants.notifications?.enableWhatsapp) {
          const phone = channels.whatsapp.phone || preferences.whatsapp.phone;
          sent = await notifyWhatsapp(phone, message, product.productCode, 'productDeal', photoUrl);
          if (sent) {
            this.notificationStats.byChannel.whatsapp.sent++;
            notifiedCount++;
            this.notificationStats.usersNotified.add(notificationKey);
            this.notificationStats.productsNotified.add(product.productCode);
          } else {
            this.notificationStats.byChannel.whatsapp.failed++;
          }
          this.notificationStats.byChannel.whatsapp.triggered++;
        } else if (channels.telegram && preferences.telegram?.chatId) {
          const chatId = channels.telegram.chatId || preferences.telegram.chatId;
          sent = await notifyTelegram(chatId, message, product.productCode, 'productDeal', photoUrl);
          if (sent) {
            this.notificationStats.byChannel.telegram.sent++;
            notifiedCount++;
            this.notificationStats.usersNotified.add(notificationKey);
            this.notificationStats.productsNotified.add(product.productCode);
          } else {
            this.notificationStats.byChannel.telegram.failed++;
          }
          this.notificationStats.byChannel.telegram.triggered++;
        }

        // Track notification
        if (sent && notificationTrackingDB) {
          await notificationTrackingDB.trackNotification(
            product.productCode,
            sent ? (channels.whatsapp ? 'whatsapp' : 'telegram') : 'unknown',
            sent,
            'productDeal',
            null,
            'favorites_based'
          );
        }

      } catch (error) {
        logger.error('Error notifying user for product', { userId, productCode: product.productCode, error: error.message });
      }
    }

    this.notificationStats.totalSent += notifiedCount;
    logger.info('Favorites-based notifications sent', {
      productCode: product.productCode,
      notificationType,
      triggered: userIds.length,
      sent: notifiedCount
    });
  }

  /**
   * Notify users about category deals (limited to 1-2 per user to avoid spam)
   */
  async notifyUsersForCategory(userIds, category, sampleProduct) {
    if (!userIds || userIds.length === 0) return;

    const allUsers = await userFavoritesDB.getAllUsers();
    let notifiedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const userId of userIds) {
      try {
        const user = allUsers[userId];
        if (!user || !user.channels) continue;

        // Limit to 1-2 notifications per user per day for category deals
        const categoryKey = `${userId}_category_${category}_${today}`;
        const userNotificationCount = Array.from(this.notificationStats.usersNotified).filter(k => k.startsWith(`${userId}_category_`)).length;
        if (userNotificationCount >= 2) {
          continue; // Max 2 category notifications per user per day
        }

        const channels = user.channels;
        const preferences = user.preferences || {};

        // Build minimal message with category URL
        const categoryUrl = this.getCategoryUrl(category, sampleProduct);
        const message = `🎯 New deals in ${category}!\n\n${categoryUrl}\n\nBrowse more: ${categoryUrl}`;

        // Send via WhatsApp (preferred)
        let sent = false;
        if (channels.whatsapp && preferences.whatsapp?.phone && constants.notifications?.enableWhatsapp) {
          const phone = channels.whatsapp.phone || preferences.whatsapp.phone;
          sent = await notifyWhatsapp(phone, message, null, 'categoryDeal');
          if (sent) {
            this.notificationStats.byChannel.whatsapp.sent++;
            notifiedCount++;
            this.notificationStats.usersNotified.add(categoryKey);
          }
        }

      } catch (error) {
        logger.error('Error notifying user for category', { userId, category, error: error.message });
      }
    }

    this.notificationStats.totalSent += notifiedCount;
  }

  /**
   * Build notification message with product URL
   */
  buildNotificationMessage(product, notificationType, extraData = {}) {
    const productUrl = product.links?.avinashbmv || product.links?.avinashbmvINR || product.productUrl || '';
    const title = product.title || 'Product';
    const price = product.price ? `₹${product.price}` : '';
    const discount = product.discount ? `${product.discount}% off` : '';

    let message = '';

    if (notificationType === 'price_drop') {
      message = `💥 😲 Wow! Price Drop Alert! 📉\n\n${title}\n\n`;
      if (extraData.previousPrice && extraData.currentPrice) {
        message += `🏷️ Old Price: ₹${extraData.previousPrice}\n💸 Offer Price: ₹${extraData.currentPrice}\n🚀 You Save: ${extraData.dropPercent}%\n\n`;
      }
      message += `${productUrl}`;
    } else if (notificationType === 'back_in_stock') {
      message = `🎉 Back in Stock Alert! 🚀\n\n${title}\n\nThis item is now back in stock!\n`;
      if (price) message += `💸 Offer Price: ${price}\n`;
      message += `\n${productUrl}`;
    } else if (notificationType === 'out_of_stock') {
      message = `⚠️ Out of Stock Alert!\n\n${title}\n\nThis item is now out of stock!\n\n${productUrl}`;
    } else if (notificationType === 'new_deal') {
      message = `🔥 😲 Hot New Deal! 📉\n\n${title}\n\n`;
      if (price) message += `💸 Offer Price: ${price}\n`;
      if (discount) message += `🏷️ Discount: ${discount}\n`;
      message += `\n${productUrl}`;
    } else {
      message = `🎯 Deal Alert!\n\n${title}\n\n`;
      if (price) message += `💸 Offer Price: ${price}\n`;
      if (discount) message += `🏷️ Discount: ${discount}\n`;
      message += `\n${productUrl}`;
    }

    return message;
  }

  /**
   * Get category URL for notifications
   */
  getCategoryUrl(category, product) {
    // Use product URL if available, otherwise construct category URL
    if (product?.productUrl) {
      // Extract base URL and construct category page
      const url = new URL(product.productUrl);
      const platform = product.storeType?.toLowerCase() || 'amazon';
      return `${url.origin}/s?k=${encodeURIComponent(category)}`;
    }
    return `https://www.amazon.in/s?k=${encodeURIComponent(category)}`;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      ...this.notificationStats,
      usersNotified: this.notificationStats.usersNotified.size,
      productsNotified: this.notificationStats.productsNotified.size,
      byChannel: {
        ...this.notificationStats.byChannel,
        whatsapp: {
          ...this.notificationStats.byChannel.whatsapp,
          successRate: this.notificationStats.byChannel.whatsapp.triggered > 0
            ? ((this.notificationStats.byChannel.whatsapp.sent / this.notificationStats.byChannel.whatsapp.triggered) * 100).toFixed(2)
            : 0
        },
        telegram: {
          ...this.notificationStats.byChannel.telegram,
          successRate: this.notificationStats.byChannel.telegram.triggered > 0
            ? ((this.notificationStats.byChannel.telegram.sent / this.notificationStats.byChannel.telegram.triggered) * 100).toFixed(2)
            : 0
        }
      }
    };
  }

  /**
   * Reset daily stats (call at start of day)
   */
  resetDailyStats() {
    this.notificationStats.usersNotified.clear();
    this.notificationStats.productsNotified.clear();
    this.notificationStats.totalTriggered = 0;
    this.notificationStats.totalSent = 0;
    this.notificationStats.byChannel = {
      whatsapp: { triggered: 0, sent: 0, failed: 0 },
      telegram: { triggered: 0, sent: 0, failed: 0 }
    };
    this.notificationStats.byType = {
      price_drop: 0,
      new_deal: 0,
      category_deal: 0
    };
  }
}

const favoritesNotificationService = new FavoritesBasedNotificationService();

// Reset stats daily at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    favoritesNotificationService.resetDailyStats();
  }
}, 60000); // Check every minute

module.exports = { favoritesNotificationService };

