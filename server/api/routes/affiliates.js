const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { getAccessToken } = require('../../../database/getAccessToken');
const config = require('../../../config/config');
const constants = require('../../../config/constants');

const logger = getModuleLogger('affiliatesAPI');

// Helper to get the correct REST URL
function getFirebaseRestUrl(path, token) {
  const dbname = constants.postingTypesConfig[constants.type].DB;
  const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  const baseUrl = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
  return `${baseUrl}/${path}.json?access_token=${token}`;
}

// GET /api/affiliates - Get all affiliates
router.get('/', async (req, res, next) => {
  try {
    const token = await getAccessToken();
    const url = getFirebaseRestUrl('affiliates', token);
    
    // In Node 22, fetch is built-in
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    
    const affiliatesData = await response.json() || {};
    
    const affiliatesList = Object.keys(affiliatesData).map(key => ({
      id: key,
      ...affiliatesData[key]
    }));
    
    res.json({
      success: true,
      data: affiliatesList
    });
  } catch (error) {
    logger.error('Error fetching affiliates via REST', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/affiliates/:id - Create or update an affiliate
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, amazonTagId } = req.body;
    
    if (!name || !amazonTagId) {
      return res.status(400).json({
        success: false,
        error: 'Name and Amazon Tag ID are required'
      });
    }

    const token = await getAccessToken();
    
    // Get existing to preserve createdAt
    const getUrl = getFirebaseRestUrl(`affiliates/${id}`, token);
    const getResponse = await fetch(getUrl);
    const existing = await getResponse.json();
    
    const affiliateData = {
      id,
      name,
      amazonTagId,
      updatedAt: new Date().toISOString(),
      createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString()
    };
    
    // PUT the new data (overwrites this node)
    const putResponse = await fetch(getUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(affiliateData)
    });
    
    if (!putResponse.ok) throw new Error(`Failed to save: ${putResponse.status}`);
    
    res.json({
      success: true,
      data: affiliateData
    });
  } catch (error) {
    logger.error('Error saving affiliate via REST', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/affiliates/:id - Delete an affiliate
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const token = await getAccessToken();
    const url = getFirebaseRestUrl(`affiliates/${id}`, token);
    
    const response = await fetch(url, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error(`Failed to delete: ${response.status}`);
    
    res.json({
      success: true,
      message: 'Affiliate deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting affiliate via REST', { error: error.message, id: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
