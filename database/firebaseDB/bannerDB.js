const config = require('../../config/config.js');
var constants = require('../../config/constants.js');
const { getModuleLogger } = require("../../logger/logger.js");
// console.log = require("../../logger/logger.js");
var firebase = require('firebase/app');
var database = require('firebase/database');
const admin = require('firebase-admin');

const logger = getModuleLogger('bannerDB');
const BANNERS_PATH = 'banners';

// const { getModuleLogger } = require("../../logger/logger.js");
// console.log = require("../../logger/logger.js");

env=constants.env


const productStatus = {
  BANNER_UPDATED: 'Banner updated successfully',
  BANNER_CREATED: 'Banner created successfully',
};


const dbname= constants.postingTypesConfig[constants.type].DB
let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
});

const db = admin.database();


const firebaseConfig = {

    apiKey: constants.FirebaseApiKey,
    authDomain: `${DB_Name}.firebaseapp.com`,
    databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`,
    projectId: `${DB_Name}`,
    storageBucket: `${DB_Name}.appspot.com`,
    messagingSenderId: "848061960225",
    appId: "1:848061960225:web:30d1b2fbd6c6243b2e1360",
    measurementId: "G-HJNCM2MN6Q"
        
  // Your Firebase configuration
};
const app = firebase.initializeApp(firebaseConfig);
// const db = database.getDatabase(app);

// const db = getDatabase(app); // Get the database instance
// const ref = ref(db, '/deals'); // Create a reference to the '/deals' path

var ref = database.ref(db, '/deals');

// Unified function to create/update banners
async function updateBanner(bannerId, updatedData) {
  // logger.info(`updateBanner() called for ID=${bannerId}`, { updatedData });
  // console.log(`updateBanner() called for ID=${bannerId}`, { updatedData });

  try {
    const bannerRef = db.ref(`${BANNERS_PATH}/${bannerId}`);
    logger.debug(`Fetching existing banner at ${BANNERS_PATH}/${bannerId}`);
    // console.log(`Fetching existing banner at ${BANNERS_PATH}/${bannerId}`);
    const bannerSnapshot = await bannerRef.once('value');

    const now = new Date().toISOString();
    const defaultData = {
      isActive: true,
      order: 0,
      creationTimestamp: now,
      updateTimestamp: now,
    };

    if (bannerSnapshot.exists()) {
      logger.info(`Banner ${bannerId} exists – will update`);
      // console.log(`Banner ${bannerId} exists – will update`);
      const existingData = bannerSnapshot.val();
      logger.debug('Existing data:', existingData);
      // console.log('Existing data:', existingData);

      const mergedData = {
        ...existingData,
        ...updatedData,
        updateTimestamp: now,
        creationTimestamp: existingData.creationTimestamp || now,
      };

      // Preserve critical fields
      ['id', 'creationTimestamp'].forEach(field => {
        if (existingData[field]) {
          mergedData[field] = existingData[field];
          logger.debug(`Preserved field ${field}:`, existingData[field]);
          // console.log(`Preserved field ${field}:`, existingData[field]);
        }
      });

      logger.debug('Merged data to write:', mergedData);
      // console.log('Merged data to write:', mergedData);
      await bannerRef.update(mergedData);
      logger.info(`Banner ${bannerId} updated successfully`);
      // console.log(`Banner ${bannerId} updated successfully`);
      return { status: 200, message: productStatus.BANNER_UPDATED };
    } else {
      logger.info(`Banner ${bannerId} does not exist – will create new`);
      // console.log(`Banner ${bannerId} does not exist – will create new`);
      const newBanner = {
        ...defaultData,
        ...updatedData,
        id: bannerId,
        creationTimestamp: now,
      };
      logger.debug('New banner data:', newBanner);
      // console.log('New banner data:', newBanner);

      await bannerRef.set(newBanner);
      logger.info(`New banner ${bannerId} created successfully`);
      // console.log(`New banner ${bannerId} created successfully`);
      return { status: 201, message: productStatus.BANNER_CREATED };
    }
  } catch (error) {
    logger.error(`Error in updateBanner(${bannerId}):`, error);
    // console.log(`Error in updateBanner(${bannerId}):`, error);
    return {
      status: error.code === 'permission-denied' ? 403 : 500,
      message: error.message,
    };
  }
}

/**
 * Seed Firebase with a set of default banners.
 */
async function initializeBanners() {
  // logger.info('initializeBanners() called – seeding default banners');
  // console.log('initializeBanners() called – seeding default banners');
  const defaultBanners = [
    {
      id: 'amazon-summer-banner',
      url: 'https://a.media-amazon.com/images/G/31/prime/MayART/header/New/AMAZON-PRIME-MAY-ART-PC-HEADER-1_4_1.gif',
      order: 0,
      isActive: true,
      clickRedirectUrl: '/deals',
      expirationTimestamp: null,
    },
    {
      id: 'flipkart-summer-banner',
      url: 'https://rukminim2.flixcart.com/fk-p-flap/1620/270/image/b692b7eec25beda6.jpg?q=20',
      order: 1,
      isActive: true,
      targetDealId: 'summer-deals-123',
      expirationTimestamp: '2024-08-31T23:59:59Z',
    },
  ];

  try {
    const results = await Promise.all(
      defaultBanners.map(banner => {
        logger.debug('Seeding banner:', banner.id);
        // console.log('Seeding banner:', banner.id);
        return updateBanner(banner.id, banner);
      })
    );
    const created = results.filter(r => r.status === 201).length;
    const updated = results.filter(r => r.status === 200).length;
    logger.info(`initializeBanners complete – created: ${created}, updated: ${updated}`);
    // console.log(`initializeBanners complete – created: ${created}, updated: ${updated}`);
    return { success: created, updated };
  } catch (error) {
    // logger.error('Error in initializeBanners():', error);
    // console.log('Error in initializeBanners():', error);
    return { status: 500, error: error.message };
  }
}

/**
 * Fetch all banners (raw).
 */
async function getBanners() {
  // logger.info('getBanners() called – fetching all banners');
  // console.log('getBanners() called – fetching all banners');
  try {
    const ref = db.ref(BANNERS_PATH);
    const snapshot = await ref.once('value');
    const data = snapshot.val();
    logger.debug('Raw banners data:', data);
    // console.log('Raw banners data:', data);
    return data;
  } catch (error) {
    logger.error('Error in getBanners():', error);
    // console.log('Error in getBanners():', error);
    throw error;
  }
}

getBanners();
initializeBanners();
updateBanner('test-banner', {
  url: 'https://example.com/test-banner.jpg',
  order: 1,
  isActive: true,
  clickRedirectUrl: '/test-deal',
  expirationTimestamp: '2024-12-31T23:59:59Z',
});

module.exports = {
  updateBanner,
  initializeBanners,
  getBanners,
};
