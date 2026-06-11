const express = require('express');
const router = express.Router();
const { COMPREHENSIVE_CATEGORY_HIERARCHY } = require('../../../config/comprehensiveCategoryHierarchy');

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

module.exports = router;
