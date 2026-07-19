process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('expired-deals-cleaner');

if (!admin.apps.length) {
  const dbname = constants.postingTypesConfig[constants.type].DB;
  const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
  const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
  
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

async function cleanupExpiredDealsAndBanners() {
  logger.info('🧹 Starting expired deals and banners database cleanup...');
  const productdealsRef = db.ref('productdeals');
  const staticRef = db.ref('productdeals_static');
  const dealsRef = db.ref('deals');
  const bannersRef = db.ref('banners');
  
  const now = Date.now();
  let expiredDealsWiped = 0;
  let hotDealsDeleted = 0;
  let bannersDeactivated = 0;

  try {
    // 1. Process productdeals (and productdeals_static)
    logger.info('Fetching productdeals for expiration check...');
    const productDealsSnapshot = await productdealsRef.once('value');
    const productDeals = productDealsSnapshot.val() || {};
    
    for (const [key, product] of Object.entries(productDeals)) {
      if (product.isDeal || product.dealExpiresAt) {
        const expiry = Number(product.dealExpiresAt);
        // Wipe deal if expiry is in the past
        if (expiry && expiry <= now) {
          logger.info(`Wiping expired deal from productdeals: ${key} (Expired at ${new Date(expiry).toISOString()})`);
          
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
    }
    
    // 2. Process deals (Hot Deals) - delete completely if expired
    logger.info('Fetching hot deals for expiration check...');
    const hotDealsSnapshot = await dealsRef.once('value');
    const hotDeals = hotDealsSnapshot.val() || {};
    
    for (const [key, deal] of Object.entries(hotDeals)) {
      const expiry = Number(deal.dealExpiresAt);
      if (expiry && expiry <= now) {
        logger.info(`Deleting expired hot deal: ${key}`);
        await dealsRef.child(key).remove();
        hotDealsDeleted++;
      }
    }

    // 3. Process banners - mark inactive/expired if past expiration
    logger.info('Fetching banners for expiration check...');
    const bannersSnapshot = await bannersRef.once('value');
    const banners = bannersSnapshot.val() || {};
    
    for (const [key, banner] of Object.entries(banners)) {
      if (banner.isActive) {
        const expiry = Number(banner.expirationTimestamp);
        if (expiry && expiry <= now) {
          logger.info(`Deactivating expired banner: ${key} (Expired at ${new Date(expiry).toISOString()})`);
          await bannersRef.child(key).update({
            isActive: false,
            updateTimestamp: new Date().toISOString()
          });
          bannersDeactivated++;
        }
      }
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
    throw error;
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
