const { getModuleLogger } = require('../logger/logger');
const { 
  findMatchingHierarchy, 
  generateHierarchicalKey, 
  parseHierarchicalKey,
  getCategoryHierarchy,
  getSubcategory,
  getProductStyles,
  getAllCategories
} = require('../config/categoryHierarchy');

const logger = getModuleLogger('categoryHierarchyUtils');

/**
 * Utility functions for working with hierarchical categories
 */

/**
 * Analyze product category data and suggest improvements
 * @param {Object} product - Product object with category data
 * @returns {Object} Analysis results with suggestions
 */
function analyzeProductCategory(product) {
  const analysis = {
    productCode: product.productCode || '',
    currentCategory: product.category || {},
    currentHierarchy: product.hierarchicalCategory || {},
    suggestions: [],
    confidence: 0,
    issues: []
  };

  try {
    // Check if hierarchical category is already populated
    if (product.hierarchicalCategory?.hierarchicalKey) {
      analysis.confidence = 100;
      analysis.suggestions.push('Hierarchical category already populated');
      return analysis;
    }

    // Analyze current category data
    const categoryData = product.category || {};
    const { mainCategory, c1, c2, c3, c4, c5 } = categoryData;

    // Check for missing category data
    if (!mainCategory && !c1) {
      analysis.issues.push('No main category found');
      analysis.confidence = 0;
    } else {
      analysis.confidence += 30;
    }

    // Check for subcategory data
    if (!c2 && !c3) {
      analysis.issues.push('No subcategory data found');
    } else {
      analysis.confidence += 20;
    }

    // Check for style data
    if (!c3 && !c4 && !c5) {
      analysis.issues.push('No style/variant data found');
    } else {
      analysis.confidence += 20;
    }

    // Try to find matching hierarchy
    const hierarchy = findMatchingHierarchy(categoryData);
    
    if (hierarchy.mainCategory) {
      analysis.confidence += 30;
      analysis.suggestions.push(`Suggested main category: ${hierarchy.mainCategory}`);
    }

    if (hierarchy.subcategory) {
      analysis.suggestions.push(`Suggested subcategory: ${hierarchy.subcategory}`);
    }

    if (hierarchy.style) {
      analysis.suggestions.push(`Suggested style: ${hierarchy.style}`);
    }

    // Check for potential improvements
    if (hierarchy.mainCategory && !hierarchy.subcategory) {
      analysis.suggestions.push('Consider adding more specific subcategory data');
    }

    if (hierarchy.subcategory && !hierarchy.style) {
      analysis.suggestions.push('Consider adding style/variant information');
    }

    // Check for data quality issues
    if (mainCategory && mainCategory.length < 3) {
      analysis.issues.push('Main category name seems too short');
    }

    if (c2 && c2.length < 3) {
      analysis.issues.push('Subcategory name seems too short');
    }

  } catch (error) {
    logger.error('Error analyzing product category', { 
      error: error.message, 
      productCode: product.productCode 
    });
    analysis.issues.push('Error during analysis');
  }

  return analysis;
}

/**
 * Batch analyze multiple products
 * @param {Array} products - Array of product objects
 * @returns {Object} Batch analysis results
 */
function batchAnalyzeProducts(products) {
  const results = {
    totalProducts: products.length,
    analyzedProducts: 0,
    issues: {
      noMainCategory: 0,
      noSubcategory: 0,
      noStyle: 0,
      shortNames: 0,
      errors: 0
    },
    suggestions: {
      addSubcategory: 0,
      addStyle: 0,
      improveNaming: 0
    },
    confidenceDistribution: {
      high: 0,    // 80-100%
      medium: 0,  // 50-79%
      low: 0      // 0-49%
    },
    products: []
  };

  for (const product of products) {
    try {
      const analysis = analyzeProductCategory(product);
      results.analyzedProducts++;
      results.products.push(analysis);

      // Count issues
      if (analysis.issues.includes('No main category found')) {
        results.issues.noMainCategory++;
      }
      if (analysis.issues.includes('No subcategory data found')) {
        results.issues.noSubcategory++;
      }
      if (analysis.issues.includes('No style/variant data found')) {
        results.issues.noStyle++;
      }
      if (analysis.issues.some(issue => issue.includes('seems too short'))) {
        results.issues.shortNames++;
      }
      if (analysis.issues.includes('Error during analysis')) {
        results.issues.errors++;
      }

      // Count suggestions
      if (analysis.suggestions.some(s => s.includes('subcategory'))) {
        results.suggestions.addSubcategory++;
      }
      if (analysis.suggestions.some(s => s.includes('style'))) {
        results.suggestions.addStyle++;
      }
      if (analysis.suggestions.some(s => s.includes('improve'))) {
        results.suggestions.improveNaming++;
      }

      // Count confidence levels
      if (analysis.confidence >= 80) {
        results.confidenceDistribution.high++;
      } else if (analysis.confidence >= 50) {
        results.confidenceDistribution.medium++;
      } else {
        results.confidenceDistribution.low++;
      }

    } catch (error) {
      logger.error('Error in batch analysis', { 
        error: error.message, 
        productCode: product.productCode 
      });
      results.issues.errors++;
    }
  }

  return results;
}

/**
 * Generate category hierarchy report
 * @param {Array} products - Array of product objects
 * @returns {Object} Hierarchy report
 */
function generateHierarchyReport(products) {
  const report = {
    totalProducts: products.length,
    hierarchyStats: {
      mainCategories: {},
      subcategories: {},
      styles: {},
      hierarchicalKeys: {}
    },
    coverage: {
      hasHierarchy: 0,
      hasMainCategory: 0,
      hasSubcategory: 0,
      hasStyle: 0
    },
    recommendations: []
  };

  for (const product of products) {
    const hierarchical = product.hierarchicalCategory || {};
    const { mainCategory, subcategory, style, hierarchicalKey } = hierarchical;

    // Count coverage
    if (hierarchicalKey) {
      report.coverage.hasHierarchy++;
    }
    if (mainCategory) {
      report.coverage.hasMainCategory++;
    }
    if (subcategory) {
      report.coverage.hasSubcategory++;
    }
    if (style) {
      report.coverage.hasStyle++;
    }

    // Count categories
    if (mainCategory) {
      report.hierarchyStats.mainCategories[mainCategory] = 
        (report.hierarchyStats.mainCategories[mainCategory] || 0) + 1;
    }

    if (mainCategory && subcategory) {
      const subKey = `${mainCategory}_${subcategory}`;
      report.hierarchyStats.subcategories[subKey] = 
        (report.hierarchyStats.subcategories[subKey] || 0) + 1;
    }

    if (mainCategory && subcategory && style) {
      const styleKey = `${mainCategory}_${subcategory}_${style}`;
      report.hierarchyStats.styles[styleKey] = 
        (report.hierarchyStats.styles[styleKey] || 0) + 1;
    }

    if (hierarchicalKey) {
      report.hierarchyStats.hierarchicalKeys[hierarchicalKey] = 
        (report.hierarchyStats.hierarchicalKeys[hierarchicalKey] || 0) + 1;
    }
  }

  // Calculate coverage percentages
  const total = report.totalProducts;
  report.coverage.hasHierarchyPercent = total > 0 ? (report.coverage.hasHierarchy / total * 100).toFixed(2) : 0;
  report.coverage.hasMainCategoryPercent = total > 0 ? (report.coverage.hasMainCategory / total * 100).toFixed(2) : 0;
  report.coverage.hasSubcategoryPercent = total > 0 ? (report.coverage.hasSubcategory / total * 100).toFixed(2) : 0;
  report.coverage.hasStylePercent = total > 0 ? (report.coverage.hasStyle / total * 100).toFixed(2) : 0;

  // Generate recommendations
  if (report.coverage.hasHierarchyPercent < 50) {
    report.recommendations.push('Consider running migration to populate hierarchical categories');
  }

  if (report.coverage.hasSubcategoryPercent < 70) {
    report.recommendations.push('Improve subcategory extraction from product pages');
  }

  if (report.coverage.hasStylePercent < 40) {
    report.recommendations.push('Enhance style/variant detection for better categorization');
  }

  const uniqueMainCategories = Object.keys(report.hierarchyStats.mainCategories).length;
  if (uniqueMainCategories < 5) {
    report.recommendations.push('Consider expanding category coverage across more main categories');
  }

  return report;
}

/**
 * Suggest category improvements for a product
 * @param {Object} product - Product object
 * @returns {Array} Array of improvement suggestions
 */
function suggestCategoryImprovements(product) {
  const suggestions = [];
  const hierarchical = product.hierarchicalCategory || {};
  const { mainCategory, subcategory, style } = hierarchical;

  // Check if product has basic category data
  if (!mainCategory) {
    suggestions.push({
      type: 'critical',
      message: 'Add main category classification',
      action: 'Extract main category from product title or description'
    });
  }

  if (mainCategory && !subcategory) {
    suggestions.push({
      type: 'important',
      message: 'Add subcategory classification',
      action: 'Extract subcategory from product details or breadcrumbs'
    });
  }

  if (subcategory && !style) {
    suggestions.push({
      type: 'enhancement',
      message: 'Add style/variant classification',
      action: 'Extract style information from product attributes'
    });
  }

  // Check for specific category improvements
  if (mainCategory === 'electronics') {
    if (!subcategory) {
      suggestions.push({
        type: 'important',
        message: 'Specify electronics subcategory (phones, headsets, laptops, etc.)',
        action: 'Analyze product title and description for electronics subcategory'
      });
    }

    if (subcategory === 'headsets' && !style) {
      suggestions.push({
        type: 'enhancement',
        message: 'Specify headset style (earbuds, neckbands, wireless, etc.)',
        action: 'Extract style information from product attributes'
      });
    }
  }

  if (mainCategory === 'fashion') {
    if (!subcategory) {
      suggestions.push({
        type: 'important',
        message: 'Specify fashion subcategory (clothing, shoes, accessories)',
        action: 'Analyze product title for fashion subcategory'
      });
    }

    if (subcategory && !style) {
      suggestions.push({
        type: 'enhancement',
        message: 'Add specific style information',
        action: 'Extract style details from product attributes'
      });
    }
  }

  return suggestions;
}

/**
 * Validate hierarchical category data
 * @param {Object} hierarchicalCategory - Hierarchical category object
 * @returns {Object} Validation results
 */
function validateHierarchicalCategory(hierarchicalCategory) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  const { mainCategory, subcategory, style, hierarchicalKey } = hierarchicalCategory || {};

  // Check required fields
  if (!mainCategory) {
    validation.isValid = false;
    validation.errors.push('Main category is required');
  }

  // Validate main category exists in hierarchy
  if (mainCategory) {
    const category = getCategoryHierarchy(mainCategory);
    if (!category) {
      validation.warnings.push(`Main category '${mainCategory}' not found in predefined hierarchy`);
    }
  }

  // Validate subcategory if provided
  if (subcategory && mainCategory) {
    const subcategoryData = getSubcategory(mainCategory, subcategory);
    if (!subcategoryData) {
      validation.warnings.push(`Subcategory '${subcategory}' not found for main category '${mainCategory}'`);
    }
  }

  // Validate style if provided
  if (style && subcategory && mainCategory) {
    const styles = getProductStyles(mainCategory, subcategory);
    if (!styles || !styles[style]) {
      validation.warnings.push(`Style '${style}' not found for ${mainCategory}/${subcategory}`);
    }
  }

  // Validate hierarchical key format
  if (hierarchicalKey) {
    const expectedKey = generateHierarchicalKey(mainCategory, subcategory, style);
    if (hierarchicalKey !== expectedKey) {
      validation.errors.push(`Hierarchical key mismatch. Expected: ${expectedKey}, Got: ${hierarchicalKey}`);
    }
  }

  return validation;
}

/**
 * Get category statistics summary
 * @param {Array} products - Array of product objects
 * @returns {Object} Statistics summary
 */
function getCategoryStatsSummary(products) {
  const stats = {
    totalProducts: products.length,
    categoryCoverage: {
      withHierarchy: 0,
      withMainCategory: 0,
      withSubcategory: 0,
      withStyle: 0
    },
    topCategories: {},
    topSubcategories: {},
    topStyles: {},
    qualityScore: 0
  };

  let totalQualityScore = 0;

  for (const product of products) {
    const hierarchical = product.hierarchicalCategory || {};
    const { mainCategory, subcategory, style } = hierarchical;

    // Count coverage
    if (hierarchical.hierarchicalKey) stats.categoryCoverage.withHierarchy++;
    if (mainCategory) stats.categoryCoverage.withMainCategory++;
    if (subcategory) stats.categoryCoverage.withSubcategory++;
    if (style) stats.categoryCoverage.withStyle++;

    // Count top categories
    if (mainCategory) {
      stats.topCategories[mainCategory] = (stats.topCategories[mainCategory] || 0) + 1;
    }

    if (mainCategory && subcategory) {
      const subKey = `${mainCategory}_${subcategory}`;
      stats.topSubcategories[subKey] = (stats.topSubcategories[subKey] || 0) + 1;
    }

    if (mainCategory && subcategory && style) {
      const styleKey = `${mainCategory}_${subcategory}_${style}`;
      stats.topStyles[styleKey] = (stats.topStyles[styleKey] || 0) + 1;
    }

    // Calculate quality score for this product
    let productScore = 0;
    if (mainCategory) productScore += 40;
    if (subcategory) productScore += 30;
    if (style) productScore += 30;
    totalQualityScore += productScore;
  }

  // Calculate overall quality score
  stats.qualityScore = products.length > 0 ? (totalQualityScore / products.length).toFixed(2) : 0;

  // Convert counts to percentages
  const total = stats.totalProducts;
  stats.categoryCoverage.withHierarchyPercent = total > 0 ? (stats.categoryCoverage.withHierarchy / total * 100).toFixed(2) : 0;
  stats.categoryCoverage.withMainCategoryPercent = total > 0 ? (stats.categoryCoverage.withMainCategory / total * 100).toFixed(2) : 0;
  stats.categoryCoverage.withSubcategoryPercent = total > 0 ? (stats.categoryCoverage.withSubcategory / total * 100).toFixed(2) : 0;
  stats.categoryCoverage.withStylePercent = total > 0 ? (stats.categoryCoverage.withStyle / total * 100).toFixed(2) : 0;

  return stats;
}

module.exports = {
  analyzeProductCategory,
  batchAnalyzeProducts,
  generateHierarchyReport,
  suggestCategoryImprovements,
  validateHierarchicalCategory,
  getCategoryStatsSummary
};

