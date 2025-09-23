const { getModuleLogger } = require('../logger/logger');
const { CategoryPatternRecognizer } = require('./categoryPatternRecognizer');

const logger = getModuleLogger('automaticHierarchyBuilder');

/**
 * Automatic Hierarchy Builder
 * 
 * This system automatically builds category hierarchies from learned data,
 * using pattern recognition and clustering to create optimal category structures.
 */

class AutomaticHierarchyBuilder {
  constructor() {
    this.patternRecognizer = new CategoryPatternRecognizer();
    this.hierarchy = {};
    this.categoryMappings = new Map();
    this.confidenceThreshold = 0.6;
  }

  /**
   * Build hierarchy from discovered categories
   * @param {Map} discoveredCategories - Map of discovered categories
   * @returns {Object} Built hierarchy structure
   */
  async buildHierarchy(discoveredCategories) {
    try {
      logger.info('Building automatic hierarchy from discovered categories');
      
      // Analyze patterns first
      const patternAnalysis = this.patternRecognizer.analyzePatterns(discoveredCategories);
      
      // Build hierarchy structure
      const hierarchy = await this.buildHierarchyStructure(discoveredCategories, patternAnalysis);
      
      // Optimize hierarchy
      const optimizedHierarchy = await this.optimizeHierarchy(hierarchy, patternAnalysis);
      
      // Generate category mappings
      const mappings = this.generateCategoryMappings(optimizedHierarchy, discoveredCategories);
      
      const result = {
        hierarchy: optimizedHierarchy,
        mappings,
        statistics: this.generateHierarchyStatistics(optimizedHierarchy),
        recommendations: patternAnalysis.recommendations
      };
      
      logger.info('Hierarchy building completed', {
        totalCategories: Object.keys(optimizedHierarchy).length,
        mappings: mappings.size,
        recommendations: result.recommendations.length
      });
      
      return result;
      
    } catch (error) {
      logger.error('Error building hierarchy', { error: error.message });
      throw error;
    }
  }

  /**
   * Build initial hierarchy structure
   * @param {Map} discoveredCategories - Map of discovered categories
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {Object} Initial hierarchy structure
   */
  async buildHierarchyStructure(discoveredCategories, patternAnalysis) {
    try {
      const hierarchy = {};
      
      // Group categories by platform
      const platformGroups = this.groupCategoriesByPlatform(discoveredCategories);
      
      // Build hierarchy for each platform
      for (const [platform, categories] of platformGroups) {
        hierarchy[platform] = await this.buildPlatformHierarchy(categories, patternAnalysis);
      }
      
      // Merge common categories across platforms
      const mergedHierarchy = await this.mergeCommonCategories(hierarchy);
      
      return mergedHierarchy;
      
    } catch (error) {
      logger.error('Error building hierarchy structure', { error: error.message });
      throw error;
    }
  }

  /**
   * Group categories by platform
   * @param {Map} discoveredCategories - Map of discovered categories
   * @returns {Map} Categories grouped by platform
   */
  groupCategoriesByPlatform(discoveredCategories) {
    const platformGroups = new Map();
    
    for (const [key, category] of discoveredCategories) {
      const platform = category.platform;
      
      if (!platformGroups.has(platform)) {
        platformGroups.set(platform, []);
      }
      
      platformGroups.get(platform).push(category);
    }
    
    return platformGroups;
  }

  /**
   * Build hierarchy for a specific platform
   * @param {Array} categories - Array of categories for the platform
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {Object} Platform hierarchy
   */
  async buildPlatformHierarchy(categories, patternAnalysis) {
    const platformHierarchy = {};
    
    // Sort categories by level and frequency
    const sortedCategories = categories.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return b.productCount - a.productCount;
    });
    
    // Build level 1 categories (main categories)
    const level1Categories = sortedCategories.filter(cat => cat.level === 1);
    for (const category of level1Categories) {
      const categoryKey = this.generateCategoryKey(category.path[0]);
      platformHierarchy[categoryKey] = {
        name: category.path[0],
        key: categoryKey,
        level: 1,
        frequency: category.productCount,
        subcategories: {},
        confidence: this.calculateCategoryConfidence(category, patternAnalysis)
      };
    }
    
    // Build level 2 categories (subcategories)
    const level2Categories = sortedCategories.filter(cat => cat.level === 2);
    for (const category of level2Categories) {
      const parentKey = this.findParentCategory(category, level1Categories, patternAnalysis);
      if (parentKey && platformHierarchy[parentKey]) {
        const subcategoryKey = this.generateCategoryKey(category.path[1]);
        platformHierarchy[parentKey].subcategories[subcategoryKey] = {
          name: category.path[1],
          key: subcategoryKey,
          level: 2,
          frequency: category.productCount,
          styles: {},
          confidence: this.calculateCategoryConfidence(category, patternAnalysis)
        };
      }
    }
    
    // Build level 3 categories (styles)
    const level3Categories = sortedCategories.filter(cat => cat.level === 3);
    for (const category of level3Categories) {
      const parentKeys = this.findParentCategories(category, level2Categories, level1Categories, patternAnalysis);
      if (parentKeys.main && parentKeys.sub && platformHierarchy[parentKeys.main]?.subcategories[parentKeys.sub]) {
        const styleKey = this.generateCategoryKey(category.path[2]);
        platformHierarchy[parentKeys.main].subcategories[parentKeys.sub].styles[styleKey] = {
          name: category.path[2],
          key: styleKey,
          level: 3,
          frequency: category.productCount,
          confidence: this.calculateCategoryConfidence(category, patternAnalysis)
        };
      }
    }
    
    return platformHierarchy;
  }

  /**
   * Find parent category for a subcategory
   * @param {Object} category - Category object
   * @param {Array} parentCategories - Array of potential parent categories
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {string|null} Parent category key
   */
  findParentCategory(category, parentCategories, patternAnalysis) {
    if (!category.path || category.path.length < 2) return null;
    
    const subcategoryName = category.path[1];
    
    // Look for exact matches first
    for (const parent of parentCategories) {
      if (parent.path && parent.path[0] === category.path[0]) {
        return this.generateCategoryKey(parent.path[0]);
      }
    }
    
    // Look for semantic relationships
    const semanticKey = `${category.path[0]}_${subcategoryName}`;
    const semanticData = patternAnalysis.patterns.semantic.get(semanticKey);
    
    if (semanticData && semanticData.frequency > 2) {
      for (const parent of parentCategories) {
        if (parent.path && parent.path[0] === category.path[0]) {
          return this.generateCategoryKey(parent.path[0]);
        }
      }
    }
    
    // Fallback to first available parent
    if (parentCategories.length > 0) {
      return this.generateCategoryKey(parentCategories[0].path[0]);
    }
    
    return null;
  }

  /**
   * Find parent categories for a style
   * @param {Object} category - Category object
   * @param {Array} subcategories - Array of subcategories
   * @param {Array} mainCategories - Array of main categories
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {Object} Parent category keys
   */
  findParentCategories(category, subcategories, mainCategories, patternAnalysis) {
    if (!category.path || category.path.length < 3) {
      return { main: null, sub: null };
    }
    
    const mainName = category.path[0];
    const subName = category.path[1];
    
    // Find main category
    let mainKey = null;
    for (const main of mainCategories) {
      if (main.path && main.path[0] === mainName) {
        mainKey = this.generateCategoryKey(main.path[0]);
        break;
      }
    }
    
    // Find subcategory
    let subKey = null;
    for (const sub of subcategories) {
      if (sub.path && sub.path[0] === mainName && sub.path[1] === subName) {
        subKey = this.generateCategoryKey(sub.path[1]);
        break;
      }
    }
    
    return { main: mainKey, sub: subKey };
  }

  /**
   * Merge common categories across platforms
   * @param {Object} hierarchy - Platform-specific hierarchies
   * @returns {Object} Merged hierarchy
   */
  async mergeCommonCategories(hierarchy) {
    const mergedHierarchy = {};
    const categoryMap = new Map();
    
    // Collect all categories across platforms
    for (const [platform, platformHierarchy] of Object.entries(hierarchy)) {
      for (const [categoryKey, category] of Object.entries(platformHierarchy)) {
        if (!categoryMap.has(categoryKey)) {
          categoryMap.set(categoryKey, {
            ...category,
            platforms: new Set(),
            totalFrequency: 0
          });
        }
        
        const mergedCategory = categoryMap.get(categoryKey);
        mergedCategory.platforms.add(platform);
        mergedCategory.totalFrequency += category.frequency;
        
        // Merge subcategories
        if (category.subcategories) {
          for (const [subKey, subcategory] of Object.entries(category.subcategories)) {
            if (!mergedCategory.subcategories[subKey]) {
              mergedCategory.subcategories[subKey] = {
                ...subcategory,
                platforms: new Set(),
                totalFrequency: 0
              };
            }
            
            const mergedSubcategory = mergedCategory.subcategories[subKey];
            mergedSubcategory.platforms.add(platform);
            mergedSubcategory.totalFrequency += subcategory.frequency;
            
            // Merge styles
            if (subcategory.styles) {
              for (const [styleKey, style] of Object.entries(subcategory.styles)) {
                if (!mergedSubcategory.styles[styleKey]) {
                  mergedSubcategory.styles[styleKey] = {
                    ...style,
                    platforms: new Set(),
                    totalFrequency: 0
                  };
                }
                
                const mergedStyle = mergedSubcategory.styles[styleKey];
                mergedStyle.platforms.add(platform);
                mergedStyle.totalFrequency += style.frequency;
              }
            }
          }
        }
      }
    }
    
    // Convert to final hierarchy structure
    for (const [categoryKey, category] of categoryMap) {
      mergedHierarchy[categoryKey] = {
        ...category,
        platforms: Array.from(category.platforms),
        crossPlatform: category.platforms.size > 1
      };
      
      // Convert subcategories
      if (category.subcategories) {
        for (const [subKey, subcategory] of Object.entries(category.subcategories)) {
          mergedHierarchy[categoryKey].subcategories[subKey] = {
            ...subcategory,
            platforms: Array.from(subcategory.platforms),
            crossPlatform: subcategory.platforms.size > 1
          };
          
          // Convert styles
          if (subcategory.styles) {
            for (const [styleKey, style] of Object.entries(subcategory.styles)) {
              mergedHierarchy[categoryKey].subcategories[subKey].styles[styleKey] = {
                ...style,
                platforms: Array.from(style.platforms),
                crossPlatform: style.platforms.size > 1
              };
            }
          }
        }
      }
    }
    
    return mergedHierarchy;
  }

  /**
   * Optimize hierarchy based on patterns and recommendations
   * @param {Object} hierarchy - Initial hierarchy
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {Object} Optimized hierarchy
   */
  async optimizeHierarchy(hierarchy, patternAnalysis) {
    try {
      logger.info('Optimizing hierarchy structure');
      
      const optimizedHierarchy = { ...hierarchy };
      
      // Apply recommendations
      for (const recommendation of patternAnalysis.recommendations) {
        switch (recommendation.type) {
          case 'merge':
            await this.applyMergeRecommendation(optimizedHierarchy, recommendation);
            break;
          case 'standardize':
            await this.applyStandardizeRecommendation(optimizedHierarchy, recommendation);
            break;
          case 'hierarchy':
            await this.applyHierarchyRecommendation(optimizedHierarchy, recommendation);
            break;
        }
      }
      
      // Remove low-confidence categories
      await this.removeLowConfidenceCategories(optimizedHierarchy);
      
      // Consolidate similar categories
      await this.consolidateSimilarCategories(optimizedHierarchy, patternAnalysis);
      
      logger.info('Hierarchy optimization completed');
      
      return optimizedHierarchy;
      
    } catch (error) {
      logger.error('Error optimizing hierarchy', { error: error.message });
      return hierarchy;
    }
  }

  /**
   * Apply merge recommendation
   * @param {Object} hierarchy - Hierarchy to modify
   * @param {Object} recommendation - Merge recommendation
   */
  async applyMergeRecommendation(hierarchy, recommendation) {
    // Implementation for merging similar categories
    logger.debug('Applying merge recommendation', { recommendation });
  }

  /**
   * Apply standardize recommendation
   * @param {Object} hierarchy - Hierarchy to modify
   * @param {Object} recommendation - Standardize recommendation
   */
  async applyStandardizeRecommendation(hierarchy, recommendation) {
    // Implementation for standardizing naming patterns
    logger.debug('Applying standardize recommendation', { recommendation });
  }

  /**
   * Apply hierarchy recommendation
   * @param {Object} hierarchy - Hierarchy to modify
   * @param {Object} recommendation - Hierarchy recommendation
   */
  async applyHierarchyRecommendation(hierarchy, recommendation) {
    // Implementation for improving hierarchy relationships
    logger.debug('Applying hierarchy recommendation', { recommendation });
  }

  /**
   * Remove low-confidence categories
   * @param {Object} hierarchy - Hierarchy to modify
   */
  async removeLowConfidenceCategories(hierarchy) {
    for (const [categoryKey, category] of Object.entries(hierarchy)) {
      if (category.confidence < this.confidenceThreshold) {
        delete hierarchy[categoryKey];
        continue;
      }
      
      // Check subcategories
      if (category.subcategories) {
        for (const [subKey, subcategory] of Object.entries(category.subcategories)) {
          if (subcategory.confidence < this.confidenceThreshold) {
            delete category.subcategories[subKey];
          }
        }
      }
    }
  }

  /**
   * Consolidate similar categories
   * @param {Object} hierarchy - Hierarchy to modify
   * @param {Object} patternAnalysis - Pattern analysis results
   */
  async consolidateSimilarCategories(hierarchy, patternAnalysis) {
    // Implementation for consolidating similar categories
    logger.debug('Consolidating similar categories');
  }

  /**
   * Generate category mappings
   * @param {Object} hierarchy - Built hierarchy
   * @param {Map} discoveredCategories - Original discovered categories
   * @returns {Map} Category mappings
   */
  generateCategoryMappings(hierarchy, discoveredCategories) {
    const mappings = new Map();
    
    for (const [key, category] of discoveredCategories) {
      const mapping = this.findBestMapping(category, hierarchy);
      if (mapping) {
        mappings.set(key, mapping);
      }
    }
    
    return mappings;
  }

  /**
   * Find best mapping for a category
   * @param {Object} category - Category to map
   * @param {Object} hierarchy - Target hierarchy
   * @returns {Object|null} Best mapping
   */
  findBestMapping(category, hierarchy) {
    // Implementation for finding best category mapping
    return null;
  }

  /**
   * Calculate category confidence
   * @param {Object} category - Category object
   * @param {Object} patternAnalysis - Pattern analysis results
   * @returns {number} Confidence score (0-1)
   */
  calculateCategoryConfidence(category, patternAnalysis) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on frequency
    if (category.productCount > 10) {
      confidence += 0.3;
    } else if (category.productCount > 5) {
      confidence += 0.2;
    }
    
    // Increase confidence based on pattern matches
    const categoryName = category.path[category.path.length - 1];
    const normalizedName = this.normalizeCategoryName(categoryName);
    
    // Check for common patterns
    const commonPatterns = ['electronics', 'fashion', 'home', 'beauty', 'sports'];
    if (commonPatterns.some(pattern => normalizedName.includes(pattern))) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Generate category key
   * @param {string} categoryName - Category name
   * @returns {string} Generated category key
   */
  generateCategoryKey(categoryName) {
    return this.normalizeCategoryName(categoryName);
  }

  /**
   * Normalize category name
   * @param {string} categoryName - Category name
   * @returns {string} Normalized category name
   */
  normalizeCategoryName(categoryName) {
    if (!categoryName) return '';
    
    return categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Generate hierarchy statistics
   * @param {Object} hierarchy - Built hierarchy
   * @returns {Object} Hierarchy statistics
   */
  generateHierarchyStatistics(hierarchy) {
    const stats = {
      totalCategories: 0,
      totalSubcategories: 0,
      totalStyles: 0,
      crossPlatformCategories: 0,
      averageConfidence: 0,
      platformDistribution: {}
    };
    
    let totalConfidence = 0;
    let categoryCount = 0;
    
    for (const [categoryKey, category] of Object.entries(hierarchy)) {
      stats.totalCategories++;
      totalConfidence += category.confidence || 0;
      categoryCount++;
      
      if (category.crossPlatform) {
        stats.crossPlatformCategories++;
      }
      
      // Count subcategories
      if (category.subcategories) {
        for (const [subKey, subcategory] of Object.entries(category.subcategories)) {
          stats.totalSubcategories++;
          totalConfidence += subcategory.confidence || 0;
          categoryCount++;
          
          // Count styles
          if (subcategory.styles) {
            for (const [styleKey, style] of Object.entries(subcategory.styles)) {
              stats.totalStyles++;
              totalConfidence += style.confidence || 0;
              categoryCount++;
            }
          }
        }
      }
      
      // Platform distribution
      if (category.platforms) {
        category.platforms.forEach(platform => {
          stats.platformDistribution[platform] = (stats.platformDistribution[platform] || 0) + 1;
        });
      }
    }
    
    stats.averageConfidence = categoryCount > 0 ? (totalConfidence / categoryCount).toFixed(3) : 0;
    
    return stats;
  }
}

module.exports = { AutomaticHierarchyBuilder };

