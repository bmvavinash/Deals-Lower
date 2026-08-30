process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');
const { favoritesNotificationService } = require('../services/favoritesNotificationService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('runFavoritesService');

async function run() {
    logger.info('🚀 Starting user favorites notification checks...');
    
    try {
        // Initialize default Firebase Admin app if not already initialized
        const dbname = constants.postingTypesConfig[constants.type].DB;
        const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
        const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
        const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
        const databaseURL = DB_Name === 'lowerdealhub'
          ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
          : `https://${DB_Name}-default-rtdb.firebaseio.com`;

        if (!admin.apps.find(app => app.name === '[DEFAULT]')) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL
          });
          logger.info('Firebase default app initialized successfully');
        }

        const result = await favoritesNotificationService.runOnce();
        logger.info('✅ User favorites checks completed successfully!', { result });
        process.exit(0);
    } catch (error) {
        logger.error('❌ User favorites checks failed:', error);
        process.exit(1);
    }
}

run();

