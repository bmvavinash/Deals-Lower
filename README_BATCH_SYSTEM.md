# Batch Product Extraction & Management System

This system provides automated extraction, storage, and management of product deals from e-commerce platforms, with hourly updates and intelligent enrichment capabilities.

## 🏗️ System Architecture

### Core Components

1. **Batch Product Extractor** (`dataSources/batchProductExtractor.js`)
   - Extracts products from search/category pages in bulk
   - Generates affiliate links for different platforms
   - Handles multiple Amazon category pages efficiently

2. **Product Deals Database** (`database/firebaseDB/productDealsDB.js`)
   - Firebase Realtime Database integration for `productdeals` node
   - Bulk upsert operations for efficient data storage
   - CRUD operations for individual product management

3. **Hourly Scheduler** (`scheduler/hourlyScheduler.js`)
   - Automated product and banner extraction every hour
   - Change detection for prices and discounts
   - Configurable timing and error handling

4. **Idle Enrichment Processor** (`dataSources/idleEnrichmentProcessor.js`)
   - Navigates to individual product pages to fill missing details
   - Processes products in batches during system idle time
   - Standardizes category extraction and data validation

5. **Scheduler Management CLI** (`scripts/manageScheduler.js`)
   - Command-line interface for system management
   - Start/stop scheduler and enrichment processes
   - Real-time status monitoring

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install node-cron
```

### 2. Run Batch Product Extraction

```bash
# Extract from default Amazon seed URLs
node scripts/runBatchProducts.js

# Extract with custom source type
node scripts/runBatchProducts.js website

# Extract with custom category and URLs
node scripts/runBatchProducts.js website electronics "https://www.amazon.in/s?k=laptops"
```

### 3. Start Hourly Scheduler

```bash
# Start automated hourly extraction
node scripts/manageScheduler.js start

# Check scheduler status
node scripts/manageScheduler.js status

# Stop scheduler
node scripts/manageScheduler.js stop
```

### 4. Run Idle Enrichment

```bash
# Start enrichment for products with missing fields
node scripts/manageScheduler.js enrich

# Enrich with custom settings
node scripts/manageScheduler.js enrich --batch-size 20 --max 50 --delay 3000

# Process all products (not just missing fields)
node scripts/manageScheduler.js enrich --all

# Check enrichment status
node scripts/manageScheduler.js enrich-status

# Stop enrichment
node scripts/manageScheduler.js enrich-stop
```

## 📊 Data Structure

### Product Object Schema

```json
{
  "id": "unique-product-id",
  "title": "Product Title",
  "brand": "Brand Name",
  "price": "₹1,999",
  "originalPrice": "₹2,999",
  "discountPercentage": "33% off",
  "rating": "4.5",
  "ratingsCount": "1,234",
  "productUrl": "https://www.amazon.in/dp/B0XXXXX",
  "productImage": "https://m.media-amazon.com/images/...",
  "stockStatus": "In Stock",
  "limitedTimeDeal": "Limited time deal",
  "coupon": "₹200 off",
  "delivery": "Free delivery",
  "asin": "B0XXXXX",
  "categoryKey": "mobiles",
  "categoryPath": "Electronics > Mobiles & Accessories > Smartphones",
  "sourceType": "website",
  "sourceUrl": "https://www.amazon.in/s?k=mobile+phones",
  "creationTimestamp": "2025-01-27T10:00:00.000Z",
  "updateTimestamp": "2025-01-27T10:00:00.000Z",
  "links": {
    "avinashbmvINR": "https://inrdeals.com/avi646476329/+productUrl"
  }
}
```

### Banner Object Schema

```json
{
  "id": "unique-banner-id",
  "url": "https://m.media-amazon.com/images/...",
  "clickRedirectUrl": "https://www.amazon.in/deals",
  "altText": "Banner description",
  "title": "Banner title",
  "platform": "amazon",
  "sourceUrl": "https://www.amazon.in",
  "category": "promotional",
  "validationScore": 8,
  "validationReasons": ["Good dimensions", "Promotional content"],
  "isActive": true,
  "order": 0,
  "creationTimestamp": "2025-01-27T10:00:00.000Z",
  "updateTimestamp": "2025-01-27T10:00:00.000Z"
}
```

## 🔧 Configuration

### Default Seed URLs

The system comes with pre-configured Amazon category URLs:

- **Homepage**: `https://www.amazon.in`
- **Deals**: `https://www.amazon.in/deals`
- **Mobile Phones**: `https://www.amazon.in/s?k=mobile+phones`
- **Electronics**: `https://www.amazon.in/gp/browse.html?node=976419031`
- **Home & Kitchen**: `https://www.amazon.in/gp/browse.html?node=976442031`
- **Computers**: `https://www.amazon.in/gp/browse.html?node=976392031`
- **Large Appliances**: `https://www.amazon.in/gp/browse.html?node=1380365031`
- **Beauty & Personal Care**: `https://www.amazon.in/gp/browse.html?node=1355016031`
- **Fashion (Men)**: `https://www.amazon.in/gp/browse.html?node=1968024031`
- **Fashion (Women)**: `https://www.amazon.in/gp/browse.html?node=1968253031`
- **Books**: `https://www.amazon.in/gp/browse.html?node=976389031`
- **Toys & Games**: `https://www.amazon.in/gp/browse.html?node=1350380031`
- **Sports & Outdoors**: `https://www.amazon.in/gp/browse.html?node=1984443031`
- **Grocery**: `https://www.amazon.in/gp/browse.html?node=4859480031`

### Custom Configuration

You can customize the system by modifying:

- **Seed URLs**: Edit `DEFAULT_SEEDS` in `scheduler/hourlyScheduler.js`
- **Extraction Selectors**: Modify `PageConfig/amazonPageConfig.js`
- **Scheduling**: Adjust cron patterns in `scheduler/hourlyScheduler.js`
- **Enrichment Settings**: Configure batch sizes and delays in CLI commands

## 📈 Performance & Monitoring

### Logging

The system uses structured logging with module-specific loggers:

```javascript
const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('moduleName');
```

### Metrics

Track system performance with built-in metrics:

- **Extraction Counts**: Products extracted per page/run
- **Storage Success**: Database operation success rates
- **Processing Times**: Time taken for extraction and enrichment
- **Error Rates**: Failed operations and their reasons

### Health Checks

Monitor system health with status commands:

```bash
# Check scheduler health
node scripts/manageScheduler.js status

# Check enrichment processor health
node scripts/manageScheduler.js enrich-status
```

## 🔄 Workflow

### 1. Batch Extraction (Every Hour)

```
Seed URLs → Page Navigation → Product Card Extraction → Bulk Database Storage
```

### 2. Change Detection

```
Existing Products → Fresh Data Comparison → Price/Discount Updates → Database Updates
```

### 3. Idle Enrichment

```
Missing Field Detection → Individual Page Navigation → Detailed Data Extraction → Field Updates
```

## 🛠️ Troubleshooting

### Common Issues

1. **No Products Extracted**
   - Check if page structure has changed
   - Verify CSS selectors in `amazonPageConfig.js`
   - Ensure page is accessible without login

2. **Scheduler Not Starting**
   - Verify `node-cron` is installed
   - Check for port conflicts
   - Review error logs

3. **Enrichment Failures**
   - Check product URLs are valid
   - Verify page selectors exist
   - Monitor for rate limiting

### Debug Commands

```bash
# Test individual page extraction
node scripts/runBatchProducts.js website "" "https://www.amazon.in/s?k=test"

# Check database connectivity
node -e "require('./database/firebaseDB/productDealsDB').getAllProductDeals().then(console.log)"

# Monitor real-time logs
tail -f logs/batch-extraction.log
```

## 🔒 Security & Best Practices

### Rate Limiting

- Built-in delays between product processing
- Configurable batch sizes to avoid overwhelming servers
- Respectful crawling practices

### Data Validation

- Input sanitization for all extracted data
- Validation of URLs and image sources
- Duplicate detection and prevention

### Error Handling

- Graceful degradation on failures
- Comprehensive error logging
- Automatic retry mechanisms

## 📚 API Reference

### BatchProductExtractor

```javascript
const { runBatch } = require('./dataSources/batchProductExtractor');

// Run batch extraction
const result = await runBatch(seedUrls, sourceType, categoryKey);
// Returns: { totalExtracted, totalStored, pages }
```

### HourlyScheduler

```javascript
const { hourlyScheduler } = require('./scheduler/hourlyScheduler');

// Start scheduler
await hourlyScheduler.start();

// Manual triggers
await hourlyScheduler.triggerProductExtraction();
await hourlyScheduler.triggerBannerExtraction();
```

### IdleEnrichmentProcessor

```javascript
const { idleEnrichmentProcessor } = require('./dataSources/idleEnrichmentProcessor');

// Start enrichment
const result = await idleEnrichmentProcessor.startProcessing({
    batchSize: 20,
    maxProducts: 100,
    onlyMissingFields: true
});
```

## 🤝 Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Firebase credentials
4. Run tests: `npm test`

### Code Style

- Use ES6+ features
- Follow existing logging patterns
- Add comprehensive error handling
- Include JSDoc comments for public methods

## 📄 License

This project is part of the DealsOptimised system. Please refer to the main project license for usage terms.

---

**Need Help?** Check the logs or run `node scripts/manageScheduler.js help` for command assistance.
