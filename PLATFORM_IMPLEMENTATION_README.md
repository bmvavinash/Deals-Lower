# Platform Product Extraction Implementation

This document describes the implementation of product extraction functionality for multiple e-commerce platforms: **Amazon**, **Flipkart**, **Myntra**, and **Ajio**.

## Overview

The system now uses a unified approach for all platforms, with platform-specific configurations defined in separate page configuration files. Each platform has its own selectors and data extraction logic while sharing the same core scraping engine.

## Architecture

### Core Components

1. **`pageScheduler.js`** - Main scraping engine that handles all platforms
2. **`PageConfig/`** - Directory containing platform-specific configurations
3. **`utils/commonUtils.js`** - Validation and utility functions
4. **`config/const.js`** - Platform mapping and constants

### Platform Support

| Platform | Status | Base Selector | Key Features |
|----------|--------|---------------|--------------|
| **Amazon** | ✅ Complete | `div.puis-card-container` | Full product details, multiple page types |
| **Flipkart** | ✅ Complete | `div.slAVV4` | Product details, ratings, F-Assured |
| **Myntra** | ✅ Complete | `li.product-base` | Fashion items, sizes, ratings |
| **Ajio** | ✅ Complete | `div.rilrtl-products-list__item` | Fashion items, exclusive badges |

## Implementation Details

### 1. Amazon (`amazonPageConfig.js`)

**Features:**
- Multiple page type support (search, deals, carousel, best sellers)
- Comprehensive product data extraction
- ASIN extraction and validation
- Deal badges and coupon information
- Stock status and delivery info

**Key Selectors:**
```javascript
"productUrl": { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href" }
"brand": { type: "css", selector: "h2.a-size-medium span", validate: extractBrand }
"discountedPrice": { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice }
```

### 2. Flipkart (`flipkartPageConfig.js`)

**Features:**
- Product name and pricing
- Rating and review count
- F-Assured badge detection
- Lowest price since launch badge
- Product specifications

**Key Selectors:**
```javascript
"productUrl": { type: "css", selector: "a.VJA3rP", attribute: "href" }
"productName": { type: "css", selector: "a.wjcEIp", attribute: "title" }
"discountedPrice": { type: "css", selector: "div.Nx9bqj", validate: validatePrice }
"fAssured": { type: "css", selector: "div.dVXNbG img", attribute: "src" }
```

### 3. Myntra (`myntraPageConfig.js`)

**Features:**
- Brand and product name
- Pricing with discount percentage
- Rating and review count
- Available sizes
- Offer badges ("Only Few Left!")

**Key Selectors:**
```javascript
"brand": { type: "css", selector: "h3.product-brand" }
"productUrl": { type: "css", selector: "a", attribute: "href" }
"offerBadge": { type: "css", selector: "div.xcelerator-plpXceleratorInfoTag" }
"availableSizes": { type: "css", selector: "span.product-sizeInventoryPresent" }
```

### 4. Ajio (`ajioPageConfig.js`)

**Features:**
- Brand and product name
- Pricing with offer prices
- Rating and review count
- Exclusive badges (BESTSELLER)
- Product categories

**Key Selectors:**
```javascript
"brand": { type: "css", selector: ".brand strong" }
"exclusiveBadge": { type: "css", selector: ".exclusive-new" }
"offerPrice": { type: "css", selector: ".offer-pricess-new" }
"productCategory": { type: "css", selector: "a[href*='/men/'], a[href*='/women/'], a[href*='/kids/']", attribute: "href" }
```

## Data Extraction Process

### 1. Platform Detection
The system automatically detects the platform from the URL and loads the appropriate configuration.

### 2. Page Loading
- Waits for base selector to appear
- Handles lazy loading with scroll-based content loading
- Supports pagination (up to 2 pages for memory optimization)

### 3. Product Extraction
- Iterates through product containers
- Extracts data using platform-specific selectors
- Applies validation functions where specified
- Handles both CSS and XPath selectors

### 4. Memory Management
- Garbage collection every 10-15 products
- Reduced scroll iterations and sleep times
- Memory cleanup between pages

## Usage

### Basic Usage
```javascript
const { scrapePage } = require('./pageScheduler');

const products = await scrapePage(url, driver, config, 'searchPage');
```

### Testing All Platforms
```javascript
const { testAllPlatforms } = require('./scripts/testAllPlatforms');

// Test all platforms
await testAllPlatforms();
```

## Configuration Structure

Each platform configuration follows this structure:

```javascript
module.exports = {
  searchPage: {
    baseSelector: "css-selector-for-product-container",
    selectors: {
      fieldName: {
        type: "css|attribute", // or "xpath" for special cases
        selector: "css-selector",
        attribute: "href|src", // optional
        validate: validationFunction // optional
      }
    }
  }
};
```

## Validation Functions

The system includes several validation functions in `utils/commonUtils.js`:

- `validatePrice()` - Cleans and validates price values
- `validateDiscount()` - Extracts and validates discount percentages
- `extractAsin()` - Extracts Amazon ASIN from data attributes
- `extractBrand()` - Extracts brand names from product titles

## Error Handling

- Graceful fallback for missing selectors
- Platform-specific error logging
- Memory optimization with garbage collection
- Pagination error handling

## Performance Optimizations

- Reduced sleep times (300ms instead of 800ms)
- Limited pagination (2 pages instead of 3)
- Memory cleanup every 10-15 products
- Optimized scroll distances

## Future Enhancements

1. **Additional Platforms**: Support for more e-commerce sites
2. **Dynamic Selectors**: AI-powered selector adaptation
3. **Rate Limiting**: Platform-specific rate limiting
4. **Data Enrichment**: Additional product metadata extraction
5. **Parallel Processing**: Multi-threaded scraping for better performance

## Troubleshooting

### Common Issues

1. **No Products Found**
   - Check if base selector is still valid
   - Verify page has loaded completely
   - Check for anti-bot measures

2. **Memory Issues**
   - Reduce max pages in pagination
   - Increase garbage collection frequency
   - Check for memory leaks in selectors

3. **Selector Failures**
   - Verify CSS selectors are still valid
   - Check for page structure changes
   - Update selectors in page config files

## Testing

Run the test script to verify all platforms:

```bash
node scripts/testAllPlatforms.js
```

This will test each platform and log the results for verification.

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify page configurations are up-to-date
3. Test with the provided test script
4. Review platform-specific selectors for changes
