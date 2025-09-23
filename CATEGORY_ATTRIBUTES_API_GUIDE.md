# Category Attributes API Guide

## Overview

The system now provides separate category attributes for easy API querying. Instead of concatenating category levels into a single `categoryKey`, each level is available as a separate attribute.

## 📊 Category Attribute Structure

### **Primary Category Attributes**

| Attribute | Description | Example | API Query Usage |
|-----------|-------------|---------|-----------------|
| `categoryLevel1` | Main category (Level 1) | "Electronics" | `?categoryLevel1=Electronics` |
| `categoryLevel2` | Subcategory (Level 2) | "Gadgets" | `?categoryLevel2=Gadgets` |
| `categoryLevel3` | Style/Type (Level 3) | "Smartphones" | `?categoryLevel3=Smartphones` |

### **Alternative Naming Conventions**

| Attribute | Description | Example | API Query Usage |
|-----------|-------------|---------|-----------------|
| `productCategory` | Main category | "Electronics" | `?productCategory=Electronics` |
| `productSubcategory` | Subcategory | "Gadgets" | `?productSubcategory=Gadgets` |
| `productStyle` | Style/Type | "Smartphones" | `?productStyle=Smartphones` |
| `subcategory1` | First subcategory | "Gadgets" | `?subcategory1=Gadgets` |
| `subcategory2` | Second subcategory | "Smartphones" | `?subcategory2=Smartphones` |

### **Derived Attributes**

| Attribute | Description | Example | API Query Usage |
|-----------|-------------|---------|-----------------|
| `categoryPath` | Array of all category levels | `["Electronics", "Gadgets", "Smartphones"]` | `?categoryPath=Electronics,Gadgets,Smartphones` |
| `categoryDepth` | Number of category levels | `3` | `?categoryDepth=3` |
| `hierarchicalKey` | Concatenated key for complex queries | `"Electronics_Gadgets_Smartphones"` | `?hierarchicalKey=Electronics_Gadgets_Smartphones` |

## 🔍 API Query Examples

### **Basic Category Filtering**

```javascript
// Get all Electronics products
GET /api/products?categoryLevel1=Electronics

// Get all Gadgets (regardless of main category)
GET /api/products?categoryLevel2=Gadgets

// Get all Smartphones
GET /api/products?categoryLevel3=Smartphones
```

### **Combined Category Filtering**

```javascript
// Get Electronics > Gadgets
GET /api/products?categoryLevel1=Electronics&categoryLevel2=Gadgets

// Get Electronics > Gadgets > Smartphones
GET /api/products?categoryLevel1=Electronics&categoryLevel2=Gadgets&categoryLevel3=Smartphones
```

### **Alternative Attribute Queries**

```javascript
// Using productCategory naming
GET /api/products?productCategory=Electronics&productSubcategory=Gadgets

// Using subcategory naming
GET /api/products?subcategory1=Gadgets&subcategory2=Smartphones
```

### **Advanced Filtering**

```javascript
// Get products with specific category depth
GET /api/products?categoryDepth=3

// Get products with category path containing specific values
GET /api/products?categoryPath=Electronics,Gadgets

// Get products with hierarchical key pattern
GET /api/products?hierarchicalKey=Electronics_Gadgets_*
```

## 📋 Database Schema

### **Product Document Structure**

```json
{
  "productCode": "B0DB5ZFK4Y",
  "title": "Fastrack Smartwatch",
  "brand": "Fastrack",
  "price": "₹2,995",
  
  // Primary category attributes
  "categoryLevel1": "Electronics",
  "categoryLevel2": "Wearables", 
  "categoryLevel3": "Smartwatches",
  
  // Alternative naming
  "productCategory": "Electronics",
  "productSubcategory": "Wearables",
  "productStyle": "Smartwatches",
  "subcategory1": "Wearables",
  "subcategory2": "Smartwatches",
  
  // Derived attributes
  "categoryPath": ["Electronics", "Wearables", "Smartwatches"],
  "categoryDepth": 3,
  "hierarchicalKey": "Electronics_Wearables_Smartwatches",
  
  // Full hierarchical object (for complex operations)
  "hierarchicalCategory": {
    "mainCategory": "Electronics",
    "subcategory": "Wearables", 
    "style": "Smartwatches",
    "hierarchicalKey": "Electronics_Wearables_Smartwatches",
    "confidence": 85,
    "source": "dynamic",
    "platform": "amazon",
    "extractionMethod": "dynamic",
    "extractionTimestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## 🚀 Implementation Benefits

### **1. Flexible API Queries**
- Query by any category level independently
- Combine multiple category levels for precise filtering
- Support multiple naming conventions for different use cases

### **2. Easy Integration**
- No need to parse concatenated strings
- Direct attribute access for frontend applications
- Support for both simple and complex queries

### **3. Backward Compatibility**
- Maintains existing `hierarchicalCategory` object
- Keeps `categoryKey` for legacy systems
- Gradual migration path for existing APIs

## 🔧 Configuration Options

### **Category Level Mapping**

The system automatically maps category levels based on the extraction method:

```javascript
// Dynamic extraction result
{
  "mainCategory": "Electronics",    // → categoryLevel1, productCategory
  "subcategory": "Gadgets",        // → categoryLevel2, productSubcategory, subcategory1
  "style": "Smartphones"           // → categoryLevel3, productStyle, subcategory2
}
```

### **Manual Fallback Mapping**

When dynamic extraction fails, the system uses manual mappings:

```javascript
// Manual mapping for Amazon deals
{
  "amazon": {
    "deals": { 
      "mainCategory": "Electronics", 
      "subcategory": "Deals", 
      "style": "Special Offers" 
    }
  }
}
```

## 📈 Query Performance

### **Indexing Recommendations**

For optimal query performance, create indexes on frequently queried attributes:

```javascript
// MongoDB indexes
db.products.createIndex({ "categoryLevel1": 1 })
db.products.createIndex({ "categoryLevel2": 1 })
db.products.createIndex({ "categoryLevel3": 1 })
db.products.createIndex({ "categoryLevel1": 1, "categoryLevel2": 1 })
db.products.createIndex({ "categoryLevel1": 1, "categoryLevel2": 1, "categoryLevel3": 1 })
db.products.createIndex({ "hierarchicalKey": 1 })
```

### **Query Optimization**

```javascript
// Efficient: Uses index
db.products.find({ "categoryLevel1": "Electronics" })

// Efficient: Uses compound index
db.products.find({ 
  "categoryLevel1": "Electronics", 
  "categoryLevel2": "Gadgets" 
})

// Less efficient: Avoid regex on hierarchicalKey
db.products.find({ "hierarchicalKey": /^Electronics_Gadgets_/ })
```

## 🎯 Use Cases

### **1. E-commerce Filtering**
```javascript
// Filter products by main category
GET /api/products?categoryLevel1=Electronics

// Filter by subcategory within main category
GET /api/products?categoryLevel1=Electronics&categoryLevel2=Gadgets

// Filter by specific product type
GET /api/products?categoryLevel3=Smartphones
```

### **2. Analytics and Reporting**
```javascript
// Count products by category level
GET /api/analytics/category-stats?groupBy=categoryLevel1

// Get category distribution
GET /api/analytics/category-distribution?level=categoryLevel2
```

### **3. Search and Discovery**
```javascript
// Search within specific category
GET /api/search?q=smartphone&categoryLevel1=Electronics

// Find related products by subcategory
GET /api/products/related?categoryLevel2=Gadgets&exclude=currentProductId
```

## 🔄 Migration Guide

### **From Old System**

If you're migrating from a system that used only `categoryKey`:

```javascript
// Old way
const products = await db.products.find({ 
  "categoryKey": "amazon_electronics_gadgets" 
});

// New way - more flexible
const products = await db.products.find({ 
  "categoryLevel1": "Electronics",
  "categoryLevel2": "Gadgets"
});
```

### **Gradual Migration**

1. **Phase 1**: Add new attributes alongside existing ones
2. **Phase 2**: Update API endpoints to use new attributes
3. **Phase 3**: Remove old `categoryKey` dependency
4. **Phase 4**: Optimize indexes for new attributes

## 📝 Best Practices

### **1. Consistent Naming**
- Use `categoryLevel1`, `categoryLevel2`, `categoryLevel3` for new APIs
- Keep `productCategory`, `productSubcategory`, `productStyle` for business logic
- Use `subcategory1`, `subcategory2` for simple queries

### **2. Query Optimization**
- Always filter by `categoryLevel1` first (most selective)
- Use compound indexes for multi-level queries
- Avoid regex queries on `hierarchicalKey` when possible

### **3. Data Validation**
- Ensure all category levels are populated
- Validate category depth consistency
- Monitor extraction confidence scores

This new structure provides maximum flexibility for API queries while maintaining backward compatibility and performance.
