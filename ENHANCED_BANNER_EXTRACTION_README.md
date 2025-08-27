# Enhanced Banner Extraction System

## Overview

The Enhanced Banner Extraction System is designed to extract high-quality promotional banners from multiple e-commerce platforms while filtering out affiliate-specific content and product images. The system creates a new "test-banners" node in Firebase DB and uses advanced validation to ensure only relevant banners are stored.

## Key Features

### ✅ **Smart Banner Validation**
- **Content Analysis**: Identifies promotional banners vs. product images
- **Affiliate Filtering**: Excludes content with commission rates, fees, etc.
- **Context Awareness**: Analyzes element context for better classification
- **Scoring System**: Uses validation scores to categorize banners

### ✅ **Chrome Browser Integration**
- **Port 9222 Connection**: Connects to existing Chrome browser instance
- **No New Browser**: Uses your existing logged-in Chrome session
- **Amazon Affiliate Support**: Handles affiliate program authentication

### ✅ **Quality Control**
- **5-15 Banners per Platform**: Limits extraction to prevent overwhelming
- **Category Classification**: Hero, Promotional, Category, Low-quality
- **Active/Inactive Management**: Automatically manages banner status

### ✅ **Firebase Integration**
- **New "test-banners" Node**: Separate from existing banners
- **Rich Metadata**: Stores platform, source URL, validation details
- **CRUD Operations**: Full database management capabilities

## Banner Categories

### 🏆 **Hero Banners** (Score: 5+)
- Main promotional banners
- High visibility, large size
- Festival sales, major events

### 🎯 **Promotional Banners** (Score: 3-4)
- Sale offers, discounts
- Seasonal promotions
- Category-specific deals

### 📱 **Category Banners** (Score: 1-2)
- Product category promotions
- Brand-specific offers
- General promotional content

### ⚠️ **Low-Quality** (Score: <2)
- Automatically marked inactive
- Poor validation scores
- May be product images

## Validation Logic

### **Promotional Content Detection**
```javascript
const promotionalKeywords = [
    'sale', 'offer', 'deal', 'discount', 'save', 'off',
    'festival', 'celebration', 'event', 'special',
    'up to', 'starting at', 'flash sale', 'trending'
];
```

### **Affiliate Content Filtering**
```javascript
const affiliateKeywords = [
    'commission', 'fee', 'affiliate', 'associate',
    'earn', 'revenue', 'partner', 'referral'
];
```

### **Product Image Exclusion**
```javascript
const productKeywords = [
    'product', 'item', 'add to cart', 'buy now',
    'price', 'mrp', 'size', 'color', 'brand'
];
```

## File Structure

```
├── database/firebaseDB/
│   ├── testBannerDB.js              # New Firebase DB for test banners
│   └── firebaseUpdate.js            # Existing Firebase operations
├── dataSources/
│   └── enhancedBannerExtractor.js   # Enhanced banner extraction logic
├── utils/
│   └── enhancedBannerUtils.js       # Advanced validation utilities
├── scripts/
│   └── testEnhancedBannerExtraction.js  # Test and demo scripts
└── sample_banner_output.json        # Sample output format
```

## Usage

### 1. **Prerequisites**
- Chrome browser running on port 9222
- Firebase credentials configured
- Node.js and npm installed

### 2. **Start Chrome Browser**
```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenum\ChromeProfile"
```

### 3. **Test Amazon Affiliate Extraction**
```bash
node scripts/testEnhancedBannerExtraction.js amazon
```

### 4. **Test All Platforms**
```bash
node scripts/testEnhancedBannerExtraction.js all
```

### 5. **View Banner Statistics**
```bash
node scripts/testEnhancedBannerExtraction.js stats
```

### 6. **Clear Test Banners**
```bash
node scripts/testEnhancedBannerExtraction.js clear
```

## Sample Output Format

```json
{
  "amazon-banner-abc123-0": {
    "id": "amazon-banner-abc123-0",
    "url": "https://m.media-amazon.com/images/G/31/banner.jpg",
    "clickRedirectUrl": "https://www.amazon.in/deals",
    "altText": "Great Freedom Festival | Up to 60% off",
    "title": "Great Freedom Festival",
    "platform": "amazon",
    "sourceUrl": "https://affiliate-program.amazon.in/home",
    "category": "promotional",
    "validationScore": 5,
    "validationReasons": [
      "Identified as promotional banner",
      "Has promotional image pattern",
      "Has banner context"
    ],
    "isActive": true,
    "order": 0,
    "creationTimestamp": "2025-01-27T10:51:12.731Z",
    "updateTimestamp": "2025-01-27T10:51:12.731Z",
    "metadata": {
      "elementType": "li",
      "elementClasses": "a-carousel-card",
      "elementId": "",
      "parentContext": "li.a-carousel-card"
    }
  }
}
```

## Configuration

### **Banner Configuration** (`config/bannerConfig.js`)
```javascript
module.exports = {
  platforms: {
    amazon: {
      name: 'Amazon',
      baseUrl: 'https://www.amazon.in',
      affiliateUrl: 'https://affiliate-program.amazon.in/home',
      bannerUrls: [
        'https://www.amazon.in',
        'https://www.amazon.in/deals',
        'https://affiliate-program.amazon.in/home'
      ],
      selectors: {
        carousel: 'li.a-carousel-card',
        bannerLink: 'a[href*="/"]',
        bannerImage: 'img[src*="media-amazon.com"]'
      },
      validation: {
        minImageWidth: 200,
        minImageHeight: 100,
        allowedDomains: ['media-amazon.com'],
        excludedKeywords: ['associate', 'commission']
      }
    }
  }
};
```

## Validation Scoring

### **Score Calculation**
- **+3**: Identified as promotional banner
- **+2**: Has promotional image pattern
- **+2**: Has banner context
- **+1**: Valid banner dimensions
- **-2**: Contains product content
- **-5**: Contains affiliate content

### **Category Assignment**
- **Hero**: Score ≥ 5
- **Promotional**: Score 3-4
- **Category**: Score 1-2
- **Low-quality**: Score < 1

## Firebase Operations

### **Store Banner**
```javascript
const { testBannerDB } = require('./database/firebaseDB/testBannerDB');

const banner = {
  id: 'amazon-summer-banner',
  url: 'https://example.com/banner.jpg',
  platform: 'amazon',
  category: 'promotional',
  isActive: true
};

await testBannerDB.storeTestBanner(banner);
```

### **Get Banners by Platform**
```javascript
const amazonBanners = await testBannerDB.getTestBannersByPlatform('amazon');
```

### **Get Active Banners**
```javascript
const activeBanners = await testBannerDB.getActiveTestBanners();
```

## Troubleshooting

### **Chrome Connection Issues**
- Ensure Chrome is running on port 9222
- Check if Chrome profile path is correct
- Verify no other Selenium instances are running

### **Validation Issues**
- Check banner configuration in `bannerConfig.js`
- Review validation keywords and patterns
- Adjust scoring thresholds if needed

### **Firebase Issues**
- Verify Firebase credentials
- Check database rules and permissions
- Ensure service account has write access

## Performance Optimization

### **Extraction Limits**
- **Per URL**: Maximum 8 banners
- **Per Platform**: Maximum 15 banners
- **Total**: Typically 5-15 quality banners per platform

### **Memory Management**
- Automatic driver cleanup
- Efficient element processing
- Background Firebase operations

## Future Enhancements

### **Planned Features**
- **Image Analysis**: AI-powered banner detection
- **Real-time Updates**: Live banner monitoring
- **Multi-language Support**: International platforms
- **Advanced Filtering**: Custom validation rules

### **Platform Expansion**
- **Social Media**: Facebook, Instagram ads
- **News Sites**: Promotional content
- **Blog Platforms**: Affiliate banners

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review validation scores and reasons
3. Test with sample URLs first
4. Verify Chrome browser connectivity

## License

This system is part of the DealsOptimised project and follows the same licensing terms.
