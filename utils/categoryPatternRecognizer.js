const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('categoryPatternRecognizer');

/**
 * Category Pattern Recognizer
 * 
 * This system recognizes patterns in category data and clusters similar categories
 * to improve categorization accuracy and discover new category relationships.
 */

class CategoryPatternRecognizer {
  constructor() {
    this.patterns = new Map();
    this.clusters = new Map();
    this.similarityThreshold = 0.7;
    this.minClusterSize = 3;
  }

  /**
   * Analyze category patterns from discovered categories
   * @param {Map} discoveredCategories - Map of discovered categories
   * @returns {Object} Pattern analysis results
   */
  analyzePatterns(discoveredCategories) {
    try {
      logger.info('Analyzing category patterns');
      
      const analysis = {
        totalCategories: discoveredCategories.size,
        patterns: {
          naming: new Map(),
          structural: new Map(),
          semantic: new Map(),
          frequency: new Map()
        },
        clusters: [],
        recommendations: []
      };

      // Analyze each category
      for (const [key, category] of discoveredCategories) {
        this.analyzeCategoryPatterns(category, analysis);
      }

      // Generate clusters
      analysis.clusters = this.generateClusters(discoveredCategories);
      
      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);

      logger.info('Pattern analysis completed', {
        totalCategories: analysis.totalCategories,
        clusters: analysis.clusters.length,
        recommendations: analysis.recommendations.length
      });

      return analysis;

    } catch (error) {
      logger.error('Error analyzing patterns', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze patterns for a single category
   * @param {Object} category - Category object
   * @param {Object} analysis - Analysis results object
   */
  analyzeCategoryPatterns(category, analysis) {
    const { path, platform, level } = category;
    
    // Analyze naming patterns
    this.analyzeNamingPatterns(path, platform, level, analysis);
    
    // Analyze structural patterns
    this.analyzeStructuralPatterns(path, platform, level, analysis);
    
    // Analyze semantic patterns
    this.analyzeSemanticPatterns(path, platform, level, analysis);
    
    // Analyze frequency patterns
    this.analyzeFrequencyPatterns(category, analysis);
  }

  /**
   * Analyze naming patterns in category paths
   * @param {Array} path - Category path array
   * @param {string} platform - Platform name
   * @param {number} level - Category level
   * @param {Object} analysis - Analysis results object
   */
  analyzeNamingPatterns(path, platform, level, analysis) {
    for (let i = 0; i < path.length; i++) {
      const categoryName = path[i];
      const normalizedName = this.normalizeCategoryName(categoryName);
      
      // Extract naming patterns
      const patterns = this.extractNamingPatterns(categoryName);
      
      patterns.forEach(pattern => {
        const patternKey = `${pattern.type}_${pattern.value}`;
        if (!analysis.patterns.naming.has(patternKey)) {
          analysis.patterns.naming.set(patternKey, {
            type: pattern.type,
            value: pattern.value,
            categories: [],
            frequency: 0
          });
        }
        
        const patternData = analysis.patterns.naming.get(patternKey);
        patternData.categories.push({
          name: categoryName,
          platform,
          level: i + 1
        });
        patternData.frequency++;
      });
    }
  }

  /**
   * Extract naming patterns from category name
   * @param {string} categoryName - Category name
   * @returns {Array} Array of naming patterns
   */
  extractNamingPatterns(categoryName) {
    const patterns = [];
    const name = categoryName.toLowerCase();
    
    // Size-based patterns
    const sizePatterns = ['small', 'medium', 'large', 'xl', 'xxl', 'xs', 's', 'm', 'l'];
    sizePatterns.forEach(size => {
      if (name.includes(size)) {
        patterns.push({ type: 'size', value: size });
      }
    });
    
    // Color-based patterns
    const colorPatterns = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'gray', 'grey'];
    colorPatterns.forEach(color => {
      if (name.includes(color)) {
        patterns.push({ type: 'color', value: color });
      }
    });
    
    // Material-based patterns
    const materialPatterns = ['leather', 'metal', 'plastic', 'wood', 'fabric', 'cotton', 'silk', 'wool', 'denim', 'canvas'];
    materialPatterns.forEach(material => {
      if (name.includes(material)) {
        patterns.push({ type: 'material', value: material });
      }
    });
    
    // Style-based patterns
    const stylePatterns = ['casual', 'formal', 'sports', 'gaming', 'professional', 'vintage', 'modern', 'classic', 'trendy'];
    stylePatterns.forEach(style => {
      if (name.includes(style)) {
        patterns.push({ type: 'style', value: style });
      }
    });
    
    // Feature-based patterns
    const featurePatterns = ['wireless', 'bluetooth', 'smart', 'digital', 'premium', 'budget', 'eco', 'organic', 'natural'];
    featurePatterns.forEach(feature => {
      if (name.includes(feature)) {
        patterns.push({ type: 'feature', value: feature });
      }
    });
    
    // Brand patterns (capitalized words)
    const brandMatches = categoryName.match(/\b[A-Z][a-z]+\b/g);
    if (brandMatches) {
      brandMatches.forEach(brand => {
        patterns.push({ type: 'brand', value: brand.toLowerCase() });
      });
    }
    
    // Numeric patterns
    const numericMatches = categoryName.match(/\d+/g);
    if (numericMatches) {
      numericMatches.forEach(number => {
        patterns.push({ type: 'numeric', value: number });
      });
    }
    
    return patterns;
  }

  /**
   * Analyze structural patterns in category paths
   * @param {Array} path - Category path array
   * @param {string} platform - Platform name
   * @param {number} level - Category level
   * @param {Object} analysis - Analysis results object
   */
  analyzeStructuralPatterns(path, platform, level, analysis) {
    const structuralKey = `level_${level}_length_${path.length}`;
    
    if (!analysis.patterns.structural.has(structuralKey)) {
      analysis.patterns.structural.set(structuralKey, {
        level,
        pathLength: path.length,
        categories: [],
        frequency: 0
      });
    }
    
    const structuralData = analysis.patterns.structural.get(structuralKey);
    structuralData.categories.push({
      path,
      platform
    });
    structuralData.frequency++;
  }

  /**
   * Analyze semantic patterns in category paths
   * @param {Array} path - Category path array
   * @param {string} platform - Platform name
   * @param {number} level - Category level
   * @param {Object} analysis - Analysis results object
   */
  analyzeSemanticPatterns(path, platform, level, analysis) {
    // Extract semantic relationships
    for (let i = 0; i < path.length - 1; i++) {
      const parent = path[i];
      const child = path[i + 1];
      
      const semanticKey = `${parent}_${child}`;
      
      if (!analysis.patterns.semantic.has(semanticKey)) {
        analysis.patterns.semantic.set(semanticKey, {
          parent,
          child,
          categories: [],
          frequency: 0,
          confidence: 0
        });
      }
      
      const semanticData = analysis.patterns.semantic.get(semanticKey);
      semanticData.categories.push({
        platform,
        level: i + 2
      });
      semanticData.frequency++;
    }
  }

  /**
   * Analyze frequency patterns
   * @param {Object} category - Category object
   * @param {Object} analysis - Analysis results object
   */
  analyzeFrequencyPatterns(category, analysis) {
    const frequencyKey = `freq_${category.productCount}`;
    
    if (!analysis.patterns.frequency.has(frequencyKey)) {
      analysis.patterns.frequency.set(frequencyKey, {
        productCount: category.productCount,
        categories: [],
        frequency: 0
      });
    }
    
    const frequencyData = analysis.patterns.frequency.get(frequencyKey);
    frequencyData.categories.push({
      path: category.path,
      platform: category.platform
    });
    frequencyData.frequency++;
  }

  /**
   * Generate clusters of similar categories
   * @param {Map} discoveredCategories - Map of discovered categories
   * @returns {Array} Array of clusters
   */
  generateClusters(discoveredCategories) {
    try {
      logger.info('Generating category clusters');
      
      const clusters = [];
      const processed = new Set();
      
      // Convert to array for processing
      const categories = Array.from(discoveredCategories.entries());
      
      for (let i = 0; i < categories.length; i++) {
        const [key1, category1] = categories[i];
        
        if (processed.has(key1)) continue;
        
        const cluster = {
          id: `cluster_${clusters.length + 1}`,
          categories: [category1],
          similarity: 1.0,
          patterns: this.extractClusterPatterns([category1])
        };
        
        // Find similar categories
        for (let j = i + 1; j < categories.length; j++) {
          const [key2, category2] = categories[j];
          
          if (processed.has(key2)) continue;
          
          const similarity = this.calculateSimilarity(category1, category2);
          
          if (similarity >= this.similarityThreshold) {
            cluster.categories.push(category2);
            cluster.similarity = Math.min(cluster.similarity, similarity);
            processed.add(key2);
          }
        }
        
        // Only keep clusters with minimum size
        if (cluster.categories.length >= this.minClusterSize) {
          clusters.push(cluster);
        }
        
        processed.add(key1);
      }
      
      logger.info('Clustering completed', { 
        totalClusters: clusters.length,
        totalCategories: categories.length
      });
      
      return clusters;
      
    } catch (error) {
      logger.error('Error generating clusters', { error: error.message });
      return [];
    }
  }

  /**
   * Calculate similarity between two categories
   * @param {Object} category1 - First category
   * @param {Object} category2 - Second category
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(category1, category2) {
    let similarity = 0;
    let factors = 0;
    
    // Platform similarity
    if (category1.platform === category2.platform) {
      similarity += 0.3;
    }
    factors += 0.3;
    
    // Level similarity
    if (category1.level === category2.level) {
      similarity += 0.2;
    }
    factors += 0.2;
    
    // Path similarity
    const pathSimilarity = this.calculatePathSimilarity(category1.path, category2.path);
    similarity += pathSimilarity * 0.5;
    factors += 0.5;
    
    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate similarity between two category paths
   * @param {Array} path1 - First category path
   * @param {Array} path2 - Second category path
   * @returns {number} Path similarity score (0-1)
   */
  calculatePathSimilarity(path1, path2) {
    if (!path1 || !path2 || path1.length === 0 || path2.length === 0) {
      return 0;
    }
    
    const maxLength = Math.max(path1.length, path2.length);
    let matches = 0;
    
    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
      const name1 = this.normalizeCategoryName(path1[i]);
      const name2 = this.normalizeCategoryName(path2[i]);
      
      if (name1 === name2) {
        matches++;
      } else {
        // Check for partial matches
        const similarity = this.calculateStringSimilarity(name1, name2);
        if (similarity > 0.8) {
          matches += similarity;
        }
      }
    }
    
    return matches / maxLength;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Extract patterns from a cluster of categories
   * @param {Array} categories - Array of categories in the cluster
   * @returns {Object} Cluster patterns
   */
  extractClusterPatterns(categories) {
    const patterns = {
      commonWords: new Map(),
      commonPatterns: new Map(),
      platformDistribution: new Map(),
      levelDistribution: new Map()
    };
    
    categories.forEach(category => {
      // Extract common words
      category.path.forEach(name => {
        const words = name.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) {
            patterns.commonWords.set(word, (patterns.commonWords.get(word) || 0) + 1);
          }
        });
      });
      
      // Platform distribution
      patterns.platformDistribution.set(
        category.platform, 
        (patterns.platformDistribution.get(category.platform) || 0) + 1
      );
      
      // Level distribution
      patterns.levelDistribution.set(
        category.level, 
        (patterns.levelDistribution.get(category.level) || 0) + 1
      );
    });
    
    return patterns;
  }

  /**
   * Generate recommendations based on pattern analysis
   * @param {Object} analysis - Pattern analysis results
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Recommend merging similar categories
    analysis.clusters.forEach(cluster => {
      if (cluster.categories.length > 3) {
        recommendations.push({
          type: 'merge',
          message: `Consider merging ${cluster.categories.length} similar categories`,
          categories: cluster.categories.map(cat => cat.path.join(' > ')),
          confidence: cluster.similarity
        });
      }
    });
    
    // Recommend standardizing naming patterns
    const topNamingPatterns = Array.from(analysis.patterns.naming.entries())
      .sort(([,a], [,b]) => b.frequency - a.frequency)
      .slice(0, 10);
    
    topNamingPatterns.forEach(([patternKey, patternData]) => {
      if (patternData.frequency > 5) {
        recommendations.push({
          type: 'standardize',
          message: `Standardize naming pattern: ${patternData.type} - ${patternData.value}`,
          pattern: patternData,
          frequency: patternData.frequency
        });
      }
    });
    
    // Recommend category hierarchy improvements
    const lowConfidenceRelationships = Array.from(analysis.patterns.semantic.entries())
      .filter(([,rel]) => rel.frequency < 3)
      .slice(0, 5);
    
    lowConfidenceRelationships.forEach(([relKey, relData]) => {
      recommendations.push({
        type: 'hierarchy',
        message: `Review relationship: ${relData.parent} → ${relData.child}`,
        relationship: relData,
        frequency: relData.frequency
      });
    });
    
    return recommendations;
  }

  /**
   * Normalize category name for comparison
   * @param {string} categoryName - Category name
   * @returns {string} Normalized category name
   */
  normalizeCategoryName(categoryName) {
    if (!categoryName) return '';
    
    return categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get pattern analysis summary
   * @param {Object} analysis - Pattern analysis results
   * @returns {Object} Analysis summary
   */
  getAnalysisSummary(analysis) {
    return {
      totalCategories: analysis.totalCategories,
      totalClusters: analysis.clusters.length,
      totalRecommendations: analysis.recommendations.length,
      patternTypes: {
        naming: analysis.patterns.naming.size,
        structural: analysis.patterns.structural.size,
        semantic: analysis.patterns.semantic.size,
        frequency: analysis.patterns.frequency.size
      },
      topClusters: analysis.clusters
        .sort((a, b) => b.categories.length - a.categories.length)
        .slice(0, 5)
        .map(cluster => ({
          id: cluster.id,
          size: cluster.categories.length,
          similarity: cluster.similarity
        })),
      topRecommendations: analysis.recommendations
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 5)
    };
  }
}

module.exports = { CategoryPatternRecognizer };

