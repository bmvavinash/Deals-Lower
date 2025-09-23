#!/usr/bin/env node

/**
 * Category Hierarchy Example Script
 * 
 * This script demonstrates how to use the hierarchical category system
 * for product categorization and management.
 * 
 * Usage:
 * node scripts/categoryHierarchyExample.js [command] [options]
 * 
 * Commands:
 * - init: Initialize category hierarchy in database
 * - migrate: Migrate existing products to hierarchical categories
 * - analyze: Analyze product category data
 * - search: Search products by hierarchical category
 * - stats: Get category statistics
 * - report: Generate category hierarchy report
 * - suggest: Get improvement suggestions for products
 */

const { getModuleLogger } = require('../logger/logger');
const { CategoryHierarchyDB } = require('../database/firebaseDB/categoryHierarchyDB');
const { 
  analyzeProductCategory, 
  batchAnalyzeProducts, 
  generateHierarchyReport,
  suggestCategoryImprovements,
  getCategoryStatsSummary
} = require('../utils/categoryHierarchyUtils');
const { 
  findMatchingHierarchy, 
  generateHierarchicalKey,
  getAllCategories 
} = require('../config/categoryHierarchy');

const logger = getModuleLogger('categoryHierarchyExample');
const categoryHierarchyDB = new CategoryHierarchyDB();

/**
 * Initialize category hierarchy
 */
async function initializeHierarchy() {
  try {
    console.log('🚀 Initializing category hierarchy...');
    await categoryHierarchyDB.initializeHierarchy();
    console.log('✅ Category hierarchy initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize hierarchy:', error.message);
    throw error;
  }
}

/**
 * Migrate existing products to hierarchical categories
 */
async function migrateProducts() {
  try {
    console.log('🔄 Starting product migration...');
    const result = await categoryHierarchyDB.migrateToHierarchical();
    console.log(`✅ Migration completed: ${result.migratedCount} products migrated`);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Analyze product category data
 */
async function analyzeProducts() {
  try {
    console.log('📊 Analyzing product categories...');
    
    // Get sample products
    const products = await categoryHierarchyDB.getProductsByMainCategory('electronics', 100);
    
    if (products.length === 0) {
      console.log('No products found for analysis');
      return;
    }

    const analysis = batchAnalyzeProducts(products);
    
    console.log('\n📈 Analysis Results:');
    console.log(`Total Products: ${analysis.totalProducts}`);
    console.log(`Analyzed: ${analysis.analyzedProducts}`);
    console.log('\nIssues Found:');
    console.log(`- No main category: ${analysis.issues.noMainCategory}`);
    console.log(`- No subcategory: ${analysis.issues.noSubcategory}`);
    console.log(`- No style: ${analysis.issues.noStyle}`);
    console.log(`- Short names: ${analysis.issues.shortNames}`);
    console.log(`- Errors: ${analysis.issues.errors}`);
    
    console.log('\nConfidence Distribution:');
    console.log(`- High (80-100%): ${analysis.confidenceDistribution.high}`);
    console.log(`- Medium (50-79%): ${analysis.confidenceDistribution.medium}`);
    console.log(`- Low (0-49%): ${analysis.confidenceDistribution.low}`);
    
    console.log('\nSuggestions:');
    console.log(`- Add subcategory: ${analysis.suggestions.addSubcategory}`);
    console.log(`- Add style: ${analysis.suggestions.addStyle}`);
    console.log(`- Improve naming: ${analysis.suggestions.improveNaming}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Search products by hierarchical category
 */
async function searchProducts(mainCategory = 'electronics', subcategory = null, style = null) {
  try {
    console.log(`🔍 Searching products: ${mainCategory}${subcategory ? ` > ${subcategory}` : ''}${style ? ` > ${style}` : ''}`);
    
    const searchCriteria = {
      mainCategory,
      subcategory,
      style,
      limit: 20
    };
    
    const products = await categoryHierarchyDB.searchProducts(searchCriteria);
    
    console.log(`\nFound ${products.length} products:`);
    products.forEach((product, index) => {
      const hierarchical = product.hierarchicalCategory || {};
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   Category: ${hierarchical.hierarchicalKey || 'Not categorized'}`);
      console.log(`   Price: ${product.price || 'N/A'}`);
      console.log(`   Brand: ${product.brand || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    throw error;
  }
}

/**
 * Get category statistics
 */
async function getStats() {
  try {
    console.log('📊 Getting category statistics...');
    
    const stats = await categoryHierarchyDB.getCategoryStats();
    
    console.log('\n📈 Category Statistics:');
    console.log(`Total Products: ${stats.totalProducts}`);
    console.log(`Unique Categories: ${Object.keys(stats.categories).length}`);
    console.log(`Unique Subcategories: ${Object.keys(stats.subcategories).length}`);
    console.log(`Unique Styles: ${Object.keys(stats.styles).length}`);
    
    console.log('\nTop Categories:');
    const sortedCategories = Object.entries(stats.categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedCategories.forEach(([category, count], index) => {
      console.log(`${index + 1}. ${category}: ${count} products`);
    });
    
    console.log('\nTop Subcategories:');
    const sortedSubcategories = Object.entries(stats.subcategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedSubcategories.forEach(([subcategory, count], index) => {
      console.log(`${index + 1}. ${subcategory}: ${count} products`);
    });
    
  } catch (error) {
    console.error('❌ Failed to get stats:', error.message);
    throw error;
  }
}

/**
 * Generate category hierarchy report
 */
async function generateReport() {
  try {
    console.log('📋 Generating category hierarchy report...');
    
    // Get sample products for report
    const products = await categoryHierarchyDB.getProductsByMainCategory('electronics', 500);
    
    if (products.length === 0) {
      console.log('No products found for report generation');
      return;
    }
    
    const report = generateHierarchyReport(products);
    
    console.log('\n📊 Category Hierarchy Report:');
    console.log(`Total Products: ${report.totalProducts}`);
    
    console.log('\nCoverage:');
    console.log(`- Has Hierarchy: ${report.coverage.hasHierarchyPercent}%`);
    console.log(`- Has Main Category: ${report.coverage.hasMainCategoryPercent}%`);
    console.log(`- Has Subcategory: ${report.coverage.hasSubcategoryPercent}%`);
    console.log(`- Has Style: ${report.coverage.hasStylePercent}%`);
    
    console.log('\nTop Main Categories:');
    const sortedMainCategories = Object.entries(report.hierarchyStats.mainCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedMainCategories.forEach(([category, count], index) => {
      console.log(`${index + 1}. ${category}: ${count} products`);
    });
    
    console.log('\nRecommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
  } catch (error) {
    console.error('❌ Report generation failed:', error.message);
    throw error;
  }
}

/**
 * Get improvement suggestions for products
 */
async function getSuggestions() {
  try {
    console.log('💡 Getting improvement suggestions...');
    
    // Get sample products
    const products = await categoryHierarchyDB.getProductsByMainCategory('electronics', 50);
    
    if (products.length === 0) {
      console.log('No products found for suggestions');
      return;
    }
    
    console.log(`\nAnalyzing ${products.length} products for improvement suggestions...\n`);
    
    let suggestionCount = 0;
    const suggestionTypes = {
      critical: 0,
      important: 0,
      enhancement: 0
    };
    
    for (let i = 0; i < Math.min(10, products.length); i++) {
      const product = products[i];
      const suggestions = suggestCategoryImprovements(product);
      
      if (suggestions.length > 0) {
        console.log(`Product ${i + 1}: ${product.title}`);
        console.log(`Current: ${product.hierarchicalCategory?.hierarchicalKey || 'Not categorized'}`);
        
        suggestions.forEach((suggestion, index) => {
          console.log(`  ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.message}`);
          console.log(`     Action: ${suggestion.action}`);
          suggestionTypes[suggestion.type]++;
          suggestionCount++;
        });
        console.log('');
      }
    }
    
    console.log('📊 Suggestion Summary:');
    console.log(`Total Suggestions: ${suggestionCount}`);
    console.log(`Critical: ${suggestionTypes.critical}`);
    console.log(`Important: ${suggestionTypes.important}`);
    console.log(`Enhancement: ${suggestionTypes.enhancement}`);
    
  } catch (error) {
    console.error('❌ Failed to get suggestions:', error.message);
    throw error;
  }
}

/**
 * Demonstrate category hierarchy matching
 */
async function demonstrateMatching() {
  try {
    console.log('🎯 Demonstrating category hierarchy matching...\n');
    
    // Sample category data scenarios
    const testCases = [
      {
        name: 'Electronics - Headphones',
        categoryData: {
          mainCategory: 'Electronics',
          c1: 'Electronics',
          c2: 'Audio & Video',
          c3: 'Headphones & Earbuds',
          c4: 'Wireless Headphones'
        }
      },
      {
        name: 'Fashion - Men\'s Clothing',
        categoryData: {
          mainCategory: 'Fashion',
          c1: 'Fashion',
          c2: 'Men\'s Clothing',
          c3: 'Shirts',
          c4: 'Casual Shirts'
        }
      },
      {
        name: 'Home - Kitchen',
        categoryData: {
          mainCategory: 'Home & Kitchen',
          c1: 'Home & Kitchen',
          c2: 'Kitchen & Dining',
          c3: 'Cookware',
          c4: 'Non-Stick Cookware'
        }
      },
      {
        name: 'Incomplete Data',
        categoryData: {
          mainCategory: 'Electronics',
          c1: 'Electronics'
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`Test Case: ${testCase.name}`);
      console.log(`Input: ${JSON.stringify(testCase.categoryData, null, 2)}`);
      
      const hierarchy = findMatchingHierarchy(testCase.categoryData);
      const hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
      
      console.log(`Result:`);
      console.log(`  Main Category: ${hierarchy.mainCategory || 'Not found'}`);
      console.log(`  Subcategory: ${hierarchy.subcategory || 'Not found'}`);
      console.log(`  Style: ${hierarchy.style || 'Not found'}`);
      console.log(`  Hierarchical Key: ${hierarchicalKey || 'Not generated'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
    throw error;
  }
}

/**
 * Show available categories
 */
function showAvailableCategories() {
  console.log('📚 Available Categories in Hierarchy:\n');
  
  const categories = getAllCategories();
  const grouped = {};
  
  // Group by level
  categories.forEach(category => {
    if (!grouped[category.level]) {
      grouped[category.level] = [];
    }
    grouped[category.level].push(category);
  });
  
  // Display by level
  Object.keys(grouped).sort().forEach(level => {
    console.log(`Level ${level} (${level === '1' ? 'Main Categories' : level === '2' ? 'Subcategories' : 'Styles'}):`);
    grouped[level].forEach(category => {
      const indent = '  '.repeat(level - 1);
      console.log(`${indent}- ${category.name} (${category.key})`);
    });
    console.log('');
  });
}

/**
 * Main function
 */
async function main() {
  try {
    const command = process.argv[2] || 'help';
    
    switch (command) {
      case 'init':
        await initializeHierarchy();
        break;
        
      case 'migrate':
        await migrateProducts();
        break;
        
      case 'analyze':
        await analyzeProducts();
        break;
        
      case 'search':
        const mainCategory = process.argv[3] || 'electronics';
        const subcategory = process.argv[4] || null;
        const style = process.argv[5] || null;
        await searchProducts(mainCategory, subcategory, style);
        break;
        
      case 'stats':
        await getStats();
        break;
        
      case 'report':
        await generateReport();
        break;
        
      case 'suggest':
        await getSuggestions();
        break;
        
      case 'demo':
        await demonstrateMatching();
        break;
        
      case 'list':
        showAvailableCategories();
        break;
        
      case 'help':
      default:
        console.log('Category Hierarchy Example Script');
        console.log('\nUsage: node scripts/categoryHierarchyExample.js [command] [options]');
        console.log('\nCommands:');
        console.log('  init                    - Initialize category hierarchy in database');
        console.log('  migrate                 - Migrate existing products to hierarchical categories');
        console.log('  analyze                 - Analyze product category data');
        console.log('  search [main] [sub] [style] - Search products by hierarchical category');
        console.log('  stats                   - Get category statistics');
        console.log('  report                  - Generate category hierarchy report');
        console.log('  suggest                 - Get improvement suggestions for products');
        console.log('  demo                    - Demonstrate category hierarchy matching');
        console.log('  list                    - Show available categories');
        console.log('  help                    - Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/categoryHierarchyExample.js init');
        console.log('  node scripts/categoryHierarchyExample.js search electronics headsets');
        console.log('  node scripts/categoryHierarchyExample.js search electronics headsets earbuds');
        break;
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  initializeHierarchy,
  migrateProducts,
  analyzeProducts,
  searchProducts,
  getStats,
  generateReport,
  getSuggestions,
  demonstrateMatching,
  showAvailableCategories
};

