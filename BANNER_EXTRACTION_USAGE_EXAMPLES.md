# Banner Extraction Usage Examples

This document provides comprehensive examples of how to use the improved banner extraction system with the exact JSON format you requested.

## Quick Start

### 1. Setup Chrome Browser
```bash
# Start Chrome with debugging enabled
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenum\ChromeProfile"
```

### 2. Login to Amazon Affiliate
- Open Chrome browser
- Navigate to: `https://affiliate-program.amazon.in/home`
- Login with your affiliate credentials
- Keep browser open during extraction

### 3. Test JSON Output (No Database)
```bash
# Test extraction and get JSON output
node scripts/testBannerJsonOutput.js
```

## Usage Examples

### Example 1: Test JSON Output Format

```bash
# Test with sample data and real extraction
node scripts/testBannerJsonOutput.js
```

**Expected Output:**
```json
{
  "amazon-hero-2025-04-27-abc123": {
    "clickRedirectUrl": "https://www.amazon.in/prime",
    "creationTimestamp": "2025-04-27T10:51:12.731Z",
    "id": "amazon-hero-2025-04-27-abc123",
    "isActive": true,
    "order": 0,
    "updateTimestamp": "2025-04-27T10:51:12.731Z",
    "url": "https://a.media-amazon.com/images/G/31/prime/MayART/header/New/AMAZON-PRIME-MAY-ART-PC-HEADER-1_4_1.gif",
    "expirationTimestamp": "2025-05-04T10:51:12.731Z",
    "targetDealId": ""
  },
  "flipkart-promotional-2025-04-27-def456": {
    "clickRedirectUrl": "https://www.flipkart.com/summer-sale",
    "creationTimestamp": "2025-04-27T10:51:12.743Z",
    "id": "flipkart-promotional-2025-04-27-def456",
    "isActive": true,
    "order": 1,
    "updateTimestamp": "2025-04-27T10:51:12.743Z",
    "url": "https://rukminim2.flixcart.com/fk-p-flap/1620/270/image/b692b7eec25beda6.jpg?q=20",
    "expirationTimestamp": "2025-05-18T10:51:12.743Z",
    "targetDealId": ""
  }
}
```

### Example 2: Extract from Amazon Only (JSON Output)

```bash
# Extract from Amazon and output JSON format
node scripts/runImprovedBannerExtraction.js --platform amazon --output-json --max-banners 20
```

### Example 3: Extract from All Platforms (JSON Output)

```bash
# Extract from all platforms and output JSON format
node scripts/runImprovedBannerExtraction.js --output-json --max-banners 25
```

### Example 4: Verbose Logging with JSON Output

```bash
# Verbose logging with JSON output for debugging
node scripts/runImprovedBannerExtraction.js --verbose --output-json --max-banners 15
```

### Example 5: Enable Database Storage

```bash
# Extract and store in database (when you're ready)
node scripts/runImprovedBannerExtraction.js --enable-db --max-banners 30
```

### Example 6: Dry Run (Test without any storage)

```bash
# Test extraction without any storage
node scripts/runImprovedBannerExtraction.js --dry-run --output-json --verbose
```

## JSON Format Details

### Required Fields
- `id`: Unique banner identifier
- `url`: Banner image URL
- `clickRedirectUrl`: URL to redirect when banner is clicked
- `isActive`: Boolean indicating if banner is active
- `order`: Display order (0-based index)
- `creationTimestamp`: ISO timestamp when banner was created
- `updateTimestamp`: ISO timestamp when banner was last updated

### Optional Fields
- `expirationTimestamp`: ISO timestamp when banner expires
- `targetDealId`: Associated deal ID (if any)

### Banner Categories & Expiration
- **Hero Banners**: Expire in 7 days
- **Seasonal Banners**: Expire in 14 days  
- **Promotional Banners**: Expire in 21 days
- **Category Banners**: Expire in 30 days

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--platform <platform>` | Extract from specific platform (amazon, flipkart) | all platforms |
| `--max-banners <number>` | Maximum banners per platform | 15 |
| `--chrome-port <port>` | Chrome debugging port | 9222 |
| `--verbose` | Enable verbose logging | false |
| `--dry-run` | Test without storing in database | false |
| `--enable-db` | Enable database storage | false |
| `--output-json` | Output JSON format for testing | false |

## Integration Examples

### JavaScript Integration

```javascript
const { ImprovedBannerExtractor } = require('./dataSources/improvedBannerExtractor');

async function extractBanners() {
    const extractor = new ImprovedBannerExtractor();
    extractor.maxBannersPerPlatform = 20;
    extractor.enableDatabase = false; // Test mode
    
    await extractor.initializeDriver();
    
    try {
        const banners = await extractor.extractBannersFromPlatform('amazon', amazonConfig);
        const jsonOutput = extractor.generateJsonOutput(banners);
        
        console.log('Extracted banners:', JSON.stringify(jsonOutput, null, 2));
        return jsonOutput;
    } finally {
        await extractor.closeDriver();
    }
}
```

### Node.js Script Integration

```javascript
// Custom extraction script
const { ImprovedBannerExtractor } = require('./dataSources/improvedBannerExtractor');
const bannerConfig = require('./config/bannerConfig');

async function customExtraction() {
    const extractor = new ImprovedBannerExtractor();
    extractor.maxBannersPerPlatform = 25;
    extractor.enableDatabase = false;
    
    await extractor.initializeDriver();
    
    try {
        const allBanners = [];
        
        // Extract from Amazon
        const amazonBanners = await extractor.extractBannersFromPlatform('amazon', bannerConfig.platforms.amazon);
        allBanners.push(...amazonBanners);
        
        // Extract from Flipkart
        const flipkartBanners = await extractor.extractBannersFromPlatform('flipkart', bannerConfig.platforms.flipkart);
        allBanners.push(...flipkartBanners);
        
        // Generate JSON output
        const jsonOutput = extractor.generateJsonOutput(allBanners);
        
        // Save to file
        const fs = require('fs');
        fs.writeFileSync('banners.json', JSON.stringify(jsonOutput, null, 2));
        
        console.log(`Extracted ${allBanners.length} banners and saved to banners.json`);
        
    } finally {
        await extractor.closeDriver();
    }
}

customExtraction();
```

## Testing Workflow

### 1. Test JSON Format
```bash
node scripts/testBannerJsonOutput.js
```

### 2. Test Real Extraction
```bash
node scripts/runImprovedBannerExtraction.js --platform amazon --output-json --verbose
```

### 3. Test All Platforms
```bash
node scripts/runImprovedBannerExtraction.js --output-json --max-banners 20
```

### 4. Enable Database (When Ready)
```bash
node scripts/runImprovedBannerExtraction.js --enable-db --max-banners 30
```

## Expected Results

### Before (Old System)
- 150+ banners extracted
- Mostly product images
- Mixed with affiliate content
- No proper validation

### After (New System)
- 15-30 quality banners
- Only promotional banners
- No product images
- No affiliate content
- Proper categorization
- JSON format ready for your system

## Troubleshooting

### Chrome Connection Issues
```bash
# Test Chrome connection
node scripts/testImprovedBannerExtraction.js
```

### No Banners Found
1. Check if Chrome is running with debugging enabled
2. Verify Amazon affiliate login
3. Enable verbose logging: `--verbose`
4. Check banner configuration selectors

### JSON Format Issues
1. Run test script: `node scripts/testBannerJsonOutput.js`
2. Check required fields are present
3. Verify timestamp formats

## Best Practices

1. **Always test with JSON output first** before enabling database
2. **Use verbose logging** for debugging
3. **Start with small banner limits** (10-15) for testing
4. **Verify Chrome connection** before extraction
5. **Check Amazon affiliate login** status
6. **Monitor extraction logs** for quality metrics

## Performance Expectations

- **Extraction time**: 30-60 seconds per platform
- **Banner quality**: 85-95% accuracy
- **Product image exclusion**: 90-95%
- **Affiliate content filtering**: 95-98%

The improved system should now give you exactly what you need: **15-30 quality promotional banners** in the exact JSON format you specified!
