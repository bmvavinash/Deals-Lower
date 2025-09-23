# Hierarchical Category System

This document explains the hierarchical category system implemented for better product categorization and organization.

## Overview

The hierarchical category system provides a 3-level categorization structure:

1. **Main Category** (Level 1): Broad categories like "Electronics", "Fashion", "Home"
2. **Subcategory** (Level 2): Specific product types like "Phones", "Headsets", "Laptops"
3. **Product Style** (Level 3): Detailed variants like "Earbuds", "Neckbands", "Wireless", "Wired"

## Example Hierarchy

```
Electronics
├── Phones
│   ├── Smartphones
│   ├── Feature Phones
│   └── Refurbished
├── Headsets & Audio
│   ├── Earbuds
│   ├── Neckbands
│   ├── Wireless
│   ├── Wired
│   ├── Bluetooth
│   └── Gaming Headsets
└── Laptops & Computers
    ├── Gaming Laptops
    ├── Business Laptops
    └── Ultrabooks
```

## Files Structure

### Core Configuration
- `config/categoryHierarchy.js` - Main hierarchy definitions and matching logic
- `database/firebaseDB/categoryHierarchyDB.js` - Database operations for hierarchical categories
- `utils/categoryHierarchyUtils.js` - Utility functions for category analysis and management

### Updated Components
- `dataSources/batchProductExtractor.js` - Updated to populate hierarchical categories
- `database/firebaseDB/productDealsDB.js` - Updated schema to include hierarchical fields
- `scripts/bulkUpdateAllPlatforms.js` - Enhanced with hierarchical category support

### Example Scripts
- `scripts/categoryHierarchyExample.js` - Comprehensive examples and demonstrations

## Database Schema

### Product Schema Updates

Each product now includes a `hierarchicalCategory` field:

```javascript
{
  // ... existing product fields ...
  hierarchicalCategory: {
    mainCategory: "electronics",        // Level 1
    subcategory: "headsets",           // Level 2
    style: "earbuds",                  // Level 3
    hierarchicalKey: "electronics_headsets_earbuds"  // Combined key
  },
  // Legacy category fields for backward compatibility
  category: {
    c1: "Electronics",
    c2: "Audio & Video", 
    c3: "Headphones & Earbuds",
    c4: "Wireless Headphones",
    mainCategory: "Electronics"
  }
}
```

### Category Hierarchy Database

The system maintains a separate `categoryHierarchy` collection in Firebase:

```javascript
{
  "electronics": {
    "level": 1,
    "key": "electronics",
    "name": "Electronics",
    "parent": null,
    "children": ["electronics_phones", "electronics_headsets", ...]
  },
  "electronics_headsets": {
    "level": 2,
    "key": "headsets", 
    "name": "Headsets & Audio",
    "parent": "electronics",
    "children": ["electronics_headsets_earbuds", ...]
  }
}
```

## Usage

### 1. Initialize the System

```bash
# Initialize category hierarchy in database
node scripts/categoryHierarchyExample.js init

# Migrate existing products to hierarchical categories
node scripts/categoryHierarchyExample.js migrate
```

### 2. Run Bulk Updates with Hierarchical Categories

```bash
# Run bulk update for specific platform and category
node scripts/bulkUpdateAllPlatforms.js bulk website amazon electronics

# Run bulk update for all platforms
node scripts/bulkUpdateAllPlatforms.js bulk website

# Get category statistics
node scripts/bulkUpdateAllPlatforms.js stats
```

### 3. Search Products by Hierarchy

```bash
# Search by main category
node scripts/categoryHierarchyExample.js search electronics

# Search by subcategory
node scripts/categoryHierarchyExample.js search electronics headsets

# Search by specific style
node scripts/categoryHierarchyExample.js search electronics headsets earbuds
```

### 4. Analyze and Report

```bash
# Analyze product categories
node scripts/categoryHierarchyExample.js analyze

# Generate hierarchy report
node scripts/categoryHierarchyExample.js report

# Get improvement suggestions
node scripts/categoryHierarchyExample.js suggest
```

## API Reference

### Category Hierarchy Configuration

#### `findMatchingHierarchy(categoryData)`
Finds the best matching hierarchy from extracted category data.

```javascript
const hierarchy = findMatchingHierarchy({
  mainCategory: "Electronics",
  c2: "Audio & Video",
  c3: "Headphones"
});
// Returns: { mainCategory: "electronics", subcategory: "headsets", style: "" }
```

#### `generateHierarchicalKey(mainCategory, subcategory, style)`
Generates a hierarchical key from category components.

```javascript
const key = generateHierarchicalKey("electronics", "headsets", "earbuds");
// Returns: "electronics_headsets_earbuds"
```

### Database Operations

#### `CategoryHierarchyDB`

```javascript
const categoryHierarchyDB = new CategoryHierarchyDB();

// Get products by hierarchy
const products = await categoryHierarchyDB.getProductsByHierarchy(
  'electronics', 'headsets', 'earbuds', 100
);

// Search products
const results = await categoryHierarchyDB.searchProducts({
  mainCategory: 'electronics',
  subcategory: 'headsets',
  limit: 50
});

// Get statistics
const stats = await categoryHierarchyDB.getCategoryStats();
```

### Utility Functions

#### `analyzeProductCategory(product)`
Analyzes a product's category data and provides suggestions.

```javascript
const analysis = analyzeProductCategory(product);
console.log(analysis.confidence); // 0-100
console.log(analysis.suggestions); // Array of suggestions
console.log(analysis.issues); // Array of issues
```

#### `batchAnalyzeProducts(products)`
Analyzes multiple products and provides batch statistics.

```javascript
const analysis = batchAnalyzeProducts(products);
console.log(analysis.confidenceDistribution);
console.log(analysis.issues);
console.log(analysis.suggestions);
```

## Configuration

### Adding New Categories

To add new categories, edit `config/categoryHierarchy.js`:

```javascript
const CATEGORY_HIERARCHY = {
  // ... existing categories ...
  new_category: {
    name: "New Category",
    subcategories: {
      subcategory1: {
        name: "Subcategory 1",
        styles: {
          style1: "Style 1",
          style2: "Style 2"
        }
      }
    }
  }
};
```

### Customizing Matching Logic

The system uses fuzzy matching to map extracted category data to the hierarchy. You can customize the matching logic in the `findMainCategoryKey`, `findSubcategoryKey`, and `findStyleKey` functions.

## Benefits

### 1. Better Product Organization
- Clear 3-level hierarchy structure
- Consistent categorization across platforms
- Easy navigation and filtering

### 2. Improved Search and Discovery
- Search by main category, subcategory, or style
- Hierarchical filtering capabilities
- Better product recommendations

### 3. Enhanced Analytics
- Category-level statistics and reporting
- Product distribution analysis
- Category performance metrics

### 4. Scalable Architecture
- Easy to add new categories and subcategories
- Flexible matching system
- Backward compatibility with existing data

## Migration Guide

### For Existing Products

1. **Initialize the hierarchy:**
   ```bash
   node scripts/categoryHierarchyExample.js init
   ```

2. **Migrate existing products:**
   ```bash
   node scripts/categoryHierarchyExample.js migrate
   ```

3. **Verify migration:**
   ```bash
   node scripts/categoryHierarchyExample.js stats
   ```

### For New Products

The system automatically populates hierarchical categories during product extraction. No additional steps are required.

## Troubleshooting

### Common Issues

1. **Low category coverage**: Run the migration script to populate hierarchical categories for existing products.

2. **Incorrect category matching**: Check the fuzzy matching logic in `config/categoryHierarchy.js` and add new patterns as needed.

3. **Missing categories**: Add new categories to the `CATEGORY_HIERARCHY` configuration.

### Debugging

Use the analysis tools to identify issues:

```bash
# Analyze product categories
node scripts/categoryHierarchyExample.js analyze

# Get detailed suggestions
node scripts/categoryHierarchyExample.js suggest
```

## Performance Considerations

- The system uses Firebase queries optimized for hierarchical data
- Category matching is performed during product extraction
- Statistics are calculated on-demand to avoid performance impact
- Consider implementing caching for frequently accessed category data

## Future Enhancements

1. **Machine Learning Integration**: Use ML models for better category prediction
2. **Dynamic Categories**: Allow categories to be added/modified through admin interface
3. **Category Validation**: Real-time validation of category assignments
4. **Advanced Analytics**: More sophisticated category performance metrics
5. **Multi-language Support**: Support for multiple languages in category names

## Support

For questions or issues related to the hierarchical category system:

1. Check the example scripts in `scripts/categoryHierarchyExample.js`
2. Review the configuration in `config/categoryHierarchy.js`
3. Use the analysis tools to identify specific issues
4. Check the logs for detailed error information

