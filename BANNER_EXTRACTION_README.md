# Banner Extraction System

## Overview

The Banner Extraction System automatically extracts promotional banners from multiple e-commerce platforms (Amazon, Flipkart, Myntra, Ajio) and stores them in Firebase for use in your application. The system includes intelligent validation to filter out affiliate-specific content and runs on a scheduled basis.

## Features

### ✅ **Multi-Platform Support**
- **Amazon**: Extracts banners from homepage, deals page, and affiliate program
- **Flipkart**: Extracts banners from homepage and offers page
- **Myntra**: Extracts banners from homepage and sale page
- **Ajio**: Extracts banners from homepage and sale page

### ✅ **Smart Validation**
- **URL Validation**: Ensures banner images are from allowed domains
- **Content Validation**: Filters out affiliate-specific content (commission rates, fees)
- **Image Validation**: Validates image URLs and dimensions (configurable)
- **Keyword Filtering**: Excludes banners with affiliate keywords

### ✅ **Automated Scheduling**
- **Hourly Extraction**: Runs every hour automatically
- **Configurable Intervals**: Easy to modify extraction frequency
- **Background Processing**: Non-blocking operation

### ✅ **Firebase Integration**
- **Dedicated Banner Database**: Separate `banners` node in Firebase
- **CRUD Operations**: Full create, read, update, delete functionality
- **Active/Inactive Management**: Automatic deactivation of old banners
- **Platform Filtering**: Query banners by platform

## Configuration

### Banner Configuration (`config/bannerConfig.js`)

```javascript
module.exports = {
  global: {
    validateImages: true,           // Enable/disable image validation
    maxBannersPerPlatform: 20,     // Max banners per platform
    extractionInterval: 3600000,    // 1 hour in milliseconds
    affiliateKeywords: [            // Keywords to filter out
      'commission', 'fee', 'affiliate', 'associate'
    ]
  },
  platforms: {
    amazon: {
      name: 'Amazon',
      baseUrl: 'https://www.amazon.in',
      bannerUrls: [                 // URLs to extract from
        'https://www.amazon.in',
        'https://www.amazon.in/deals'
      ],
      selectors: {                  // CSS selectors for extraction
        carousel: 'div.a-carousel-card',
        bannerLink: 'a[href*="/"]',
        bannerImage: 'img[src*="media-amazon.com"]'
      },
      validation: {                 // Validation rules
        minImageWidth: 200,
        minImageHeight: 100,
        allowedDomains: ['media-amazon.com'],
        excludedKeywords: ['associate', 'commission']
      }
    }
    // ... other platforms
  }
};
```

## Usage

### 1. **Manual Extraction**
```javascript
const { extractBanners } = require('./dataSources/bannerExtractor');

// Run banner extraction manually
const result = await extractBanners();
console.log(`Extracted: ${result.extracted}, Stored: ${result.stored}`);
```

### 2. **Scheduled Extraction**
```javascript
const { bannerScheduler } = require('./scheduler/bannerScheduler');

// Start the scheduler (runs every hour)
await bannerScheduler.start();

// Check scheduler status
const status = bannerScheduler.getStatus();
console.log('Scheduler running:', status.isRunning);
```

### 3. **Database Operations**
```javascript
const { bannerDB } = require('./database/firebaseDB/bannerDB');

// Store a banner
const banner = {
  id: 'amazon-summer-banner',
  url: 'https://example.com/banner.jpg',
  clickRedirectUrl: 'https://amazon.in/deals',
  isActive: true,
  order: 0,
  platform: 'amazon'
};
await bannerDB.storeBanner(banner);

// Get active banners
const activeBanners = await bannerDB.getActiveBanners();

// Get banners by platform
const amazonBanners = await bannerDB.getBannersByPlatform('amazon');
```

### 4. **Running with Main Application**
```bash
# Set type to "banners" in constants.js or run with:
node index.js --type=banners
```

## Banner Data Format

```json
{
  "amazon-summer-banner": {
    "id": "amazon-summer-banner",
    "url": "https://m.media-amazon.com/images/G/31/banner.jpg",
    "clickRedirectUrl": "https://www.amazon.in/deals",
    "isActive": true,
    "order": 0,
    "creationTimestamp": "2025-04-27T10:51:12.731Z",
    "updateTimestamp": "2025-04-27T10:51:12.731Z",
    "platform": "amazon",
    "title": "Summer Sale",
    "description": "Up to 60% off on summer collection"
  }
}
```

## Validation Logic

### **URL Validation**
- Checks if image URL is from allowed domains
- Validates URL format and accessibility
- Filters out non-banner images

### **Content Validation**
- Filters out affiliate-specific keywords:
  - `commission`, `fee`, `affiliate`, `associate`
  - `earn`, `revenue`, `partner`, `referral`
- Detects percentage patterns: `9% commission`, `10% fee`
- Excludes banners with affiliate program content

### **Image Validation**
- Validates image URL format
- Checks minimum dimensions (configurable)
- Ensures images are accessible

## File Structure

```
├── config/
│   └── bannerConfig.js          # Banner extraction configuration
├── dataSources/
│   └── bannerExtractor.js       # Main extraction logic
├── database/firebaseDB/
│   └── bannerDB.js              # Firebase banner operations
├── scheduler/
│   └── bannerScheduler.js       # Scheduled extraction
├── utils/
│   └── commonUtils.js           # Validation functions
└── testBannerExtraction.js      # Test script
```

## Testing

### **Run Test Script**
```bash
node testBannerExtraction.js
```

### **Test Individual Components**
```javascript
// Test banner validation
const { validateBannerContent } = require('./utils/commonUtils');
const result = validateBannerContent('Summer Sale', null, ['commission']);
console.log(result); // { isValid: true, value: 'Summer Sale' }

// Test banner database
const { bannerDB } = require('./database/firebaseDB/bannerDB');
const banners = await bannerDB.getAllBanners();
console.log('Total banners:', Object.keys(banners.data).length);
```

## Configuration Options

### **Global Settings**
- `validateImages`: Enable/disable image validation
- `maxBannersPerPlatform`: Maximum banners to extract per platform
- `extractionInterval`: How often to run extraction (in milliseconds)
- `affiliateKeywords`: Keywords to filter out from banner content

### **Platform Settings**
- `bannerUrls`: List of URLs to extract banners from
- `selectors`: CSS selectors for finding banner elements
- `validation`: Platform-specific validation rules

### **Validation Rules**
- `minImageWidth/Height`: Minimum image dimensions
- `allowedDomains`: Allowed image domains
- `excludedKeywords`: Keywords that disqualify a banner

## Error Handling

The system includes comprehensive error handling:
- **Driver Errors**: Automatic retry and graceful degradation
- **Network Errors**: Timeout handling and fallback mechanisms
- **Validation Errors**: Detailed logging of why banners are rejected
- **Database Errors**: Transaction rollback and error reporting

## Monitoring

### **Logging**
All operations are logged with structured data:
```javascript
logger.info('Banner extracted successfully', {
  platform: 'amazon',
  bannerId: 'amazon-summer-banner',
  url: 'https://example.com/banner.jpg'
});
```

### **Metrics**
Track extraction performance:
- Banners extracted per platform
- Validation success/failure rates
- Database operation success rates
- Scheduler run times

## Troubleshooting

### **Common Issues**

1. **No Banners Extracted**
   - Check if websites are accessible
   - Verify CSS selectors are still valid
   - Check validation rules aren't too strict

2. **Scheduler Not Running**
   - Verify `bannerScheduler.start()` is called
   - Check interval configuration
   - Review error logs

3. **Database Connection Issues**
   - Verify Firebase configuration
   - Check service account permissions
   - Review network connectivity

### **Debug Mode**
Enable debug logging to see detailed extraction process:
```javascript
// In logger configuration
logger.setLevel('debug');
```

## Future Enhancements

- **More Platforms**: Add support for additional e-commerce sites
- **Advanced Validation**: AI-powered content analysis
- **Image Processing**: Automatic banner optimization
- **Analytics Dashboard**: Real-time extraction metrics
- **Webhook Integration**: Notify external systems of new banners

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify configuration settings
3. Test individual components
4. Review validation rules

The banner extraction system is designed to be robust, configurable, and maintainable for long-term use. 