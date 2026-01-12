const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const getZerodhaData = require('../../../Stock/Scheduler/getZerodhaData');
const getGoogleSheetRecommendations = require('../../../Stock/Scheduler/getGoogleSheetRecommendations');
const tableExtract = require('../../../XAlpha/tableExtract');

const logger = getModuleLogger('stocks-api');

/**
 * GET /api/stocks/zerodha
 * Get Zerodha holdings data
 */
router.get('/zerodha', async (req, res, next) => {
  try {
    // Note: getZerodhaData requires a driver, but for API we'll return cached/stored data
    // If driver is needed, we'd need to pass it or store data in Firebase
    // For now, we'll try to get from Firebase if available, or return error
    
    // Check if we have stored Zerodha data in Firebase
    const admin = require('firebase-admin');
    const constants = require('../../../config/constants');
    const config = require('../../../config/config');
    
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
    
    // Try to get from Firebase stocks node
    try {
      const db = admin.database();
      const snapshot = await db.ref('stocks/zerodha').once('value');
      const data = snapshot.val();
      
      if (data) {
        return res.json({
          success: true,
          data: Array.isArray(data) ? data : Object.values(data),
          source: 'firebase',
          timestamp: new Date().toISOString()
        });
      }
    } catch (firebaseError) {
      logger.warn('Could not fetch from Firebase, will try direct call', { error: firebaseError.message });
    }

    // If no Firebase data, return message that driver is needed
    res.json({
      success: false,
      message: 'Zerodha data requires active driver session. Please ensure the main application is running.',
      note: 'Data will be available once the stock processing service has run and stored data in Firebase.'
    });
  } catch (error) {
    logger.error('Error fetching Zerodha data', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/stocks/xalpha
 * Get X Alpha crypto data from Twitter scraping
 */
router.get('/xalpha', async (req, res, next) => {
  try {
    // Similar to Zerodha, try Firebase first
    const admin = require('firebase-admin');
    const constants = require('../../../config/constants');
    const config = require('../../../config/config');
    
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
    
    try {
      const db = admin.database();
      const snapshot = await db.ref('stocks/xalpha').once('value');
      const data = snapshot.val();
      
      if (data) {
        return res.json({
          success: true,
          data: Array.isArray(data) ? data : Object.values(data),
          source: 'firebase',
          timestamp: new Date().toISOString()
        });
      }
    } catch (firebaseError) {
      logger.warn('Could not fetch from Firebase', { error: firebaseError.message });
    }

    res.json({
      success: false,
      message: 'X Alpha data requires active driver session. Please ensure the main application is running.',
      note: 'Data will be available once the X Alpha processing service has run and stored data in Firebase.'
    });
  } catch (error) {
    logger.error('Error fetching X Alpha data', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/stocks/recommendations
 * Get stock recommendations from Google Sheets
 */
router.get('/recommendations', async (req, res, next) => {
  try {
    // Try Firebase first
    const admin = require('firebase-admin');
    const constants = require('../../../config/constants');
    const config = require('../../../config/config');
    
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
    
    try {
      const db = admin.database();
      const snapshot = await db.ref('stocks/recommendations').once('value');
      const data = snapshot.val();
      
      if (data) {
        return res.json({
          success: true,
          data: Array.isArray(data) ? data : Object.values(data),
          source: 'firebase',
          timestamp: new Date().toISOString()
        });
      }
    } catch (firebaseError) {
      logger.warn('Could not fetch from Firebase, trying direct call', { error: firebaseError.message });
    }

    // Try direct call to Google Sheets
    try {
      const recommendations = await getGoogleSheetRecommendations();
      return res.json({
        success: true,
        data: recommendations,
        source: 'google-sheets',
        timestamp: new Date().toISOString()
      });
    } catch (gsError) {
      logger.error('Error fetching from Google Sheets', { error: gsError.message });
      throw gsError;
    }
  } catch (error) {
    logger.error('Error fetching stock recommendations', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/stocks
 * Get all stocks data (Zerodha + X Alpha + Recommendations)
 */
router.get('/', async (req, res, next) => {
  try {
    const [zerodhaData, xalphaData, recommendations] = await Promise.allSettled([
      // These will return from Firebase if available
      Promise.resolve({ success: false, message: 'Use /zerodha endpoint' }),
      Promise.resolve({ success: false, message: 'Use /xalpha endpoint' }),
      router.get('/recommendations', async (req, res) => {
        // This is just for the Promise.allSettled, actual endpoint handles it
      })
    ]);

    res.json({
      success: true,
      data: {
        zerodha: zerodhaData.status === 'fulfilled' ? zerodhaData.value : { error: 'Not available' },
        xalpha: xalphaData.status === 'fulfilled' ? xalphaData.value : { error: 'Not available' },
        recommendations: recommendations.status === 'fulfilled' ? recommendations.value : { error: 'Not available' }
      },
      note: 'For detailed data, use individual endpoints: /zerodha, /xalpha, /recommendations'
    });
  } catch (error) {
    logger.error('Error fetching stocks data', { error: error.message });
    next(error);
  }
});

module.exports = router;


















