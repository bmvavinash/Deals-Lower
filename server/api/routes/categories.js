const express = require('express');
const router = express.Router();
const { COMPREHENSIVE_CATEGORY_HIERARCHY } = require('../../../config/comprehensiveCategoryHierarchy');
const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');

router.get('/hierarchy', (req, res) => {
  try {
    res.json({
      success: true,
      data: COMPREHENSIVE_CATEGORY_HIERARCHY
    });
  } catch (error) {
    console.error('Error serving category hierarchy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/categories/custom
router.get('/custom', async (req, res) => {
  try {
    const snapshot = await productDealsDB.customSubcategoriesRef.once('value');
    const customData = snapshot.val() || {};
    res.json({
      success: true,
      data: customData
    });
  } catch (error) {
    console.error('Error fetching custom categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/categories/custom
router.post('/custom', async (req, res) => {
  try {
    const { categoryGroup, subcategoryName } = req.body;
    
    if (!categoryGroup || !subcategoryName) {
      return res.status(400).json({ success: false, error: 'categoryGroup and subcategoryName are required' });
    }

    const cleanGroup = String(categoryGroup).toLowerCase().trim();
    const cleanSubName = String(subcategoryName).trim();

    if (!cleanSubName) {
      return res.status(400).json({ success: false, error: 'subcategoryName cannot be empty' });
    }

    // Fetch existing
    const snapshot = await productDealsDB.customSubcategoriesRef.child(cleanGroup).once('value');
    let subcategories = snapshot.val() || [];
    if (!Array.isArray(subcategories)) {
      subcategories = [];
    }

    // Add if not exists (case-insensitive check)
    const exists = subcategories.some(sub => sub.toLowerCase() === cleanSubName.toLowerCase());
    if (!exists) {
      subcategories.push(cleanSubName);
      await productDealsDB.customSubcategoriesRef.child(cleanGroup).set(subcategories);
    }

    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error adding custom subcategory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
