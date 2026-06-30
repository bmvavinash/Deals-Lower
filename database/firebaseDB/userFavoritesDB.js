const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const appConfig = require('../../config/config.js');
const path = require('path');
const fs = require('fs');

let secondaryApp = null;
let secondaryDb = null;
let isLocalFallback = false;

function getSecondaryApp() {
  if (secondaryApp) return secondaryApp;
  if (isLocalFallback) return null;
  
  try {
    // Use service account for users database (like main Firebase)
    let serviceAccountPath = constants.userFirebase?.serviceAccountPath;
    const databaseURL = constants.userFirebase?.databaseURL;
    
    // If serviceAccountPath is set but points to directory, construct full file path
    if (serviceAccountPath && appConfig?.DATABASE_CONFIG?.USERS_DB_TOKEN_FILE) {
      // Check if it's a directory (ends with no extension or is a directory)
      if (fs.existsSync(serviceAccountPath) && fs.statSync(serviceAccountPath).isDirectory()) {
        serviceAccountPath = path.join(serviceAccountPath, `${appConfig.DATABASE_CONFIG.USERS_DB_TOKEN_FILE}.json`);
        console.log('Constructed service account path:', serviceAccountPath);
      }
    }
    // If not explicitly set, derive from configured tokens path and USERS_DB_TOKEN_FILE
    else if (!serviceAccountPath && appConfig?.DATABASE_CONFIG?.USERS_DB_TOKEN_FILE && constants?.pathToFile) {
      serviceAccountPath = path.join(constants.pathToFile, `${appConfig.DATABASE_CONFIG.USERS_DB_TOKEN_FILE}.json`);
      console.log('Constructed service account path:', serviceAccountPath);
    }

    if (!serviceAccountPath || !databaseURL || !fs.existsSync(serviceAccountPath)) {
      throw new Error(`Users Firebase credentials file not found at ${serviceAccountPath || 'undefined'}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    secondaryApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL
    }, 'user-favourites');
    
    secondaryDb = secondaryApp.database();
    return secondaryApp;
  } catch (e) {
    console.log('⚠️ Firebase Users secondary database init failed. Using local JSON fallback database instead. Reason:', e.message);
    isLocalFallback = true;
    return null;
  }
}

function db() {
  if (isLocalFallback) return null;
  if (!secondaryDb) getSecondaryApp();
  return secondaryDb;
}

class UserFavoritesDB {
  constructor() {
    this.usersBase = '/users';
    this.favouritesByProductBase = '/favouritesByProduct';
    this.trackersByProductBase = '/trackersByProduct';
    this.saleSubscribersBase = '/saleSubscribers';
    this.localDbPath = path.join(__dirname, '../localFavoritesBackup.json');
    
    // Initialize secondary app and check fallback status
    getSecondaryApp();
  }

  getLocalData() {
    try {
      if (!fs.existsSync(this.localDbPath)) {
        const defaultDb = { users: {}, favouritesByProduct: {}, trackersByProduct: {}, saleSubscribers: {} };
        fs.writeFileSync(this.localDbPath, JSON.stringify(defaultDb, null, 2), 'utf8');
        return defaultDb;
      }
      return JSON.parse(fs.readFileSync(this.localDbPath, 'utf8'));
    } catch (e) {
      console.error('Error reading local fallback database:', e);
      return { users: {}, favouritesByProduct: {}, trackersByProduct: {}, saleSubscribers: {} };
    }
  }

  saveLocalData(data) {
    try {
      fs.writeFileSync(this.localDbPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Error writing local fallback database:', e);
      return false;
    }
  }

  async getUserPreferences(userId) {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return data.users?.[userId]?.preferences || {};
    }
    const snapshot = await db().ref(`${this.usersBase}/${userId}/preferences`).once('value');
    return snapshot.val() || {};
  }

  async getUserChannels(userId) {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return data.users?.[userId]?.channels || {};
    }
    const snapshot = await db().ref(`${this.usersBase}/${userId}/channels`).once('value');
    return snapshot.val() || {};
  }

  async getUsersFavouritedProduct(productCode) {
    if (isLocalFallback) {
      const data = this.getLocalData();
      const pData = data.favouritesByProduct?.[productCode] || {};
      return Object.keys(pData);
    }
    const snapshot = await db().ref(`${this.favouritesByProductBase}/${productCode}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data);
  }

  async getUsersTrackingProduct(productCode) {
    if (isLocalFallback) {
      const data = this.getLocalData();
      const pData = data.trackersByProduct?.[productCode] || {};
      return Object.keys(pData).map(uid => ({ uid, ...pData[uid] }));
    }
    const snapshot = await db().ref(`${this.trackersByProductBase}/${productCode}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data).map(uid => ({ uid, ...data[uid] }));
  }

  async getSaleSubscribers(saleId) {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return Object.keys(data.saleSubscribers?.[saleId] || {});
    }
    const snapshot = await db().ref(`${this.saleSubscribersBase}/${saleId}`).once('value');
    const data = snapshot.val() || {};
    return Object.keys(data);
  }

  async getAllUsers() {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return data.users || {};
    }
    const snapshot = await db().ref(this.usersBase).once('value');
    return snapshot.val() || {};
  }

  async getAllFavorites() {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return data.favouritesByProduct || {};
    }
    const snapshot = await db().ref(this.favouritesByProductBase).once('value');
    return snapshot.val() || {};
  }

  async getAllTrackers() {
    if (isLocalFallback) {
      const data = this.getLocalData();
      return data.trackersByProduct || {};
    }
    const snapshot = await db().ref(this.trackersByProductBase).once('value');
    return snapshot.val() || {};
  }

  // User favorites management methods
  async getFavoriteProducts(userId) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        const favorites = data.users?.[userId]?.favorites || {};
        return Object.keys(favorites);
      }
      const snapshot = await db().ref(`${this.usersBase}/${userId}/favorites`).once('value');
      const favorites = snapshot.val() || {};
      return Object.keys(favorites);
    } catch (error) {
      console.error(`Error getting favorite products for user ${userId}:`, error);
      return [];
    }
  }

  async getFavoriteProductsData(userId) {
    try {
      const snapshot = await db().ref(`${this.usersBase}/${userId}/favorites`).once('value');
      return snapshot.val() || {};
    } catch (error) {
      console.error(`Error getting favorite products data for user ${userId}:`, error);
      return {};
    }
  }

  async getTrackedProducts(userId) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        const tracked = data.users?.[userId]?.trackedProducts || {};
        return Object.entries(tracked);
      }
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
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (!data.users[userId]) {
          data.users[userId] = { createdAt: Date.now(), favorites: {}, trackedProducts: {}, preferences: {}, channels: {} };
        }
        if (!data.users[userId].favorites) data.users[userId].favorites = {};
        data.users[userId].favorites[productCode] = {
          addedAt: Date.now(),
          ...productData
        };
        if (!data.favouritesByProduct[productCode]) data.favouritesByProduct[productCode] = {};
        data.favouritesByProduct[productCode][userId] = {
          addedAt: Date.now()
        };
        this.saveLocalData(data);
        return true;
      }

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
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (data.users[userId]?.favorites) {
          delete data.users[userId].favorites[productCode];
        }
        if (data.favouritesByProduct[productCode]) {
          delete data.favouritesByProduct[productCode][userId];
          if (Object.keys(data.favouritesByProduct[productCode]).length === 0) {
            delete data.favouritesByProduct[productCode];
          }
        }
        this.saveLocalData(data);
        return true;
      }

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

  async updateFavoriteStatus(userId, productCode, statusData) {
    try {
      await db().ref(`${this.usersBase}/${userId}/favorites/${productCode}`).update({
        ...statusData,
        lastCheckedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error(`Error updating favorite status for user ${userId}, product ${productCode}:`, error);
      return false;
    }
  }

  async addTrackedProduct(userId, productCode, trackingData) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (!data.users[userId]) {
          data.users[userId] = { createdAt: Date.now(), favorites: {}, trackedProducts: {}, preferences: {}, channels: {} };
        }
        if (!data.users[userId].trackedProducts) data.users[userId].trackedProducts = {};
        data.users[userId].trackedProducts[productCode] = {
          trackedAt: Date.now(),
          ...trackingData
        };
        if (!data.trackersByProduct[productCode]) data.trackersByProduct[productCode] = {};
        data.trackersByProduct[productCode][userId] = {
          trackedAt: Date.now(),
          ...trackingData
        };
        this.saveLocalData(data);
        return true;
      }

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
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (data.users[userId]?.trackedProducts) {
          delete data.users[userId].trackedProducts[productCode];
        }
        if (data.trackersByProduct[productCode]) {
          delete data.trackersByProduct[productCode][userId];
          if (Object.keys(data.trackersByProduct[productCode]).length === 0) {
            delete data.trackersByProduct[productCode];
          }
        }
        this.saveLocalData(data);
        return true;
      }

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
      if (isLocalFallback) {
        const data = this.getLocalData();
        data.users[userId] = {
          createdAt: Date.now(),
          favorites: {},
          trackedProducts: {},
          preferences: {},
          channels: {},
          ...userData
        };
        this.saveLocalData(data);
        return true;
      }

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
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (!data.users[userId]) {
          data.users[userId] = { createdAt: Date.now(), favorites: {}, trackedProducts: {}, preferences: {}, channels: {} };
        }
        data.users[userId].preferences = {
          ...data.users[userId].preferences,
          ...preferences
        };
        this.saveLocalData(data);
        return true;
      }

      await db().ref(`${this.usersBase}/${userId}/preferences`).update(preferences);
      return true;
    } catch (error) {
      console.error(`Error updating preferences for user ${userId}:`, error);
      return false;
    }
  }

  async updateUserChannels(userId, channels) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        if (!data.users[userId]) {
          data.users[userId] = { createdAt: Date.now(), favorites: {}, trackedProducts: {}, preferences: {}, channels: {} };
        }
        data.users[userId].channels = {
          ...data.users[userId].channels,
          ...channels
        };
        this.saveLocalData(data);
        return true;
      }

      await db().ref(`${this.usersBase}/${userId}/channels`).update(channels);
      return true;
    } catch (error) {
      console.error(`Error updating channels for user ${userId}:`, error);
      return false;
    }
  }

  async getUser(userId) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        return data.users?.[userId] || null;
      }

      const snapshot = await db().ref(`${this.usersBase}/${userId}`).once('value');
      return snapshot.val() || null;
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      return null;
    }
  }

  async deleteUser(userId) {
    try {
      if (isLocalFallback) {
        const data = this.getLocalData();
        const user = data.users?.[userId];
        if (!user) return false;

        if (user.favorites) {
          Object.keys(user.favorites).forEach(productCode => {
            if (data.favouritesByProduct[productCode]) {
              delete data.favouritesByProduct[productCode][userId];
              if (Object.keys(data.favouritesByProduct[productCode]).length === 0) {
                delete data.favouritesByProduct[productCode];
              }
            }
          });
        }

        if (user.trackedProducts) {
          Object.keys(user.trackedProducts).forEach(productCode => {
            if (data.trackersByProduct[productCode]) {
              delete data.trackersByProduct[productCode][userId];
              if (Object.keys(data.trackersByProduct[productCode]).length === 0) {
                delete data.trackersByProduct[productCode];
              }
            }
          });
        }

        delete data.users[userId];
        this.saveLocalData(data);
        return true;
      }

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


