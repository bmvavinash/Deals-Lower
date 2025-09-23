#!/usr/bin/env node

/**
 * Dynamic Category System
 * 
 * This script provides a complete dynamic category learning and management system
 * that learns from platform data instead of relying on hardcoded categories.
 * 
 * Usage:
 * node scripts/dynamicCategorySystem.js [command] [options]
 * 
 * Commands:
 * - learn: Learn categories from existing product data
 * - build: Build hierarchy from learned data
 * - analyze: Analyze learned patterns and clusters
 * - validate: Validate and refine learned categories
 * - export: Export learned hierarchy to database
 * - search: Search products using learned categories
 * - stats: Get comprehensive statistics
 * - demo: Demonstrate the system with sample data
 */

const { getModuleLogger } = require('../logger/logger');
const { DynamicCategoryExtractor } = require('../utils/dynamicCategoryExtractor');
const { CategoryPatternRecognizer } = require('../utils/categoryPatternRecognizer');
const { AutomaticHierarchyBuilder } = require('../utils/automaticHierarchyBuilder');
const { CategoryHierarchyDB } = require('../database/firebaseDB/categoryHierarchyDB');

const logger = getModuleLogger('dynamicCategorySystem');
const dynamicExtractor = new DynamicCategoryExtractor();
const patternRecognizer = new CategoryPatternRecognizer();
const hierarchyBuilder = new AutomaticHierarchyBuilder();
const categoryHierarchyDB = new CategoryHierarchyDB();

/**
 * Learn categories from existing product data
 */
async function learnCategories() {
  try {
    console.log('🎓 Learning categories from existing product data...');
    
    // Load existing learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get products from all platforms
    const platforms = ['amazon', 'flipkart', 'myntra', 'ajio'];
    let totalProducts = 0;
    let learnedCount = 0;
    
    for (const platform of platforms) {
      try {
        console.log(`\nLearning from ${platform}...`);
        const products = await categoryHierarchyDB.getProductsByMainCategory('electronics', 500);
        
        if (products.length === 0) {
          console.log(`No products found for ${platform}`);
          continue;
        }
        
        console.log(`Processing ${products.length} products from ${platform}...`);
        
        for (const product of products) {
          try {
            await dynamicExtractor.extractAndLearnCategories(product, platform);
            learnedCount++;
            
            if (learnedCount % 100 === 0) {
              console.log(`  Learned from ${learnedCount} products...`);
            }
          } catch (error) {
            logger.error('Error learning from product', { 
              error: error.message, 
              productCode: product.productCode 
            });
          }
        }
        
        totalProducts += products.length;
        console.log(`✅ Completed ${platform}: ${products.length} products processed`);
        
      } catch (error) {
        console.error(`❌ Error processing ${platform}:`, error.message);
      }
    }
    
    console.log(`\n📊 Learning Summary:`);
    console.log(`Total Products Processed: ${totalProducts}`);
    console.log(`Successfully Learned: ${learnedCount}`);
    console.log(`Success Rate: ${totalProducts > 0 ? ((learnedCount / totalProducts) * 100).toFixed(2) : 0}%`);
    
    // Export learned categories
    await dynamicExtractor.exportLearnedCategories();
    console.log('💾 Learned categories exported to database');
    
  } catch (error) {
    console.error('❌ Learning failed:', error.message);
    throw error;
  }
}

/**
 * Build hierarchy from learned data
 */
async function buildHierarchy() {
  try {
    console.log('🏗️ Building hierarchy from learned data...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get discovered categories
    const discoveredCategories = dynamicExtractor.discoveredCategories;
    
    if (discoveredCategories.size === 0) {
      console.log('No discovered categories found. Run "learn" command first.');
      return;
    }
    
    console.log(`Building hierarchy from ${discoveredCategories.size} discovered categories...`);
    
    // Build hierarchy
    const hierarchyResult = await hierarchyBuilder.buildHierarchy(discoveredCategories);
    
    console.log('\n✅ Hierarchy built successfully:');
    console.log(`Total Categories: ${hierarchyResult.statistics.totalCategories}`);
    console.log(`Total Subcategories: ${hierarchyResult.statistics.totalSubcategories}`);
    console.log(`Total Styles: ${hierarchyResult.statistics.totalStyles}`);
    console.log(`Cross-Platform Categories: ${hierarchyResult.statistics.crossPlatformCategories}`);
    console.log(`Average Confidence: ${hierarchyResult.statistics.averageConfidence}`);
    
    // Display hierarchy structure
    console.log('\n📚 Generated Hierarchy Structure:');
    Object.entries(hierarchyResult.hierarchy).forEach(([categoryKey, category]) => {
      console.log(`\n${category.name} (${category.platforms?.join(', ') || 'unknown'})`);
      
      if (category.subcategories) {
        Object.entries(category.subcategories).forEach(([subKey, subcategory]) => {
          console.log(`  └── ${subcategory.name} (${subcategory.platforms?.join(', ') || 'unknown'})`);
          
          if (subcategory.styles) {
            Object.entries(subcategory.styles).forEach(([styleKey, style]) => {
              console.log(`      └── ${style.name} (${style.platforms?.join(', ') || 'unknown'})`);
            });
          }
        });
      }
    });
    
    // Save hierarchy to database
    await categoryHierarchyDB.hierarchyRef.child('dynamicHierarchy').set(hierarchyResult.hierarchy);
    console.log('\n💾 Dynamic hierarchy saved to database');
    
  } catch (error) {
    console.error('❌ Hierarchy building failed:', error.message);
    throw error;
  }
}

/**
 * Analyze learned patterns and clusters
 */
async function analyzePatterns() {
  try {
    console.log('📊 Analyzing learned patterns and clusters...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    const discoveredCategories = dynamicExtractor.discoveredCategories;
    
    if (discoveredCategories.size === 0) {
      console.log('No discovered categories found. Run "learn" command first.');
      return;
    }
    
    // Analyze patterns
    const patternAnalysis = patternRecognizer.analyzePatterns(discoveredCategories);
    
    console.log('\n📈 Pattern Analysis Results:');
    console.log(`Total Categories: ${patternAnalysis.totalCategories}`);
    console.log(`Total Clusters: ${patternAnalysis.clusters.length}`);
    console.log(`Total Recommendations: ${patternAnalysis.recommendations.length}`);
    
    console.log('\n🔍 Pattern Types:');
    console.log(`Naming Patterns: ${patternAnalysis.patterns.naming.size}`);
    console.log(`Structural Patterns: ${patternAnalysis.patterns.structural.size}`);
    console.log(`Semantic Patterns: ${patternAnalysis.patterns.semantic.size}`);
    console.log(`Frequency Patterns: ${patternAnalysis.patterns.frequency.size}`);
    
    // Display top clusters
    if (patternAnalysis.clusters.length > 0) {
      console.log('\n🎯 Top Clusters:');
      patternAnalysis.clusters
        .sort((a, b) => b.categories.length - a.categories.length)
        .slice(0, 5)
        .forEach((cluster, index) => {
          console.log(`${index + 1}. Cluster ${cluster.id}: ${cluster.categories.length} categories (${(cluster.similarity * 100).toFixed(1)}% similarity)`);
          cluster.categories.slice(0, 3).forEach(cat => {
            console.log(`   - ${cat.path.join(' > ')}`);
          });
        });
    }
    
    // Display top recommendations
    if (patternAnalysis.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      patternAnalysis.recommendations
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 5)
        .forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.type.toUpperCase()}] ${rec.message}`);
          if (rec.confidence) {
            console.log(`   Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
          }
        });
    }
    
  } catch (error) {
    console.error('❌ Pattern analysis failed:', error.message);
    throw error;
  }
}

/**
 * Validate and refine learned categories
 */
async function validateCategories() {
  try {
    console.log('🔍 Validating and refining learned categories...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    const discoveredCategories = dynamicExtractor.discoveredCategories;
    
    if (discoveredCategories.size === 0) {
      console.log('No discovered categories found. Run "learn" command first.');
      return;
    }
    
    // Analyze patterns for validation
    const patternAnalysis = patternRecognizer.analyzePatterns(discoveredCategories);
    
    console.log('\n📊 Validation Results:');
    
    // Check for low-frequency categories
    const lowFrequencyCategories = patternAnalysis.clusters
      .filter(cluster => cluster.categories.length < 3)
      .flatMap(cluster => cluster.categories);
    
    console.log(`Low-Frequency Categories: ${lowFrequencyCategories.length}`);
    if (lowFrequencyCategories.length > 0) {
      console.log('  Examples:');
      lowFrequencyCategories.slice(0, 5).forEach(cat => {
        console.log(`    - ${cat.path.join(' > ')} (${cat.productCount} products)`);
      });
    }
    
    // Check for inconsistent naming
    const inconsistentNaming = Array.from(patternAnalysis.patterns.naming.entries())
      .filter(([, pattern]) => pattern.frequency > 5)
      .slice(0, 5);
    
    console.log(`\nInconsistent Naming Patterns: ${inconsistentNaming.length}`);
    inconsistentNaming.forEach(([patternKey, pattern]) => {
      console.log(`  - ${pattern.type}: ${pattern.value} (${pattern.frequency} occurrences)`);
    });
    
    // Check for weak relationships
    const weakRelationships = Array.from(patternAnalysis.patterns.semantic.entries())
      .filter(([, rel]) => rel.frequency < 3)
      .slice(0, 5);
    
    console.log(`\nWeak Relationships: ${weakRelationships.length}`);
    weakRelationships.forEach(([relKey, rel]) => {
      console.log(`  - ${rel.parent} → ${rel.child} (${rel.frequency} occurrences)`);
    });
    
    console.log('\n✅ Validation completed');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    throw error;
  }
}

/**
 * Export learned hierarchy to database
 */
async function exportHierarchy() {
  try {
    console.log('📤 Exporting learned hierarchy to database...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    const discoveredCategories = dynamicExtractor.discoveredCategories;
    
    if (discoveredCategories.size === 0) {
      console.log('No discovered categories found. Run "learn" command first.');
      return;
    }
    
    // Build hierarchy
    const hierarchyResult = await hierarchyBuilder.buildHierarchy(discoveredCategories);
    
    // Export to database
    await categoryHierarchyDB.hierarchyRef.child('dynamicHierarchy').set(hierarchyResult.hierarchy);
    await categoryHierarchyDB.hierarchyRef.child('categoryMappings').set(Object.fromEntries(hierarchyResult.mappings));
    
    console.log('✅ Hierarchy exported successfully:');
    console.log(`Categories: ${hierarchyResult.statistics.totalCategories}`);
    console.log(`Subcategories: ${hierarchyResult.statistics.totalSubcategories}`);
    console.log(`Styles: ${hierarchyResult.statistics.totalStyles}`);
    console.log(`Mappings: ${hierarchyResult.mappings.size}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

/**
 * Search products using learned categories
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
      console.log(`   Confidence: ${hierarchical.confidence || 0}%`);
      console.log(`   Source: ${hierarchical.source || 'unknown'}`);
      console.log(`   Price: ${product.price || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    throw error;
  }
}

/**
 * Get comprehensive statistics
 */
async function getComprehensiveStats() {
  try {
    console.log('📊 Getting comprehensive statistics...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get learning statistics
    const learningStats = dynamicExtractor.getDiscoveryStats();
    
    // Get database statistics
    const dbStats = await categoryHierarchyDB.getCategoryStats();
    
    // Get pattern analysis
    const patternAnalysis = patternRecognizer.analyzePatterns(dynamicExtractor.discoveredCategories);
    
    console.log('\n📈 Learning Statistics:');
    console.log(`Discovered Categories: ${learningStats.totalDiscoveredCategories}`);
    console.log(`Learned Patterns: ${learningStats.totalPatterns}`);
    console.log(`Category Relationships: ${learningStats.totalRelationships}`);
    
    console.log('\n📊 Database Statistics:');
    console.log(`Total Products: ${dbStats.totalProducts}`);
    console.log(`Unique Categories: ${Object.keys(dbStats.categories).length}`);
    console.log(`Unique Subcategories: ${Object.keys(dbStats.subcategories).length}`);
    console.log(`Unique Styles: ${Object.keys(dbStats.styles).length}`);
    
    console.log('\n🎯 Pattern Analysis:');
    console.log(`Total Clusters: ${patternAnalysis.clusters.length}`);
    console.log(`Total Recommendations: ${patternAnalysis.recommendations.length}`);
    console.log(`Naming Patterns: ${patternAnalysis.patterns.naming.size}`);
    console.log(`Semantic Patterns: ${patternAnalysis.patterns.semantic.size}`);
    
    // Calculate learning coverage
    const learningCoverage = learningStats.totalDiscoveredCategories > 0 
      ? ((Object.keys(dbStats.categories).length / learningStats.totalDiscoveredCategories) * 100).toFixed(2)
      : 0;
    
    console.log(`\n🎯 Learning Coverage: ${learningCoverage}%`);
    
  } catch (error) {
    console.error('❌ Failed to get statistics:', error.message);
    throw error;
  }
}

/**
 * Demonstrate the system with sample data
 */
async function demonstrateSystem() {
  try {
    console.log('🎯 Demonstrating dynamic category system...');
    
    // Sample products for demonstration
    const sampleProducts = [
      {
        productCode: 'DEMO001',
        title: 'Wireless Bluetooth Earbuds with Noise Cancellation',
        category: {
          mainCategory: 'Electronics',
          c1: 'Electronics',
          c2: 'Audio & Video',
          c3: 'Headphones & Earbuds',
          c4: 'Wireless Headphones'
        }
      },
      {
        productCode: 'DEMO002',
        title: 'Gaming Laptop with RTX Graphics Card',
        category: {
          mainCategory: 'Electronics',
          c1: 'Electronics',
          c2: 'Computers & Tablets',
          c3: 'Laptops',
          c4: 'Gaming Laptops'
        }
      },
      {
        productCode: 'DEMO003',
        title: 'Men\'s Casual Cotton T-Shirt',
        category: {
          mainCategory: 'Fashion',
          c1: 'Fashion',
          c2: 'Men\'s Clothing',
          c3: 'T-Shirts',
          c4: 'Casual T-Shirts'
        }
      },
      {
        productCode: 'DEMO004',
        title: 'Smartphone with 5G Connectivity',
        category: {
          mainCategory: 'Electronics',
          c1: 'Electronics',
          c2: 'Mobile Phones',
          c3: 'Smartphones',
          c4: '5G Smartphones'
        }
      }
    ];
    
    console.log('Training with sample products...\n');
    
    for (const product of sampleProducts) {
      const platform = 'demo';
      const hierarchy = await dynamicExtractor.extractAndLearnCategories(product, platform);
      
      console.log(`Product: ${product.title}`);
      console.log(`Learned Hierarchy: ${JSON.stringify(hierarchy, null, 2)}`);
      console.log('');
    }
    
    // Get learning statistics
    const stats = dynamicExtractor.getDiscoveryStats();
    console.log('📊 Learning Results:');
    console.log(`Discovered Categories: ${stats.totalDiscoveredCategories}`);
    console.log(`Learned Patterns: ${stats.totalPatterns}`);
    console.log(`Category Relationships: ${stats.totalRelationships}`);
    
    // Analyze patterns
    const patternAnalysis = patternRecognizer.analyzePatterns(dynamicExtractor.discoveredCategories);
    console.log(`\nPattern Analysis: ${patternAnalysis.clusters.length} clusters found`);
    
    // Build hierarchy
    const hierarchyResult = await hierarchyBuilder.buildHierarchy(dynamicExtractor.discoveredCategories);
    console.log(`\nHierarchy Built: ${hierarchyResult.statistics.totalCategories} categories`);
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const command = process.argv[2] || 'help';
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];
    const arg3 = process.argv[5];
    
    switch (command) {
      case 'learn':
        await learnCategories();
        break;
        
      case 'build':
        await buildHierarchy();
        break;
        
      case 'analyze':
        await analyzePatterns();
        break;
        
      case 'validate':
        await validateCategories();
        break;
        
      case 'export':
        await exportHierarchy();
        break;
        
      case 'search':
        await searchProducts(arg1, arg2, arg3);
        break;
        
      case 'stats':
        await getComprehensiveStats();
        break;
        
      case 'demo':
        await demonstrateSystem();
        break;
        
      case 'help':
      default:
        console.log('Dynamic Category System');
        console.log('\nUsage: node scripts/dynamicCategorySystem.js [command] [options]');
        console.log('\nCommands:');
        console.log('  learn     - Learn categories from existing product data');
        console.log('  build     - Build hierarchy from learned data');
        console.log('  analyze   - Analyze learned patterns and clusters');
        console.log('  validate  - Validate and refine learned categories');
        console.log('  export    - Export learned hierarchy to database');
        console.log('  search    - Search products using learned categories');
        console.log('  stats     - Get comprehensive statistics');
        console.log('  demo      - Demonstrate the system with sample data');
        console.log('  help      - Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/dynamicCategorySystem.js learn');
        console.log('  node scripts/dynamicCategorySystem.js build');
        console.log('  node scripts/dynamicCategorySystem.js search electronics headsets');
        console.log('  node scripts/dynamicCategorySystem.js demo');
        break;
    }
    
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  learnCategories,
  buildHierarchy,
  analyzePatterns,
  validateCategories,
  exportHierarchy,
  searchProducts,
  getComprehensiveStats,
  demonstrateSystem
};

