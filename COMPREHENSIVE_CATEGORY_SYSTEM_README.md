# Comprehensive Category System

## Overview

This document describes the comprehensive category system implemented across all platforms (Amazon, Flipkart, Ajio, Myntra) to ensure consistent product categorization based on the 10 main categories identified from the image.

## 10 Main Categories

1. **Electronics** - Mobile phones, laptops, audio/video, wearables, cameras
2. **Fashion** - Men's/women's/kids' clothing, shoes, accessories, bags, watches, jewelry
3. **Home & Kitchen** - Furniture, kitchen appliances, home decor, cookware
4. **Sports & Fitness** - Fitness equipment, sports gear, outdoor recreation
5. **Beauty & Personal Care** - Skincare, makeup, hair care, personal care
6. **Automotive** - Car care, car parts, car electronics, motorcycle
7. **Baby & Kids** - Baby clothing, kids clothing, toys, baby care
8. **Grocery** - Food & beverages, fresh produce, dairy, frozen foods
9. **Tools & Hardware** - Hand tools, power tools, hardware, safety equipment
10. **Music & Entertainment** - Musical instruments, audio equipment, gaming, books
11. **Pet Supplies** - Dog supplies, cat supplies, other pets, pet health

## File Structure

### Core Configuration Files

- `config/comprehensiveCategoryHierarchy.js` - Main category hierarchy with 3-level structure
- `config/flipkartCategoryConfig.js` - Flipkart-specific category URLs
- `config/ajioCategoryConfig.js` - Ajio-specific category URLs  
- `config/myntraCategoryConfig.js` - Myntra-specific category URLs

### Scheduler Files

- `scheduler/comprehensivePlatformScheduler.js` - Unified scheduler for all platforms
- `scheduler/hourlyScheduler.js` - Updated with comprehensive Amazon URLs

## Category Hierarchy Structure

Each category follows a 3-level hierarchy:

```
Main Category (Level 1)
├── Subcategory (Level 2)
│   ├── Style 1 (Level 3)
│   ├── Style 2 (Level 3)
│   └── Style N (Level 3)
└── Subcategory N (Level 2)
```

### Example: Electronics Category

```
Electronics
├── Mobile Phones
│   ├── Smartphones
│   ├── Feature Phones
│   ├── Refurbished Phones
│   └── Phone Accessories
├── Laptops & Computers
│   ├── Gaming Laptops
│   ├── Business Laptops
│   ├── Ultrabooks
│   └── Desktop Computers
└── Audio & Video
    ├── Headphones
    ├── Speakers
    ├── Earbuds
    └── Bluetooth Audio
```

## Platform-Specific Implementations

### Amazon India
- Uses node IDs for category browsing
- Includes both browse URLs and search query URLs
- Covers all 10 main categories with comprehensive subcategories

### Flipkart
- Uses category-specific URLs
- Includes search query URLs for better coverage
- Covers all 10 main categories

### Ajio
- Focuses on Fashion and Beauty categories
- Uses search-based URLs for better product discovery
- Covers Fashion and Beauty & Personal Care categories

### Myntra
- Focuses on Fashion and Beauty categories
- Uses URL-friendly category paths
- Covers Fashion and Beauty & Personal Care categories

## Usage Examples

### Get All Category URLs for a Platform

```javascript
const { comprehensivePlatformScheduler } = require('./scheduler/comprehensivePlatformScheduler');

// Get all Amazon URLs
const amazonUrls = comprehensivePlatformScheduler.getPlatformSeeds('amazon');

// Get all Flipkart URLs
const flipkartUrls = comprehensivePlatformScheduler.getPlatformSeeds('flipkart');
```

### Get Category-Specific URLs

```javascript
// Get all Electronics URLs across all platforms
const electronicsUrls = comprehensivePlatformScheduler.getCategorySeeds('electronics');

// Get Fashion URLs for Ajio only
const ajioFashionUrls = comprehensivePlatformScheduler.getCategoryUrls('ajio', 'fashion');
```

### Get Statistics

```javascript
const stats = comprehensivePlatformScheduler.getStatistics();
console.log(`Total URLs: ${stats.totalUrls}`);
console.log(`Platform stats:`, stats.platformStats);
console.log(`Category stats:`, stats.categoryStats);
```

## Category Mapping Functions

### Find Matching Hierarchy

```javascript
const { findMatchingHierarchy } = require('./config/comprehensiveCategoryHierarchy');

const categoryData = {
  mainCategory: "Electronics",
  c1: "Electronics",
  c2: "Mobile Phones", 
  c3: "Smartphones"
};

const hierarchy = findMatchingHierarchy(categoryData);
// Returns: { mainCategory: 'electronics', subcategory: 'mobile_phones', style: 'smartphones' }
```

### Generate Hierarchical Key

```javascript
const { generateHierarchicalKey } = require('./config/comprehensiveCategoryHierarchy');

const key = generateHierarchicalKey('electronics', 'mobile_phones', 'smartphones');
// Returns: 'electronics_mobile_phones_smartphones'
```

## URL Examples

### Amazon URLs
- Browse: `https://www.amazon.in/gp/browse.html?node=976419031`
- Search: `https://www.amazon.in/s?k=mobile+phones`

### Flipkart URLs
- Category: `https://www.flipkart.com/electronics/pr`
- Search: `https://www.flipkart.com/search?q=mobile+phones`

### Ajio URLs
- Category: `https://www.ajio.com/shop/men`
- Search: `https://www.ajio.com/search?text=mens+clothing`

### Myntra URLs
- Category: `https://www.myntra.com/men`
- Search: `https://www.myntra.com/mens-clothing`

## Validation

The system includes URL validation to ensure all generated URLs are valid:

```javascript
const validation = comprehensivePlatformScheduler.validateUrls();
console.log(`Valid URLs: ${validation.valid}`);
console.log(`Invalid URLs: ${validation.invalid}`);
```

## Integration with Existing System

The comprehensive category system integrates with the existing product processing pipeline:

1. **Product Extraction** - Uses category hierarchy for proper classification
2. **Telegram Bot** - Processes products with correct category assignment
3. **Batch Processing** - Uses comprehensive URLs for product discovery
4. **Database Storage** - Stores products with hierarchical category keys

## Benefits

1. **Consistency** - Uniform categorization across all platforms
2. **Completeness** - Covers all 10 main categories with detailed subcategories
3. **Scalability** - Easy to add new categories or platforms
4. **Maintainability** - Centralized configuration management
5. **Flexibility** - Platform-specific optimizations while maintaining consistency

## Future Enhancements

1. **Dynamic Category Discovery** - Automatically discover new categories from platforms
2. **Category Performance Analytics** - Track category performance across platforms
3. **AI-Powered Categorization** - Use ML for automatic product categorization
4. **Category Recommendations** - Suggest optimal categories for new products

## Maintenance

- Update category URLs when platforms change their structure
- Add new subcategories as they become available
- Monitor category performance and adjust as needed
- Keep platform-specific configurations in sync


