# Missing Details Tracking System

## Overview

The Missing Details Tracking System automatically identifies and tracks products that have missing critical information (title, brand, price, etc.) during bulk updates. It then prioritizes these products during idle time enrichment to ensure complete product data.

## 🎯 Features

### ✅ **Automatic Detection**
- Tracks missing details during bulk product extraction
- Identifies critical missing fields: `title`, `brand`, `price`, `originalPrice`, `discountPercentage`
- Records source URL and product details for each missing item

### ✅ **Intelligent Prioritization**
- Idle time processor prioritizes products with missing details
- Sorts by detection frequency (most frequently missing first)
- Automatically removes products from tracking when details are fixed

### ✅ **Comprehensive Reporting**
- Detailed reports with missing field statistics
- Product-by-product breakdown with source URLs
- Category chain information for better context

### ✅ **Persistent Storage**
- Stores tracking data in `logs/missingDetails.json`
- Maintains detection history and frequency counts
- Automatic cleanup of old entries

## 📁 File Structure

```
utils/missingDetailsTracker.js          # Core tracking system
dataSources/batchProductExtractor.js    # Modified to track missing details
services/idleProcessingService.js       # Modified to prioritize missing details
scripts/checkMissingDetails.js          # Report generation script
logs/missingDetails.json                # Persistent storage (auto-created)
logs/missingDetailsReport.json          # Generated reports (auto-created)
```

## 🚀 Usage

### 1. **Automatic Tracking**
The system automatically tracks missing details during bulk updates. No manual intervention required.

### 2. **View Missing Details Report**
```bash
# Generate and view comprehensive report
node scripts/checkMissingDetails.js report

# View summary only
node scripts/checkMissingDetails.js summary

# Clear old entries (older than 7 days)
node scripts/checkMissingDetails.js clear 7
```

### 3. **Idle Time Processing**
The idle processor automatically prioritizes products with missing details:
- Products with missing details are processed first
- Fixed fields are automatically tracked and removed from missing list
- Fallback to regular idle processing if no missing details found

## 📊 Report Format

### **Summary Statistics**
```json
{
  "totalProducts": 25,
  "productsWithMissingDetails": 25,
  "missingFields": {
    "title": 8,
    "brand": 12,
    "price": 3,
    "originalPrice": 15,
    "discountPercentage": 5
  },
  "lastUpdated": "2025-01-13T10:30:00.000Z",
  "topMissingFields": [
    { "field": "originalPrice", "count": 15 },
    { "field": "brand", "count": 12 },
    { "field": "title", "count": 8 }
  ]
}
```

### **Product Details**
```json
{
  "productCode": "B0DB5ZFK4Y",
  "productUrl": "https://www.amazon.in/...",
  "title": "Fastrack Smartwatch",
  "brand": "Fastrack",
  "price": "₹2,995",
  "originalPrice": "MISSING",
  "sourceUrl": "https://www.amazon.in/s?k=smartwatch",
  "missingFields": ["originalPrice"],
  "detectionCount": 3,
  "categoryChain": {
    "mainCategory": "Electronics",
    "subcategory": "Wearables",
    "style": "Smartwatches"
  }
}
```

## 🔧 Configuration

### **Critical Fields to Track**
The system tracks these critical fields by default:
- `title` - Product title
- `brand` - Product brand
- `price` - Current price
- `originalPrice` - Original/MRP price
- `discountPercentage` - Discount percentage

### **Customization**
You can modify the critical fields in `utils/missingDetailsTracker.js`:
```javascript
const criticalFields = ['title', 'brand', 'price', 'originalPrice', 'discountPercentage'];
```

## 📈 Integration Points

### **1. Bulk Product Extraction**
- `dataSources/batchProductExtractor.js` - Tracks missing details during normalization
- Logs missing details with source URL and product information

### **2. Idle Time Processing**
- `services/idleProcessingService.js` - Prioritizes products with missing details
- Automatically marks fields as fixed when enrichment succeeds

### **3. Category Chain Integration**
- Tracks hierarchical category information for better context
- Helps identify patterns in missing data by category

## 🎯 Benefits

### **For Development**
- **Identify Selector Issues**: Quickly find which products/URLs have missing data
- **Improve Extraction**: Focus on fixing selectors for specific products
- **Monitor Quality**: Track data quality improvements over time

### **For Operations**
- **Prioritized Enrichment**: Idle time focuses on products that need attention
- **Efficient Resource Usage**: Don't waste time on products that are already complete
- **Quality Assurance**: Ensure all products have complete information

## 📋 Example Workflow

1. **Bulk Update Runs**: System extracts products from Amazon smartwatch search
2. **Missing Details Detected**: 5 products missing `originalPrice`, 3 missing `brand`
3. **Tracking**: Products stored in `missingDetails.json` with source URL and details
4. **Idle Time**: Processor prioritizes these 8 products for enrichment
5. **Enrichment**: Missing fields are filled by visiting individual product pages
6. **Cleanup**: Fixed products removed from tracking, remaining ones stay for next cycle

## 🔍 Troubleshooting

### **No Missing Details Found**
- Check if bulk updates are running
- Verify that products are being extracted
- Check logs for extraction errors

### **Missing Details Not Being Fixed**
- Verify idle time processing is enabled
- Check if product URLs are valid
- Review enrichment logs for errors

### **Report Not Generating**
- Ensure `logs/` directory exists
- Check file permissions
- Verify JSON file is not corrupted

## 📝 Logs and Monitoring

### **Log Messages**
- `Product has missing details` - When missing details are detected
- `Product normalized with missing details` - During bulk extraction
- `Found X products with missing details to prioritize` - During idle processing
- `Successfully enriched product` - When missing details are fixed

### **File Locations**
- `logs/missingDetails.json` - Persistent tracking data
- `logs/missingDetailsReport.json` - Generated reports
- Application logs - Detailed processing information

## 🚀 Future Enhancements

- **Machine Learning**: Predict which products are likely to have missing details
- **Automated Selector Updates**: Suggest selector improvements based on missing data patterns
- **Quality Metrics**: Track data quality trends over time
- **Integration with Testing**: Automatically test selectors for products with missing details



