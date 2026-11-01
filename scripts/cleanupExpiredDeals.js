process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('expired-deals-cleaner');

if (!admin.apps.length) {
  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === 'object'
        ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (_) {}
  }
  const dbname = constants.postingTypesConfig[constants.type].DB;
  const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`] || 'lowerdealhub';
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
  if (!serviceAccount) {
    try {
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    } catch (_) {}
  }
  
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

/**
 * Lean, memory-bounded expired deals and banners cleaner.
 * Uses shallow key queries to avoid downloading 200,000+ objects into V8 memory.
 */
async function cleanupExpiredDealsAndBanners(maxBatch = 100) {
  logger.info('🧹 Starting memory-efficient expired deals and banners cleanup...');
  const productdealsRef = db.ref('productdeals');
  const staticRef = db.ref('productdeals_static');
  const dealsRef = db.ref('deals');
  const bannersRef = db.ref('banners');
  
  const now = Date.now();
  let expiredDealsWiped = 0;
  let hotDealsDeleted = 0;
  let bannersDeactivated = 0;

  const DB_Name = config.DATABASE_CONFIG.DB1_NAME || 'lowerdealhub';
  const shallowBaseUrl = DB_Name === 'lowerdealhub'
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;

  try {
    // 1. Process Banners (typically ~2,000 entries - safe to check active ones)
    try {
      logger.info('Checking banners for expiration...');
      const bannersSnapshot = await bannersRef.once('value');
      const banners = bannersSnapshot.val() || {};
      
      for (const [key, banner] of Object.entries(banners)) {
        if (banner && banner.isActive) {
          const expiry = Number(banner.expirationTimestamp);
          if (expiry && expiry <= now) {
            logger.info(`Deactivating expired banner: ${key}`);
            await bannersRef.child(key).update({
              isActive: false,
              updateTimestamp: new Date().toISOString()
            });
            bannersDeactivated++;
          }
        }
      }
    } catch (bannerErr) {
      logger.warn('Banner expiration check error (non-fatal):', { error: bannerErr.message });
    }

    // 2. Process Deals (Hot Deals) via shallow keys (check newest 100 deals)
    try {
      logger.info('Fetching shallow deals keys for expiration check...');
      const dealsRes = await fetch(`${shallowBaseUrl}/deals.json?shallow=true`);
      if (dealsRes.ok) {
        const dealsKeysObj = await dealsRes.json();
        const allDealKeys = Object.keys(dealsKeysObj || {});
        // Focus on the newest 100 deals where active deals live
        const sampleDealKeys = allDealKeys.slice(-maxBatch);

        for (const key of sampleDealKeys) {
          try {
            const snap = await dealsRef.child(key).once('value');
            const deal = snap.val();
            if (deal && deal.dealExpiresAt) {
              const expiry = Number(deal.dealExpiresAt);
              if (expiry && expiry <= now) {
                logger.info(`Deleting expired hot deal: ${key}`);
                await dealsRef.child(key).remove();
                hotDealsDeleted++;
              }
            }
          } catch (_) {}
        }
      }
    } catch (dealErr) {
      logger.warn('Hot deals expiration check error (non-fatal):', { error: dealErr.message });
    }

    // 3. Process ProductDeals (check recent 50 products for expired deal badges)
    try {
      logger.info('Fetching shallow productdeals keys for deal badge expiration check...');
      const prodRes = await fetch(`${shallowBaseUrl}/productdeals.json?shallow=true`);
      if (prodRes.ok) {
        const prodKeysObj = await prodRes.json();
        const allProdKeys = Object.keys(prodKeysObj || {});
        const sampleProdKeys = allProdKeys.slice(-50);

        for (const key of sampleProdKeys) {
          try {
            const snap = await productdealsRef.child(key).once('value');
            const product = snap.val();
            if (product && (product.isDeal || product.dealExpiresAt)) {
              const expiry = Number(product.dealExpiresAt);
              if (expiry && expiry <= now) {
                logger.info(`Wiping expired deal badge from productdeals: ${key}`);
                const updates = {
                  isDeal: false,
                  dealName: null,
                  dealLabel: null,
                  dealExpiresAt: null,
                  deal: null,
                  limitedTimeDeal: null,
                  timer: null,
                  updateTimestamp: new Date().toISOString()
                };
                await productdealsRef.child(key).update(updates);
                await staticRef.child(key).update(updates);
                expiredDealsWiped++;
              }
            }
          } catch (_) {}
        }
      }
    } catch (prodErr) {
      logger.warn('Productdeals deal badge check error (non-fatal):', { error: prodErr.message });
    }

    logger.info('🧹 Expired deals and banners cleanup completed', {
      expiredDealsWiped,
      hotDealsDeleted,
      bannersDeactivated
    });
    
    return {
      expiredDealsWiped,
      hotDealsDeleted,
      bannersDeactivated
    };
  } catch (error) {
    logger.error('Error cleaning up expired deals and banners:', { error: error.message });
    return { expiredDealsWiped, hotDealsDeleted, bannersDeactivated };
  }
}

if (require.main === module) {
  cleanupExpiredDealsAndBanners()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredDealsAndBanners };
