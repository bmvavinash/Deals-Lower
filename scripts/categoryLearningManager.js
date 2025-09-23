#!/usr/bin/env node

/**
 * Category Learning Manager
 * 
 * This script manages the dynamic category learning system,
 * allowing you to train, analyze, and manage categories learned from platform data.
 * 
 * Usage:
 * node scripts/categoryLearningManager.js [command] [options]
 * 
 * Commands:
 * - train: Train the system with existing product data
 * - analyze: Analyze learned categories and patterns
 * - export: Export learned categories to database
 * - load: Load learned categories from database
 * - stats: Get learning statistics
 * - generate: Generate hierarchy from learned data
 * - validate: Validate learned categories
 * - clean: Clean up low-quality learned data
 */

const { getModuleLogger } = require('../logger/logger');
const { DynamicCategoryExtractor } = require('../utils/dynamicCategoryExtractor');
const { CategoryHierarchyDB } = require('../database/firebaseDB/categoryHierarchyDB');

const logger = getModuleLogger('categoryLearningManager');
const dynamicExtractor = new DynamicCategoryExtractor();
const categoryHierarchyDB = new CategoryHierarchyDB();

/**
 * Train the system with existing product data
 */
async function trainSystem() {
  try {
    console.log('🎓 Training category learning system...');
    
    // Load existing learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get sample products for training
    const products = await categoryHierarchyDB.getProductsByMainCategory('electronics', 1000);
    
    if (products.length === 0) {
      console.log('No products found for training');
      return;
    }
    
    console.log(`Training with ${products.length} products...`);
    
    let trainedCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        const platform = product.categoryKey?.split('_')[0] || 'unknown';
        await dynamicExtractor.extractAndLearnCategories(product, platform);
        trainedCount++;
        
        if (trainedCount % 100 === 0) {
          console.log(`Trained ${trainedCount}/${products.length} products...`);
        }
      } catch (error) {
        logger.error('Error training on product', { 
          error: error.message, 
          productCode: product.productCode 
        });
        errorCount++;
      }
    }
    
    console.log(`✅ Training completed: ${trainedCount} products trained, ${errorCount} errors`);
    
    // Export learned categories
    await dynamicExtractor.exportLearnedCategories();
    console.log('📤 Learned categories exported to database');
    
  } catch (error) {
    console.error('❌ Training failed:', error.message);
    throw error;
  }
}

/**
 * Analyze learned categories and patterns
 */
async function analyzeLearnedCategories() {
  try {
    console.log('📊 Analyzing learned categories...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get statistics
    const stats = dynamicExtractor.getDiscoveryStats();
    
    console.log('\n📈 Learning Statistics:');
    console.log(`Total Discovered Categories: ${stats.totalDiscoveredCategories}`);
    console.log(`Total Patterns: ${stats.totalPatterns}`);
    console.log(`Total Relationships: ${stats.totalRelationships}`);
    
    console.log('\nPlatform Breakdown:');
    Object.entries(stats.platformBreakdown).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} categories`);
    });
    
    console.log('\nLevel Breakdown:');
    Object.entries(stats.levelBreakdown).forEach(([level, count]) => {
      console.log(`  Level ${level}: ${count} categories`);
    });
    
    console.log('\nTop Categories by Frequency:');
    stats.topCategories.slice(0, 10).forEach((category, index) => {
      console.log(`  ${index + 1}. ${category.category}: ${category.frequency} occurrences`);
    });
    
    console.log('\nTop Relationships by Confidence:');
    stats.topRelationships.slice(0, 10).forEach((rel, index) => {
      console.log(`  ${index + 1}. ${rel.relationship}: ${rel.confidence}% confidence (${rel.frequency} occurrences)`);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Export learned categories to database
 */
async function exportLearnedCategories() {
  try {
    console.log('📤 Exporting learned categories...');
    
    const result = await dynamicExtractor.exportLearnedCategories();
    
    console.log('✅ Export completed:');
    console.log(`  Categories: ${result.exportedCategories}`);
    console.log(`  Patterns: ${result.exportedPatterns}`);
    console.log(`  Relationships: ${result.exportedRelationships}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

/**
 * Load learned categories from database
 */
async function loadLearnedCategories() {
  try {
    console.log('📥 Loading learned categories...');
    
    const result = await dynamicExtractor.loadLearnedCategories();
    
    console.log('✅ Load completed:');
    console.log(`  Categories: ${result.loadedCategories}`);
    console.log(`  Patterns: ${result.loadedPatterns}`);
    console.log(`  Relationships: ${result.loadedRelationships}`);
    
  } catch (error) {
    console.error('❌ Load failed:', error.message);
    throw error;
  }
}

/**
 * Get learning statistics
 */
async function getLearningStats() {
  try {
    console.log('📊 Getting learning statistics...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Get statistics
    const stats = dynamicExtractor.getDiscoveryStats();
    
    // Get database statistics
    const dbStats = await categoryHierarchyDB.getCategoryStats();
    
    console.log('\n📈 Learning Statistics:');
    console.log(`Discovered Categories: ${stats.totalDiscoveredCategories}`);
    console.log(`Learned Patterns: ${stats.totalPatterns}`);
    console.log(`Category Relationships: ${stats.totalRelationships}`);
    
    console.log('\n📊 Database Statistics:');
    console.log(`Total Products: ${dbStats.totalProducts}`);
    console.log(`Unique Categories: ${Object.keys(dbStats.categories).length}`);
    console.log(`Unique Subcategories: ${Object.keys(dbStats.subcategories).length}`);
    console.log(`Unique Styles: ${Object.keys(dbStats.styles).length}`);
    
    // Calculate learning coverage
    const learningCoverage = stats.totalDiscoveredCategories > 0 
      ? ((Object.keys(dbStats.categories).length / stats.totalDiscoveredCategories) * 100).toFixed(2)
      : 0;
    
    console.log(`\n🎯 Learning Coverage: ${learningCoverage}%`);
    
  } catch (error) {
    console.error('❌ Failed to get statistics:', error.message);
    throw error;
  }
}

/**
 * Generate hierarchy from learned data
 */
async function generateHierarchyFromLearnedData() {
  try {
    console.log('🏗️ Generating hierarchy from learned data...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    // Generate hierarchy
    const hierarchy = dynamicExtractor.generateHierarchyFromLearnedData();
    
    console.log('✅ Generated hierarchy structure:');
    
    // Display hierarchy
    Object.entries(hierarchy).forEach(([platform, categories]) => {
      console.log(`\n${platform.toUpperCase()}:`);
      Object.entries(categories).forEach(([categoryKey, category]) => {
        console.log(`  ${category.name} (${category.frequency} products)`);
        
        if (category.subcategories && Object.keys(category.subcategories).length > 0) {
          Object.entries(category.subcategories).forEach(([subKey, subcategory]) => {
            console.log(`    └── ${subcategory.name} (${subcategory.frequency} products)`);
            
            if (subcategory.styles && Object.keys(subcategory.styles).length > 0) {
              Object.entries(subcategory.styles).forEach(([styleKey, style]) => {
                console.log(`        └── ${style.name} (${style.frequency} products)`);
              });
            }
          });
        }
      });
    });
    
    // Save generated hierarchy
    await categoryHierarchyDB.hierarchyRef.child('generatedHierarchy').set(hierarchy);
    console.log('\n💾 Generated hierarchy saved to database');
    
  } catch (error) {
    console.error('❌ Hierarchy generation failed:', error.message);
    throw error;
  }
}

/**
 * Validate learned categories
 */
async function validateLearnedCategories() {
  try {
    console.log('🔍 Validating learned categories...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    const stats = dynamicExtractor.getDiscoveryStats();
    
    console.log('\n📊 Validation Results:');
    
    // Check for low-frequency categories
    const lowFrequencyCategories = stats.topCategories.filter(cat => cat.frequency < 5);
    console.log(`Low Frequency Categories (< 5 occurrences): ${lowFrequencyCategories.length}`);
    
    if (lowFrequencyCategories.length > 0) {
      console.log('  Examples:');
      lowFrequencyCategories.slice(0, 5).forEach(cat => {
        console.log(`    - ${cat.category}: ${cat.frequency} occurrences`);
      });
    }
    
    // Check for low-confidence relationships
    const lowConfidenceRelationships = stats.topRelationships.filter(rel => parseFloat(rel.confidence) < 30);
    console.log(`Low Confidence Relationships (< 30%): ${lowConfidenceRelationships.length}`);
    
    if (lowConfidenceRelationships.length > 0) {
      console.log('  Examples:');
      lowConfidenceRelationships.slice(0, 5).forEach(rel => {
        console.log(`    - ${rel.relationship}: ${rel.confidence}% confidence`);
      });
    }
    
    // Check for orphaned categories
    const orphanedCategories = stats.topCategories.filter(cat => {
      const categoryName = cat.category.split('_')[1];
      return !stats.topRelationships.some(rel => 
        rel.relationship.includes(categoryName)
      );
    });
    console.log(`Orphaned Categories: ${orphanedCategories.length}`);
    
    if (orphanedCategories.length > 0) {
      console.log('  Examples:');
      orphanedCategories.slice(0, 5).forEach(cat => {
        console.log(`    - ${cat.category}: ${cat.frequency} occurrences`);
      });
    }
    
    console.log('\n✅ Validation completed');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    throw error;
  }
}

/**
 * Clean up low-quality learned data
 */
async function cleanLearnedData() {
  try {
    console.log('🧹 Cleaning up low-quality learned data...');
    
    // Load learned categories
    await dynamicExtractor.loadLearnedCategories();
    
    const stats = dynamicExtractor.getDiscoveryStats();
    
    // Remove low-frequency categories
    const lowFrequencyCategories = stats.topCategories.filter(cat => cat.frequency < 3);
    console.log(`Removing ${lowFrequencyCategories.length} low-frequency categories...`);
    
    // Remove low-confidence relationships
    const lowConfidenceRelationships = stats.topRelationships.filter(rel => parseFloat(rel.confidence) < 20);
    console.log(`Removing ${lowConfidenceRelationships.length} low-confidence relationships...`);
    
    // Note: In a real implementation, you would actually remove these from the data structures
    // For now, we'll just report what would be cleaned
    
    console.log('✅ Cleanup completed (simulated)');
    console.log(`Would remove ${lowFrequencyCategories.length} low-frequency categories`);
    console.log(`Would remove ${lowConfidenceRelationships.length} low-confidence relationships`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  }
}

/**
 * Demonstrate category learning with sample data
 */
async function demonstrateLearning() {
  try {
    console.log('🎯 Demonstrating category learning...');
    
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
      }
    ];
    
    console.log('Training with sample products...');
    
    for (const product of sampleProducts) {
      const platform = 'demo';
      const hierarchy = await dynamicExtractor.extractAndLearnCategories(product, platform);
      
      console.log(`\nProduct: ${product.title}`);
      console.log(`Learned Hierarchy: ${JSON.stringify(hierarchy, null, 2)}`);
    }
    
    // Get learning statistics
    const stats = dynamicExtractor.getDiscoveryStats();
    console.log('\n📊 Learning Results:');
    console.log(`Discovered Categories: ${stats.totalDiscoveredCategories}`);
    console.log(`Learned Patterns: ${stats.totalPatterns}`);
    console.log(`Category Relationships: ${stats.totalRelationships}`);
    
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
    
    switch (command) {
      case 'train':
        await trainSystem();
        break;
        
      case 'analyze':
        await analyzeLearnedCategories();
        break;
        
      case 'export':
        await exportLearnedCategories();
        break;
        
      case 'load':
        await loadLearnedCategories();
        break;
        
      case 'stats':
        await getLearningStats();
        break;
        
      case 'generate':
        await generateHierarchyFromLearnedData();
        break;
        
      case 'validate':
        await validateLearnedCategories();
        break;
        
      case 'clean':
        await cleanLearnedData();
        break;
        
      case 'demo':
        await demonstrateLearning();
        break;
        
      case 'help':
      default:
        console.log('Category Learning Manager');
        console.log('\nUsage: node scripts/categoryLearningManager.js [command]');
        console.log('\nCommands:');
        console.log('  train     - Train the system with existing product data');
        console.log('  analyze   - Analyze learned categories and patterns');
        console.log('  export    - Export learned categories to database');
        console.log('  load      - Load learned categories from database');
        console.log('  stats     - Get learning statistics');
        console.log('  generate  - Generate hierarchy from learned data');
        console.log('  validate  - Validate learned categories');
        console.log('  clean     - Clean up low-quality learned data');
        console.log('  demo      - Demonstrate category learning with sample data');
        console.log('  help      - Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/categoryLearningManager.js train');
        console.log('  node scripts/categoryLearningManager.js analyze');
        console.log('  node scripts/categoryLearningManager.js demo');
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
  trainSystem,
  analyzeLearnedCategories,
  exportLearnedCategories,
  loadLearnedCategories,
  getLearningStats,
  generateHierarchyFromLearnedData,
  validateLearnedCategories,
  cleanLearnedData,
  demonstrateLearning
};

