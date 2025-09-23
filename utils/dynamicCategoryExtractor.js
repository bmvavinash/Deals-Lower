const { getModuleLogger } = require('../logger/logger');
const { CategoryHierarchyDB } = require('../database/firebaseDB/categoryHierarchyDB');

const logger = getModuleLogger('dynamicCategoryExtractor');

/**
 * Dynamic Category Extractor
 * 
 * This system learns and builds category hierarchies from actual platform data
 * during the extraction process, rather than relying on hardcoded categories.
 */

class DynamicCategoryExtractor {
  constructor() {
    this.categoryHierarchyDB = new CategoryHierarchyDB();
    this.discoveredCategories = new Map();
    this.categoryPatterns = new Map();
    this.categoryFrequency = new Map();
    this.categoryRelationships = new Map();
  }

  /**
   * Extract and learn categories from product data
   * @param {Object} product - Product object with category data
   * @param {string} platform - Platform name (amazon, flipkart, etc.)
   */
  async extractAndLearnCategories(product, platform) {
    try {
      const categoryData = product.category || {};
      const { mainCategory, c1, c2, c3, c4, c5, c6 } = categoryData;
      
      // Build category path from extracted data
      const categoryPath = this.buildCategoryPath(categoryData);
      
      if (categoryPath.length === 0) {
        logger.debug('No category data found in product', { productCode: product.productCode });
        return null;
      }

      // Learn from the category path
      await this.learnFromCategoryPath(categoryPath, platform, product);
      
      // Generate hierarchical structure
      const hierarchy = this.generateHierarchyFromPath(categoryPath, platform);
      
      return hierarchy;
      
    } catch (error) {
      logger.error('Error extracting categories', { 
        error: error.message, 
        productCode: product.productCode 
      });
      return null;
    }
  }

  /**
   * Build category path from extracted category data
   * @param {Object} categoryData - Raw category data from product
   * @returns {Array} Array of category levels
   */
  buildCategoryPath(categoryData) {
    const path = [];
    const { mainCategory, c1, c2, c3, c4, c5, c6 } = categoryData;
    
    // Build path from available category data
    const categories = [mainCategory, c1, c2, c3, c4, c5, c6].filter(Boolean);
    
    // Remove duplicates and empty values
    const uniqueCategories = [...new Set(categories.map(cat => cat.trim()).filter(cat => cat.length > 0))];
    
    return uniqueCategories;
  }

  /**
   * Learn from category path and update internal knowledge
   * @param {Array} categoryPath - Array of category levels
   * @param {string} platform - Platform name
   * @param {Object} product - Product object for context
   */
  async learnFromCategoryPath(categoryPath, platform, product) {
    try {
      // Learn individual categories
      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const level = i + 1;
        
        // Update category frequency
        const key = `${platform}_${category}`;
        this.categoryFrequency.set(key, (this.categoryFrequency.get(key) || 0) + 1);
        
        // Learn category patterns
        await this.learnCategoryPatterns(category, level, platform, product);
        
        // Learn relationships between categories
        if (i > 0) {
          const parentCategory = categoryPath[i - 1];
          await this.learnCategoryRelationship(parentCategory, category, level, platform);
        }
      }
      
      // Store discovered categories
      const hierarchyKey = categoryPath.join(' > ');
      this.discoveredCategories.set(hierarchyKey, {
        path: categoryPath,
        platform,
        level: categoryPath.length,
        productCount: (this.discoveredCategories.get(hierarchyKey)?.productCount || 0) + 1,
        lastSeen: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error learning from category path', { 
        error: error.message, 
        categoryPath, 
        platform 
      });
    }
  }

  /**
   * Learn category patterns and characteristics
   * @param {string} category - Category name
   * @param {number} level - Category level (1, 2, 3, etc.)
   * @param {string} platform - Platform name
   * @param {Object} product - Product object for context
   */
  async learnCategoryPatterns(category, level, platform, product) {
    try {
      const patternKey = `${platform}_${level}_${category}`;
      
      if (!this.categoryPatterns.has(patternKey)) {
        this.categoryPatterns.set(patternKey, {
          category,
          level,
          platform,
          patterns: [],
          keywords: new Set(),
          productTypes: new Set(),
          frequency: 0
        });
      }
      
      const pattern = this.categoryPatterns.get(patternKey);
      pattern.frequency++;
      
      // Extract keywords from product title and description
      const title = product.title || '';
      const description = product.description || '';
      const text = `${title} ${description}`.toLowerCase();
      
      // Extract relevant keywords
      const keywords = this.extractKeywords(text, category);
      keywords.forEach(keyword => pattern.keywords.add(keyword));
      
      // Learn product type patterns
      const productType = this.identifyProductType(text, category);
      if (productType) {
        pattern.productTypes.add(productType);
      }
      
      // Learn naming patterns
      const namingPattern = this.identifyNamingPattern(category, text);
      if (namingPattern) {
        pattern.patterns.push(namingPattern);
      }
      
    } catch (error) {
      logger.error('Error learning category patterns', { 
        error: error.message, 
        category, 
        level, 
        platform 
      });
    }
  }

  /**
   * Learn relationships between categories
   * @param {string} parentCategory - Parent category
   * @param {string} childCategory - Child category
   * @param {number} level - Child category level
   * @param {string} platform - Platform name
   */
  async learnCategoryRelationship(parentCategory, childCategory, level, platform) {
    try {
      const relationshipKey = `${platform}_${parentCategory}_${childCategory}`;
      
      if (!this.categoryRelationships.has(relationshipKey)) {
        this.categoryRelationships.set(relationshipKey, {
          parent: parentCategory,
          child: childCategory,
          level,
          platform,
          frequency: 0,
          confidence: 0
        });
      }
      
      const relationship = this.categoryRelationships.get(relationshipKey);
      relationship.frequency++;
      
      // Calculate confidence based on frequency
      const totalParentOccurrences = this.categoryFrequency.get(`${platform}_${parentCategory}`) || 1;
      relationship.confidence = (relationship.frequency / totalParentOccurrences) * 100;
      
    } catch (error) {
      logger.error('Error learning category relationship', { 
        error: error.message, 
        parentCategory, 
        childCategory, 
        platform 
      });
    }
  }

  /**
   * Extract relevant keywords from text
   * @param {string} text - Text to analyze
   * @param {string} category - Category context
   * @returns {Array} Array of relevant keywords
   */
  extractKeywords(text, category) {
    const keywords = [];
    
    // Common product-related keywords
    const commonKeywords = [
      'wireless', 'bluetooth', 'gaming', 'sports', 'casual', 'formal',
      'premium', 'budget', 'professional', 'home', 'office', 'travel',
      'waterproof', 'noise', 'cancelling', 'rechargeable', 'battery',
      'smart', 'digital', 'analog', 'mechanical', 'automatic'
    ];
    
    // Extract keywords that appear in the text
    commonKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    });
    
    // Extract brand names (simple heuristic)
    const brandPattern = /\b[A-Z][a-z]+\b/g;
    const brands = text.match(brandPattern) || [];
    keywords.push(...brands.slice(0, 3)); // Limit to first 3 brands
    
    return keywords;
  }

  /**
   * Identify product type from text and category
   * @param {string} text - Text to analyze
   * @param {string} category - Category context
   * @returns {string|null} Product type
   */
  identifyProductType(text, category) {
    const productTypes = {
      'electronics': ['phone', 'laptop', 'headphone', 'speaker', 'camera', 'watch'],
      'fashion': ['shirt', 'dress', 'shoe', 'bag', 'watch', 'jewelry'],
      'home': ['furniture', 'appliance', 'decor', 'kitchen', 'bedding'],
      'beauty': ['skincare', 'makeup', 'hair', 'perfume', 'cosmetic'],
      'sports': ['fitness', 'gym', 'outdoor', 'sport', 'exercise']
    };
    
    for (const [type, keywords] of Object.entries(productTypes)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * Identify naming patterns in categories
   * @param {string} category - Category name
   * @param {string} text - Product text
   * @returns {Object|null} Naming pattern
   */
  identifyNamingPattern(category, text) {
    const patterns = {
      'size_based': /(small|medium|large|xlarge|xxl|xl|s|m|l)/i,
      'color_based': /(black|white|red|blue|green|yellow|pink|purple|orange|brown)/i,
      'material_based': /(leather|metal|plastic|wood|fabric|cotton|silk|wool)/i,
      'style_based': /(casual|formal|sports|gaming|professional|vintage|modern)/i,
      'feature_based': /(wireless|bluetooth|smart|digital|premium|budget)/i
    };
    
    for (const [patternType, regex] of Object.entries(patterns)) {
      if (regex.test(category) || regex.test(text)) {
        return {
          type: patternType,
          matches: (category + ' ' + text).match(regex) || []
        };
      }
    }
    
    return null;
  }

  /**
   * Generate hierarchy from learned category path
   * @param {Array} categoryPath - Array of category levels
   * @param {string} platform - Platform name
   * @returns {Object} Generated hierarchy
   */
  generateHierarchyFromPath(categoryPath, platform) {
    try {
      const hierarchy = {
        mainCategory: '',
        subcategory: '',
        style: '',
        hierarchicalKey: '',
        confidence: 0,
        source: 'dynamic',
        platform
      };
      
      if (categoryPath.length >= 1) {
        hierarchy.mainCategory = this.normalizeCategoryName(categoryPath[0]);
      }
      
      if (categoryPath.length >= 2) {
        hierarchy.subcategory = this.normalizeCategoryName(categoryPath[1]);
      }
      
      if (categoryPath.length >= 3) {
        hierarchy.style = this.normalizeCategoryName(categoryPath[2]);
      }
      
      // Generate hierarchical key
      const parts = [hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style]
        .filter(Boolean);
      hierarchy.hierarchicalKey = parts.join('_');
      
      // Calculate confidence based on learned patterns
      hierarchy.confidence = this.calculateHierarchyConfidence(hierarchy, platform);
      
      return hierarchy;
      
    } catch (error) {
      logger.error('Error generating hierarchy from path', { 
        error: error.message, 
        categoryPath, 
        platform 
      });
      return null;
    }
  }

  /**
   * Normalize category name for consistency
   * @param {string} categoryName - Raw category name
   * @returns {string} Normalized category name
   */
  normalizeCategoryName(categoryName) {
    if (!categoryName) return '';
    
    return categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  }

  /**
   * Calculate confidence for generated hierarchy
   * @param {Object} hierarchy - Generated hierarchy
   * @param {string} platform - Platform name
   * @returns {number} Confidence score (0-100)
   */
  calculateHierarchyConfidence(hierarchy, platform) {
    let confidence = 0;
    
    // Base confidence for having main category
    if (hierarchy.mainCategory) {
      confidence += 40;
      
      // Check if we've seen this category before
      const mainKey = `${platform}_${hierarchy.mainCategory}`;
      const frequency = this.categoryFrequency.get(mainKey) || 0;
      confidence += Math.min(30, frequency * 2); // Up to 30 points for frequency
    }
    
    // Bonus for subcategory
    if (hierarchy.subcategory) {
      confidence += 20;
      
      // Check relationship confidence
      const relationshipKey = `${platform}_${hierarchy.mainCategory}_${hierarchy.subcategory}`;
      const relationship = this.categoryRelationships.get(relationshipKey);
      if (relationship) {
        confidence += Math.min(10, relationship.confidence / 10);
      }
    }
    
    // Bonus for style
    if (hierarchy.style) {
      confidence += 10;
    }
    
    return Math.min(100, confidence);
  }

  /**
   * Get discovered categories statistics
   * @returns {Object} Statistics about discovered categories
   */
  getDiscoveryStats() {
    const stats = {
      totalDiscoveredCategories: this.discoveredCategories.size,
      totalPatterns: this.categoryPatterns.size,
      totalRelationships: this.categoryRelationships.size,
      platformBreakdown: {},
      levelBreakdown: {},
      topCategories: [],
      topRelationships: []
    };
    
    // Platform breakdown
    for (const [key, category] of this.discoveredCategories) {
      const platform = category.platform;
      stats.platformBreakdown[platform] = (stats.platformBreakdown[platform] || 0) + 1;
    }
    
    // Level breakdown
    for (const [key, category] of this.discoveredCategories) {
      const level = category.level;
      stats.levelBreakdown[level] = (stats.levelBreakdown[level] || 0) + 1;
    }
    
    // Top categories by frequency
    const sortedCategories = Array.from(this.categoryFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20);
    
    stats.topCategories = sortedCategories.map(([key, frequency]) => ({
      category: key,
      frequency
    }));
    
    // Top relationships by confidence
    const sortedRelationships = Array.from(this.categoryRelationships.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
    
    stats.topRelationships = sortedRelationships.map(rel => ({
      relationship: `${rel.parent} → ${rel.child}`,
      confidence: rel.confidence.toFixed(2),
      frequency: rel.frequency
    }));
    
    return stats;
  }

  /**
   * Export learned categories to database
   * @returns {Object} Export results
   */
  async exportLearnedCategories() {
    try {
      logger.info('Exporting learned categories to database');
      
      const exportData = {
        discoveredCategories: Object.fromEntries(this.discoveredCategories),
        categoryPatterns: Object.fromEntries(this.categoryPatterns),
        categoryRelationships: Object.fromEntries(this.categoryRelationships),
        categoryFrequency: Object.fromEntries(this.categoryFrequency),
        exportTimestamp: new Date().toISOString()
      };
      
      // Store in database
      await this.categoryHierarchyDB.hierarchyRef.child('learnedCategories').set(exportData);
      
      logger.info('Successfully exported learned categories', {
        discoveredCategories: this.discoveredCategories.size,
        patterns: this.categoryPatterns.size,
        relationships: this.categoryRelationships.size
      });
      
      return {
        success: true,
        exportedCategories: this.discoveredCategories.size,
        exportedPatterns: this.categoryPatterns.size,
        exportedRelationships: this.categoryRelationships.size
      };
      
    } catch (error) {
      logger.error('Error exporting learned categories', { error: error.message });
      throw error;
    }
  }

  /**
   * Load learned categories from database
   * @returns {Object} Load results
   */
  async loadLearnedCategories() {
    try {
      logger.info('Loading learned categories from database');
      
      const snapshot = await this.categoryHierarchyDB.hierarchyRef.child('learnedCategories').once('value');
      const data = snapshot.val();
      
      if (!data) {
        logger.info('No learned categories found in database');
        return { success: true, loaded: 0 };
      }
      
      // Load discovered categories
      if (data.discoveredCategories) {
        this.discoveredCategories = new Map(Object.entries(data.discoveredCategories));
      }
      
      // Load category patterns
      if (data.categoryPatterns) {
        this.categoryPatterns = new Map(Object.entries(data.categoryPatterns));
      }
      
      // Load category relationships
      if (data.categoryRelationships) {
        this.categoryRelationships = new Map(Object.entries(data.categoryRelationships));
      }
      
      // Load category frequency
      if (data.categoryFrequency) {
        this.categoryFrequency = new Map(Object.entries(data.categoryFrequency));
      }
      
      logger.info('Successfully loaded learned categories', {
        discoveredCategories: this.discoveredCategories.size,
        patterns: this.categoryPatterns.size,
        relationships: this.categoryRelationships.size
      });
      
      return {
        success: true,
        loadedCategories: this.discoveredCategories.size,
        loadedPatterns: this.categoryPatterns.size,
        loadedRelationships: this.categoryRelationships.size
      };
      
    } catch (error) {
      logger.error('Error loading learned categories', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate category hierarchy from learned data
   * @returns {Object} Generated hierarchy structure
   */
  generateHierarchyFromLearnedData() {
    try {
      const hierarchy = {};
      
      // Group categories by platform and level
      const platformCategories = {};
      
      for (const [key, category] of this.discoveredCategories) {
        const platform = category.platform;
        if (!platformCategories[platform]) {
          platformCategories[platform] = {};
        }
        
        const level = category.level;
        if (!platformCategories[platform][level]) {
          platformCategories[platform][level] = [];
        }
        
        platformCategories[platform][level].push({
          name: category.path[level - 1],
          key: this.normalizeCategoryName(category.path[level - 1]),
          frequency: category.productCount,
          lastSeen: category.lastSeen
        });
      }
      
      // Build hierarchy structure
      for (const [platform, levels] of Object.entries(platformCategories)) {
        hierarchy[platform] = {};
        
        // Level 1 categories (main categories)
        if (levels[1]) {
          for (const category of levels[1]) {
            hierarchy[platform][category.key] = {
              name: category.name,
              level: 1,
              frequency: category.frequency,
              subcategories: {}
            };
          }
        }
        
        // Level 2 categories (subcategories)
        if (levels[2]) {
          for (const category of levels[2]) {
            // Find parent category
            const parentKey = this.findParentCategory(category, levels[1]);
            if (parentKey && hierarchy[platform][parentKey]) {
              hierarchy[platform][parentKey].subcategories[category.key] = {
                name: category.name,
                level: 2,
                frequency: category.frequency,
                styles: {}
              };
            }
          }
        }
        
        // Level 3 categories (styles)
        if (levels[3]) {
          for (const category of levels[3]) {
            // Find parent subcategory
            const parentKey = this.findParentCategory(category, levels[2]);
            if (parentKey) {
              // Find grandparent category
              for (const [mainKey, mainCategory] of Object.entries(hierarchy[platform])) {
                if (mainCategory.subcategories[parentKey]) {
                  mainCategory.subcategories[parentKey].styles[category.key] = {
                    name: category.name,
                    level: 3,
                    frequency: category.frequency
                  };
                  break;
                }
              }
            }
          }
        }
      }
      
      return hierarchy;
      
    } catch (error) {
      logger.error('Error generating hierarchy from learned data', { error: error.message });
      return {};
    }
  }

  /**
   * Find parent category for a given category
   * @param {Object} category - Category object
   * @param {Array} parentLevels - Array of parent level categories
   * @returns {string|null} Parent category key
   */
  findParentCategory(category, parentLevels) {
    if (!parentLevels || parentLevels.length === 0) return null;
    
    // Simple heuristic: find the most frequent parent
    let bestParent = null;
    let bestScore = 0;
    
    for (const parent of parentLevels) {
      const relationshipKey = `${category.platform}_${parent.name}_${category.name}`;
      const relationship = this.categoryRelationships.get(relationshipKey);
      
      if (relationship && relationship.confidence > bestScore) {
        bestScore = relationship.confidence;
        bestParent = parent.key;
      }
    }
    
    return bestParent;
  }
}

module.exports = { DynamicCategoryExtractor };

