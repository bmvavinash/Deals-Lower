const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require('../../logger/logger');
const { 
  CATEGORY_HIERARCHY, 
  getAllCategories, 
  generateHierarchicalKey,
  parseHierarchicalKey 
} = require('../../config/categoryHierarchy');

const logger = getModuleLogger('categoryHierarchyDB');

// Initialize Firebase Admin SDK
const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
	});
}

const db = admin.database();

class CategoryHierarchyDB {
  constructor() {
    this.hierarchyRef = db.ref('categoryHierarchy');
    this.productsRef = db.ref('productdeals');
  }

  /**
   * Initialize category hierarchy in database
   */
  async initializeHierarchy() {
    try {
      logger.info('Initializing category hierarchy in database');
      
      const categories = getAllCategories();
      const hierarchyData = {};
      
      // Convert flat categories to hierarchical structure
      for (const category of categories) {
        const key = category.parent 
          ? `${category.parent}_${category.key}`
          : category.key;
        
        hierarchyData[key] = {
          level: category.level,
          key: category.key,
          name: category.name,
          parent: category.parent || null,
          children: []
        };
      }
      
      // Build parent-child relationships
      for (const [key, category] of Object.entries(hierarchyData)) {
        if (category.parent) {
          const parentKey = category.parent;
          if (hierarchyData[parentKey]) {
            hierarchyData[parentKey].children.push(key);
          }
        }
      }
      
      await this.hierarchyRef.set(hierarchyData);
      logger.info('Category hierarchy initialized successfully', { 
        totalCategories: Object.keys(hierarchyData).length 
      });
      
      return hierarchyData;
    } catch (error) {
      logger.error('Failed to initialize category hierarchy', { error: error.message });
      throw error;
    }
  }

  /**
   * Get category hierarchy from database
   */
  async getHierarchy() {
    try {
      const snapshot = await this.hierarchyRef.once('value');
      return snapshot.val() || {};
    } catch (error) {
      logger.error('Failed to get category hierarchy', { error: error.message });
      throw error;
    }
  }

  /**
   * Get products by hierarchical category
   * @param {string} mainCategory - Main category key
   * @param {string} subcategory - Subcategory key (optional)
   * @param {string} style - Style key (optional)
   * @param {number} limit - Maximum number of products to return
   */
  async getProductsByHierarchy(mainCategory, subcategory = null, style = null, limit = 100) {
    try {
      const hierarchicalKey = generateHierarchicalKey(mainCategory, subcategory, style);
      
      const snapshot = await this.productsRef
        .orderByChild('hierarchicalCategory/hierarchicalKey')
        .equalTo(hierarchicalKey)
        .limitToFirst(limit)
        .once('value');
      
      const products = snapshot.val() || {};
      const productList = Object.values(products);
      
      logger.info('Retrieved products by hierarchy', {
        mainCategory,
        subcategory,
        style,
        hierarchicalKey,
        count: productList.length
      });
      
      return productList;
    } catch (error) {
      logger.error('Failed to get products by hierarchy', { 
        error: error.message,
        mainCategory,
        subcategory,
        style
      });
      throw error;
    }
  }

  /**
   * Get products by main category (all subcategories and styles)
   * @param {string} mainCategory - Main category key
   * @param {number} limit - Maximum number of products to return
   */
  async getProductsByMainCategory(mainCategory, limit = 1000) {
    try {
      const snapshot = await this.productsRef
        .orderByChild('hierarchicalCategory/mainCategory')
        .equalTo(mainCategory)
        .limitToFirst(limit)
        .once('value');
      
      const products = snapshot.val() || {};
      const productList = Object.values(products);
      
      logger.info('Retrieved products by main category', {
        mainCategory,
        count: productList.length
      });
      
      return productList;
    } catch (error) {
      logger.error('Failed to get products by main category', { 
        error: error.message,
        mainCategory
      });
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats() {
    try {
      const snapshot = await this.productsRef.once('value');
      const products = snapshot.val() || {};
      const productList = Object.values(products);
      
      const stats = {
        totalProducts: productList.length,
        categories: {},
        subcategories: {},
        styles: {}
      };
      
      for (const product of productList) {
        const hierarchical = product.hierarchicalCategory || {};
        const { mainCategory, subcategory, style } = hierarchical;
        
        // Count main categories
        if (mainCategory) {
          stats.categories[mainCategory] = (stats.categories[mainCategory] || 0) + 1;
        }
        
        // Count subcategories
        if (mainCategory && subcategory) {
          const subKey = `${mainCategory}_${subcategory}`;
          stats.subcategories[subKey] = (stats.subcategories[subKey] || 0) + 1;
        }
        
        // Count styles
        if (mainCategory && subcategory && style) {
          const styleKey = `${mainCategory}_${subcategory}_${style}`;
          stats.styles[styleKey] = (stats.styles[styleKey] || 0) + 1;
        }
      }
      
      logger.info('Generated category statistics', {
        totalProducts: stats.totalProducts,
        uniqueCategories: Object.keys(stats.categories).length,
        uniqueSubcategories: Object.keys(stats.subcategories).length,
        uniqueStyles: Object.keys(stats.styles).length
      });
      
      return stats;
    } catch (error) {
      logger.error('Failed to get category statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Update product hierarchical categories in bulk
   * @param {Array} products - Array of products to update
   */
  async updateProductsHierarchy(products) {
    try {
      const updates = {};
      let updatedCount = 0;
      
      for (const product of products) {
        if (product.productCode) {
          const productRef = `productdeals/${product.productCode}`;
          updates[productRef] = {
            hierarchicalCategory: product.hierarchicalCategory || {
              mainCategory: "",
              subcategory: "",
              style: "",
              hierarchicalKey: ""
            }
          };
          updatedCount++;
        }
      }
      
      await this.productsRef.update(updates);
      
      logger.info('Updated products hierarchy', { updatedCount });
      return { updatedCount };
    } catch (error) {
      logger.error('Failed to update products hierarchy', { error: error.message });
      throw error;
    }
  }

  /**
   * Search products by category hierarchy
   * @param {Object} searchCriteria - Search criteria
   * @param {string} searchCriteria.mainCategory - Main category to search
   * @param {string} searchCriteria.subcategory - Subcategory to search (optional)
   * @param {string} searchCriteria.style - Style to search (optional)
   * @param {string} searchCriteria.platform - Platform filter (optional)
   * @param {number} searchCriteria.limit - Maximum results (default: 100)
   */
  async searchProducts(searchCriteria) {
    try {
      const {
        mainCategory,
        subcategory = null,
        style = null,
        platform = null,
        limit = 100
      } = searchCriteria;
      
      let query = this.productsRef;
      
      // Apply hierarchical category filter
      if (mainCategory) {
        if (subcategory && style) {
          // Search by specific style
          const hierarchicalKey = generateHierarchicalKey(mainCategory, subcategory, style);
          query = query.orderByChild('hierarchicalCategory/hierarchicalKey').equalTo(hierarchicalKey);
        } else if (subcategory) {
          // Search by subcategory (all styles)
          query = query.orderByChild('hierarchicalCategory/mainCategory').equalTo(mainCategory);
        } else {
          // Search by main category (all subcategories and styles)
          query = query.orderByChild('hierarchicalCategory/mainCategory').equalTo(mainCategory);
        }
      }
      
      // Apply platform filter if specified
      if (platform) {
        // Note: This would require a compound query or filtering after retrieval
        // For now, we'll filter after getting results
      }
      
      const snapshot = await query.limitToFirst(limit).once('value');
      let products = Object.values(snapshot.val() || {});
      
      // Apply platform filter if specified
      if (platform) {
        products = products.filter(product => 
          product.categoryKey && product.categoryKey.startsWith(platform)
        );
      }
      
      // Filter by subcategory if specified and not already filtered by hierarchicalKey
      if (subcategory && !style) {
        products = products.filter(product => 
          product.hierarchicalCategory?.subcategory === subcategory
        );
      }
      
      logger.info('Search completed', {
        searchCriteria,
        resultCount: products.length
      });
      
      return products;
    } catch (error) {
      logger.error('Failed to search products', { 
        error: error.message,
        searchCriteria
      });
      throw error;
    }
  }

  /**
   * Get category tree structure
   */
  async getCategoryTree() {
    try {
      const hierarchy = await this.getHierarchy();
      const stats = await this.getCategoryStats();
      
      const buildTree = (categories, parentKey = null, level = 1) => {
        const children = Object.entries(categories)
          .filter(([key, category]) => category.parent === parentKey)
          .map(([key, category]) => {
            const childTree = buildTree(categories, key, level + 1);
            const productCount = this.getProductCountForCategory(key, stats);
            
            return {
              key: category.key,
              name: category.name,
              level: category.level,
              productCount,
              children: childTree
            };
          });
        
        return children;
      };
      
      const tree = buildTree(hierarchy);
      
      logger.info('Generated category tree', {
        totalNodes: this.countTreeNodes(tree),
        maxDepth: this.getTreeDepth(tree)
      });
      
      return tree;
    } catch (error) {
      logger.error('Failed to get category tree', { error: error.message });
      throw error;
    }
  }

  /**
   * Get product count for a specific category
   */
  getProductCountForCategory(categoryKey, stats) {
    // This is a simplified version - in practice, you'd want more sophisticated counting
    return stats.categories[categoryKey] || 0;
  }

  /**
   * Count total nodes in tree
   */
  countTreeNodes(tree) {
    return tree.reduce((count, node) => {
      return count + 1 + this.countTreeNodes(node.children);
    }, 0);
  }

  /**
   * Get maximum depth of tree
   */
  getTreeDepth(tree) {
    if (tree.length === 0) return 0;
    
    return Math.max(...tree.map(node => {
      return 1 + this.getTreeDepth(node.children);
    }));
  }

  /**
   * Migrate existing products to hierarchical categories
   */
  async migrateToHierarchical() {
    try {
      logger.info('Starting migration to hierarchical categories');
      
      const snapshot = await this.productsRef.once('value');
      const products = snapshot.val() || {};
      const productList = Object.values(products);
      
      let migratedCount = 0;
      const updates = {};
      
      for (const product of productList) {
        if (product.productCode && !product.hierarchicalCategory) {
          // Use existing category data to determine hierarchy
          const categoryData = product.category || {};
          const { findMatchingHierarchy, generateHierarchicalKey } = require('../../config/categoryHierarchy');
          
          const hierarchy = findMatchingHierarchy(categoryData);
          const hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
          
          const productRef = `productdeals/${product.productCode}`;
          updates[productRef] = {
            hierarchicalCategory: {
              mainCategory: hierarchy.mainCategory,
              subcategory: hierarchy.subcategory,
              style: hierarchy.style,
              hierarchicalKey: hierarchicalKey
            }
          };
          
          migratedCount++;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await this.productsRef.update(updates);
      }
      
      logger.info('Migration completed', { migratedCount });
      return { migratedCount };
    } catch (error) {
      logger.error('Failed to migrate to hierarchical categories', { error: error.message });
      throw error;
    }
  }
}

module.exports = { CategoryHierarchyDB };

