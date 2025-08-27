# 🛠️ Banner Management Tools

This folder contains standalone tools for banner extraction, management, and cleanup operations. All tools can be run individually or integrated into your application.

## 📁 Tools Overview

### 1. `bannerExtraction.js` - Banner Extraction Tool
Extracts banners from all configured platforms (Amazon, Flipkart, etc.) and stores them in Firebase.

**Features:**
- Connect to existing Chrome instance (port 9222) or create new one
- Extract banners from multiple platforms
- Filter out product carousels
- Categorize banners (hero, promotional, seasonal, category)
- Store in Firebase with proper validation

**Usage:**
```bash
# Use existing Chrome instance (recommended for logged-in sessions)
node tools/bannerExtraction.js --use-existing-chrome

# Use new Chrome instance (headless)
node tools/bannerExtraction.js

# Short form
node tools/bannerExtraction.js -e
```

### 2. `deleteProduct.js` - Product & Banner Cleanup Tool
Deletes products from deals.json and cleans up banner.json/Firebase banners.

**Features:**
- Delete products from deals.json based on criteria
- Clean up banner.json (remove non-banners, single product banners)
- Clean up Firebase banners
- Automatic backups before deletion
- Filter by platform, discount, age, etc.

**Usage:**
```bash
# Delete all Amazon products
node tools/deleteProduct.js deals --platform=amazon

# Delete products with less than 20% discount
node tools/deleteProduct.js deals --min-discount=20

# Delete products older than 30 days
node tools/deleteProduct.js deals --older-than=30

# Clean up banner.json only
node tools/deleteProduct.js banner-json

# Clean up Firebase banners only
node tools/deleteProduct.js firebase

# Run full cleanup
node tools/deleteProduct.js full

# Run full cleanup with specific criteria
node tools/deleteProduct.js full --platform=amazon --min-discount=20 --older-than=30
```

### 3. `bannerManager.js` - Banner Management Tool
Manage banners in Firebase with various operations.

**Features:**
- List banners with filters
- Show banner statistics
- Delete banners (individual, by platform, by category)
- Deactivate banners
- Update banner order
- Get display banners
- Clean up old inactive banners

**Usage:**
```bash
# List all active banners
node tools/bannerManager.js list --active-only

# List Amazon banners only
node tools/bannerManager.js list --platform=amazon

# Show banner statistics
node tools/bannerManager.js stats

# Delete a specific banner
node tools/bannerManager.js delete --id=amazon-hero-2025-08-05-abc123

# Delete all Flipkart banners
node tools/bannerManager.js delete --platform=flipkart

# Deactivate a banner
node tools/bannerManager.js deactivate --id=amazon-hero-2025-08-05-abc123

# Update banner order
node tools/bannerManager.js order --id=amazon-hero-2025-08-05-abc123 --order=1

# Get display banners
node tools/bannerManager.js display --limit=10

# Clean up old inactive banners
node tools/bannerManager.js cleanup
```

## 🔧 Integration with Application

### 1. Banner Extraction Integration

Add to your main application to run banner extraction when server is empty:

```javascript
const { BannerExtractor } = require('./tools/bannerExtraction');

// In your main application
async function checkAndExtractBanners() {
    try {
        // Check if server has banners
        const { bannerManager } = require('./bannerManager');
        const stats = await bannerManager.getBannerStats();
        
        if (stats.status === 200 && stats.data.active === 0) {
            console.log('No active banners found, starting extraction...');
            
            const extractor = new BannerExtractor(true); // Use existing Chrome
            const result = await extractor.runBannerExtraction();
            
            if (result.success) {
                console.log(`Extracted ${result.extracted} banners`);
            }
        }
    } catch (error) {
        console.error('Banner extraction failed:', error.message);
    }
}

// Run every hour or when needed
setInterval(checkAndExtractBanners, 60 * 60 * 1000);
```

### 2. Automated Cleanup Integration

Add to your application for regular cleanup:

```javascript
const { ProductDeleter } = require('./tools/deleteProduct');

// In your main application
async function runScheduledCleanup() {
    try {
        const deleter = new ProductDeleter();
        
        // Clean up old products and banners
        await deleter.runFullCleanup({
            cleanDeals: true,
            cleanBannerJson: true,
            cleanFirebase: true,
            dealsCriteria: {
                olderThan: 30, // Delete products older than 30 days
                minDiscount: 10 // Keep only products with 10%+ discount
            }
        });
    } catch (error) {
        console.error('Cleanup failed:', error.message);
    }
}

// Run daily at 2 AM
const schedule = require('node-schedule');
schedule.scheduleJob('0 2 * * *', runScheduledCleanup);
```

### 3. Banner Management Integration

Add to your application for banner management:

```javascript
const { BannerManagerTool } = require('./tools/bannerManager');

// In your main application
async function manageBanners() {
    try {
        const tool = new BannerManagerTool();
        
        // Get display banners for your website
        const displayResult = await tool.manager.getDisplayBanners(15);
        
        if (displayResult.status === 200) {
            // Use banners in your application
            const banners = displayResult.data;
            console.log(`Loaded ${banners.length} banners for display`);
        }
    } catch (error) {
        console.error('Banner management failed:', error.message);
    }
}
```

## 🚀 Chrome Setup for Banner Extraction

### 1. Start Chrome with Remote Debugging

```bash
# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenum\ChromeProfile"

# Linux/Mac
google-chrome --remote-debugging-port=9222 --user-data-dir="/path/to/chrome-profile"
```

### 2. Login to Amazon Affiliate Program

1. Open Chrome with the command above
2. Navigate to https://affiliate-program.amazon.in/
3. Login to your account
4. Keep Chrome running

### 3. Run Banner Extraction

```bash
# Use existing Chrome instance (will use your logged-in session)
node tools/bannerExtraction.js --use-existing-chrome
```

## 📋 Automation Scripts

### Windows Batch Script
```bash
# Run extraction
scripts\banner-extraction.bat extract

# Run full cycle
scripts\banner-extraction.bat full

# Health check
scripts\banner-extraction.bat health
```

### Linux/Mac Shell Script
```bash
# Make executable
chmod +x scripts/banner-extraction.sh

# Run extraction
./scripts/banner-extraction.sh extract

# Run full cycle
./scripts/banner-extraction.sh full

# Health check
./scripts/banner-extraction.sh health
```

## 🔄 Scheduling with Cron/Task Scheduler

### Linux/Mac (Cron)
```bash
# Edit crontab
crontab -e

# Run extraction every hour
0 * * * * cd /path/to/project && node tools/bannerExtraction.js --use-existing-chrome

# Run cleanup daily at 2 AM
0 2 * * * cd /path/to/project && node tools/deleteProduct.js full --older-than=30

# Health check every 6 hours
0 */6 * * * cd /path/to/project && node tools/bannerManager.js stats
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 2 AM)
4. Action: Start a program
5. Program: `cmd.exe`
6. Arguments: `/c "cd /d C:\path\to\project && node tools\bannerExtraction.js --use-existing-chrome"`

## 📊 Monitoring and Logs

### Log Files
- `logs/banner-automation.log` - Automation logs
- `logs/banner-stats.json` - Banner statistics
- `database/backups/` - Automatic backups before deletion

### Health Checks
```bash
# Check banner statistics
node tools/bannerManager.js stats

# Check system health
node scripts/automateBannerExtraction.js health

# List active banners
node tools/bannerManager.js list --active-only
```

## 🛡️ Safety Features

### Automatic Backups
- All deletion operations create backups
- Backups stored in `database/backups/`
- Timestamped backup files

### Validation
- Banner URL validation
- Image size validation
- Content filtering (affiliate keywords)
- Product carousel detection

### Error Handling
- Graceful error handling
- Detailed logging
- Non-blocking operations

## 🔧 Configuration

### Banner Configuration
Edit `config/bannerConfig.js` to:
- Add/remove platforms
- Modify selectors
- Adjust validation rules
- Set banner limits

### Validation Rules
- Minimum image dimensions
- Allowed domains
- Excluded keywords
- Product carousel keywords

## 📝 Usage Examples

### Quick Start
```bash
# 1. Start Chrome with debugging
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\selenum\ChromeProfile"

# 2. Login to Amazon affiliate program
# Navigate to https://affiliate-program.amazon.in/ and login

# 3. Extract banners
node tools/bannerExtraction.js --use-existing-chrome

# 4. Check results
node tools/bannerManager.js stats

# 5. List active banners
node tools/bannerManager.js list --active-only
```

### Regular Maintenance
```bash
# Daily cleanup (run at 2 AM)
node tools/deleteProduct.js full --older-than=30 --min-discount=10

# Weekly banner cleanup
node tools/bannerManager.js cleanup

# Monthly statistics
node tools/bannerManager.js stats
```

### Troubleshooting
```bash
# Check if Chrome is running on port 9222
netstat -an | findstr 9222

# Test banner extraction
node tools/bannerExtraction.js --use-existing-chrome

# Check Firebase connection
node tools/bannerManager.js stats

# View logs
tail -f logs/banner-automation.log
```

## 🎯 Best Practices

1. **Use existing Chrome instance** for logged-in sessions
2. **Run cleanup regularly** to prevent data buildup
3. **Monitor statistics** to ensure system health
4. **Create backups** before major operations
5. **Test in development** before production deployment
6. **Schedule operations** during low-traffic periods
7. **Monitor logs** for errors and performance issues

## 📞 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Verify Chrome is running on port 9222
3. Test individual tools with `--help` flag
4. Review configuration in `config/bannerConfig.js` 