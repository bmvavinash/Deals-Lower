const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { firebaseget } = require('../../../database/firebaseget');
const firebasePut = require('../../../database/firebaseput');
const { getAccessToken } = require('../../../database/getAccessToken');
const constants = require('../../../config/constants');
const { spawn } = require('child_process');
const path = require('path');

const logger = getModuleLogger('matching-config-api');

// Helper to fetch the config from Firebase
async function getMatchingConfig() {
  try {
    const accessToken = await getAccessToken(constants.env);
    // You might want to store this in a specific node, e.g., 'config/categoryMatchingRules'
    const DB_Name = require('../../../config/config').DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
    const baseUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    const url = `${baseUrl}/config/categoryMatchingRules.json?access_token=${accessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data || {};
  } catch (error) {
    logger.error('Error fetching matching config', { error: error.message });
    return {};
  }
}

// Helper to save the config to Firebase
async function saveMatchingConfig(config) {
  try {
    const accessToken = await getAccessToken(constants.env);
    const DB_Name = require('../../../config/config').DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
    const baseUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    const url = `${baseUrl}/config/categoryMatchingRules.json?access_token=${accessToken}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    return response.ok;
  } catch (error) {
    logger.error('Error saving matching config', { error: error.message });
    return false;
  }
}

/**
 * GET /api/matching-config
 * Retrieves the current category-to-platform matching rules
 */
router.get('/', async (req, res) => {
  try {
    const config = await getMatchingConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/matching-config
 * Updates the category-to-platform matching rules
 */
router.post('/', async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid config format' });
    }
    
    const success = await saveMatchingConfig(config);
    if (success) {
      res.json({ success: true, message: 'Configuration saved successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save configuration to database' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/matching-config/trigger
 * Triggers the background matching script
 */
router.post('/trigger', async (req, res) => {
  try {
    logger.info('Manual trigger of category-wise matching script');
    
    const scriptPath = path.join(__dirname, '../../../scripts/categoryWiseMatcher.js');
    const process = spawn('node', [scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    process.unref();
    
    res.json({ 
      success: true, 
      message: 'Matching script started in the background' 
    });
  } catch (error) {
    logger.error('Failed to trigger matching script', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/matching-config/trigger-live
 * Triggers the background live competitor scraper matching script
 */
router.post('/trigger-live', async (req, res) => {
  try {
    logger.info('Manual trigger of live competitor scraper matching script');
    
    const scriptPath = path.join(__dirname, '../../../scripts/liveCompetitorScraper.js');
    const process = spawn('node', [scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    process.unref();
    
    res.json({ 
      success: true, 
      message: 'Live competitor scraping matching script started in the background' 
    });
  } catch (error) {
    logger.error('Failed to trigger live competitor scraping matching script', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

