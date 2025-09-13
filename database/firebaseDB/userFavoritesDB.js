const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const appConfig = require('../../config/config.js');

let secondaryApp = null;
let secondaryDb = null;

function getSecondaryApp() {
  if (secondaryApp) return secondaryApp;
  
  // Use service account for users database (like main Firebase)
  let serviceAccountPath = constants.userFirebase?.serviceAccountPath;
  const databaseURL = constants.userFirebase?.databaseURL;
  
  // If serviceAccountPath is set but points to directory, construct full file path
  if (serviceAccountPath && appConfig?.DATABASE_CONFIG?.USERS_DB_TOKEN_FILE) {
    const path = require('path');
    const fs = require('fs');
    
    // Check if it's a directory (ends with no extension or is a directory)
    if (fs.existsSync(serviceAccountPath) && fs.statSync(serviceAccountPath).isDirectory()) {
      serviceAccountPath = path.join(serviceAccountPath, `${appConfig.DATABASE_CONFIG.USERS_DB_TOKEN_FILE}.json`);
      console.log('Constructed service account path:', serviceAccountPath);
    }
  }
  // If not explicitly set, derive from configured tokens path and USERS_DB_TOKEN_FILE
  else if (!serviceAccountPath && appConfig?.DATABASE_CONFIG?.USERS_DB_TOKEN_FILE && constants?.pathToFile) {
    const path = require('path');
    serviceAccountPath = path.join(constants.pathToFile, `${appConfig.DATABASE_CONFIG.USERS_DB_TOKEN_FILE}.json`);
    console.log('Constructed service account path:', serviceAccountPath);
  }

  if (!serviceAccountPath || !databaseURL) {
    throw new Error('Users Firebase config missing: set constants.userFirebase.serviceAccountPath (or ensure config.DATABASE_CONFIG.USERS_DB_TOKEN_FILE + constants.pathToFile) and databaseURL');
  }
  
  const fs = require('fs');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  secondaryApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  }, 'user-favourites');
  
  secondaryDb = secondaryApp.database();
  return secondaryApp;
}

function db() {
  if (!secondaryDb) getSecondaryApp();
  return secondaryDb;
}

class UserFavoritesDB {
  constructor() {
    this.usersBase = '/users';
    this.favouritesByProductBase = '/favouritesByProduct';
    this.trackersByProductBase = '/trackersByProduct';
    this.saleSubscribersBase = '/saleSubscribers';
  }

  async getUserPreferences(userId) {
    const snapshot = await db().ref(`${this.usersBase}/${userId}/preferences`).once('value');
    return snapshot.val() || {};
  }

  async getUserChannels(userId) {
    const snapshot = await db().ref(`${this.usersBase}/${userId}/channels`).once('value');
    return snapshot.val() || {};
  }

  async getUsersFavouritedProduct(productCode) {
    const snapshot = await db().ref(`${this.favouritesByProductBase}/${productCode}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data);
  }

  async getUsersTrackingProduct(productCode) {
    const snapshot = await db().ref(`${this.trackersByProductBase}/${productCode}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data).map(uid => ({ uid, ...data[uid] }));
  }

  async getSaleSubscribers(saleId) {
    const snapshot = await db().ref(`${this.saleSubscribersBase}/${saleId}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data);
  }

  async getAllUsers() {
    const snapshot = await db().ref(this.usersBase).once('value');
    return snapshot.val() || {};
  }

  async getAllFavorites() {
    const snapshot = await db().ref(this.favouritesByProductBase).once('value');
    return snapshot.val() || {};
  }

  async getAllTrackers() {
    const snapshot = await db().ref(this.trackersByProductBase).once('value');
    return snapshot.val() || {};
  }

  // User favorites management methods
  async getFavoriteProducts(userId) {
    try {
      const snapshot = await db().ref(`${this.usersBase}/${userId}/favorites`).once('value');
      const favorites = snapshot.val() || {};
      return Object.keys(favorites);
    } catch (error) {
      console.error(`Error getting favorite products for user ${userId}:`, error);
      return [];
    }
  }

  async getTrackedProducts(userId) {
    try {
      const snapshot = await db().ref(`${this.usersBase}/${userId}/trackedProducts`).once('value');
      const tracked = snapshot.val() || {};
      return Object.entries(tracked);
    } catch (error) {
      console.error(`Error getting tracked products for user ${userId}:`, error);
      return [];
    }
  }

  async addFavorite(userId, productCode, productData = {}) {
    try {
      const updates = {};
      updates[`${this.usersBase}/${userId}/favorites/${productCode}`] = {
        addedAt: Date.now(),
        ...productData
      };
      updates[`${this.favouritesByProductBase}/${productCode}/${userId}`] = {
        addedAt: Date.now()
      };
      
      await db().ref().update(updates);
      return true;
    } catch (error) {
      console.error(`Error adding favorite for user ${userId}, product ${productCode}:`, error);
      return false;
    }
  }

  async removeFavorite(userId, productCode) {
    try {
      const updates = {};
      updates[`${this.usersBase}/${userId}/favorites/${productCode}`] = null;
      updates[`${this.favouritesByProductBase}/${productCode}/${userId}`] = null;
      
      await db().ref().update(updates);
      return true;
    } catch (error) {
      console.error(`Error removing favorite for user ${userId}, product ${productCode}:`, error);
      return false;
    }
  }

  async addTrackedProduct(userId, productCode, trackingData) {
    try {
      const updates = {};
      updates[`${this.usersBase}/${userId}/trackedProducts/${productCode}`] = {
        trackedAt: Date.now(),
        ...trackingData
      };
      updates[`${this.trackersByProductBase}/${productCode}/${userId}`] = {
        trackedAt: Date.now(),
        ...trackingData
      };
      
      await db().ref().update(updates);
      return true;
    } catch (error) {
      console.error(`Error adding tracked product for user ${userId}, product ${productCode}:`, error);
      return false;
    }
  }

  async removeTrackedProduct(userId, productCode) {
    try {
      const updates = {};
      updates[`${this.usersBase}/${userId}/trackedProducts/${productCode}`] = null;
      updates[`${this.trackersByProductBase}/${productCode}/${userId}`] = null;
      
      await db().ref().update(updates);
      return true;
    } catch (error) {
      console.error(`Error removing tracked product for user ${userId}, product ${productCode}:`, error);
      return false;
    }
  }

  // User management methods
  async createUser(userId, userData) {
    try {
      await db().ref(`${this.usersBase}/${userId}`).set({
        createdAt: Date.now(),
        ...userData
      });
      return true;
    } catch (error) {
      console.error(`Error creating user ${userId}:`, error);
      return false;
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      await db().ref(`${this.usersBase}/${userId}/preferences`).update(preferences);
      return true;
    } catch (error) {
      console.error(`Error updating preferences for user ${userId}:`, error);
      return false;
    }
  }

  async updateUserChannels(userId, channels) {
    try {
      await db().ref(`${this.usersBase}/${userId}/channels`).update(channels);
      return true;
    } catch (error) {
      console.error(`Error updating channels for user ${userId}:`, error);
      return false;
    }
  }

  async getUser(userId) {
    try {
      const snapshot = await db().ref(`${this.usersBase}/${userId}`).once('value');
      return snapshot.val() || null;
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      return null;
    }
  }

  async deleteUser(userId) {
    try {
      // Get user's favorites and tracked products first
      const user = await this.getUser(userId);
      if (!user) return false;

      const updates = {};
      
      // Remove user from favorites by product
      if (user.favorites) {
        Object.keys(user.favorites).forEach(productCode => {
          updates[`${this.favouritesByProductBase}/${productCode}/${userId}`] = null;
        });
      }

      // Remove user from trackers by product
      if (user.trackedProducts) {
        Object.keys(user.trackedProducts).forEach(productCode => {
          updates[`${this.trackersByProductBase}/${productCode}/${userId}`] = null;
        });
      }

      // Remove user data
      updates[`${this.usersBase}/${userId}`] = null;

      await db().ref().update(updates);
      return true;
    } catch (error) {
      console.error(`Error deleting user ${userId}:`, error);
      return false;
    }
  }
}

const userFavoritesDB = new UserFavoritesDB();
module.exports = { userFavoritesDB, getSecondaryApp };


