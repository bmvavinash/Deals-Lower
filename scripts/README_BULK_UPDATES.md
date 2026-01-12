# Bulk Update Scripts - User Guide

This guide explains how to use the bulk update scripts to run immediate product updates across all supported platforms.

## 🚀 Quick Start

### Option 1: Interactive Menu (Recommended for Beginners)

**Windows:**
```batch
scripts\runBulkUpdatesNow.bat
```

**Linux/Mac:**
```bash
./scripts/runBulkUpdatesNow.sh
```

### Option 2: Quick Commands

**Run Amazon Electronics only:**
```bash
node scripts/quickBulkUpdate.js amazon-electronics
```

**Run all Amazon categories:**
```bash
node scripts/quickBulkUpdate.js amazon-all
```

**Run all platforms:**
```bash
node scripts/quickBulkUpdate.js all-platforms
```

### Option 3: Direct Command Line

**Run all platforms:**
```bash
node scripts/runBulkUpdatesNow.js
```

**Run specific platform:**
```bash
node scripts/runBulkUpdatesNow.js amazon
```

**Run specific platform and category:**
```bash
node scripts/runBulkUpdatesNow.js amazon electronics
```

## 📋 Available Scripts

### 1. `runBulkUpdatesNow.js` - Main Script

The primary script for running bulk updates with full command-line control.

**Usage:**
```bash
node scripts/runBulkUpdatesNow.js [options] [platform] [category]
```

**Options:**
- `--help, -h` - Show help message
- `--target-db <db>` - Target database (deals, productdeals, test)
- `--source-type <type>` - Source type (website, telegram, api)
- `--dry-run` - Show what would be run without executing

**Examples:**
```bash
# Run all platforms
node scripts/runBulkUpdatesNow.js

# Run Amazon only
node scripts/runBulkUpdatesNow.js amazon

# Run Amazon electronics only
node scripts/runBulkUpdatesNow.js amazon electronics

# Run with specific database
node scripts/runBulkUpdatesNow.js amazon --target-db productdeals

# Dry run to see what would be executed
node scripts/runBulkUpdatesNow.js --dry-run amazon
```

### 2. `quickBulkUpdate.js` - Quick Commands

Simplified script with predefined common operations.

**Usage:**
```bash
node scripts/quickBulkUpdate.js [option]
```

**Available Options:**
- `amazon-electronics` - Amazon Electronics category
- `amazon-fashion` - Amazon Fashion category
- `amazon-home` - Amazon Home & Kitchen category
- `flipkart-electronics` - Flipkart Electronics category
- `myntra-fashion` - Myntra Fashion category
- `amazon-all` - All Amazon categories
- `flipkart-all` - All Flipkart categories
- `myntra-all` - All Myntra categories
- `ajio-all` - All Ajio categories
- `all-platforms` - All platforms and categories

**Examples:**
```bash
# Show available options
node scripts/quickBulkUpdate.js --list

# Run Amazon electronics
node scripts/quickBulkUpdate.js amazon-electronics

# Run all Amazon categories
node scripts/quickBulkUpdate.js amazon-all

# Run all platforms
node scripts/quickBulkUpdate.js all-platforms
```

### 3. Interactive Menu Scripts

**Windows Batch File:**
```batch
scripts\runBulkUpdatesNow.bat
```

**Linux/Mac Shell Script:**
```bash
./scripts/runBulkUpdatesNow.sh
```

Both scripts provide an interactive menu for easy selection of bulk update operations.

## 🏪 Supported Platforms

### Amazon
- **Categories:** electronics, fashion, home-kitchen, sports-fitness, beauty-personal-care, books-stationery, automotive, baby-kids, grocery, tools-hardware, music-entertainment, pet-supplies, deals
- **Estimated time:** 5-15 minutes per category, 1-2 hours for all categories

### Flipkart
- **Categories:** electronics, fashion, home-kitchen, sports-fitness, beauty-personal-care, books-stationery, automotive, baby-kids, grocery, tools-hardware, music-entertainment, pet-supplies
- **Estimated time:** 5-15 minutes per category, 1-2 hours for all categories

### Myntra
- **Categories:** fashion, accessories, beauty-personal-care, sports-fitness, home-kitchen, baby-kids, books-stationery, automotive, grocery, tools-hardware, music-entertainment, pet-supplies
- **Estimated time:** 5-10 minutes per category, 30-60 minutes for all categories

### Ajio
- **Categories:** fashion, accessories, beauty-personal-care, sports-fitness, home-kitchen, baby-kids, books-stationery, automotive, grocery, tools-hardware, music-entertainment, pet-supplies
- **Estimated time:** 5-10 minutes per category, 30-60 minutes for all categories

## 🎯 Target Databases

- **`deals`** (default) - Main deals database
- **`productdeals`** - Product deals database
- **`test`** - Test database for development

## 📊 Expected Results

### Single Category
- **Duration:** 5-15 minutes
- **Products:** 50-500 products typically
- **Success Rate:** 80-95% typically

### Platform-wide
- **Duration:** 30-60 minutes
- **Products:** 500-2000 products typically
- **Success Rate:** 75-90% typically

### All Platforms
- **Duration:** 1-3 hours
- **Products:** 2000-8000 products typically
- **Success Rate:** 70-85% typically

## 🔧 Configuration

### Environment Variables
- `NODE_ENV` - Environment (development, stage, production)
- `USERS_FIREBASE_SERVICE_ACCOUNT_PATH` - Path to Firebase service account
- `USERS_FIREBASE_DATABASE_URL` - Firebase database URL

### Configuration Files
- `config/constants.js` - Main configuration
- `config/config.js` - Environment-specific configuration

## 🚨 Troubleshooting

### Common Issues

**1. Node.js not found**
```bash
# Install Node.js from https://nodejs.org/
# Or check if it's in your PATH
node --version
```

**2. Permission denied (Linux/Mac)**
```bash
# Make the shell script executable
chmod +x scripts/runBulkUpdatesNow.sh
```

**3. Firebase connection errors**
- Check your Firebase configuration in `config/constants.js`
- Verify your service account file path
- Ensure your Firebase project has the correct permissions

**4. Memory issues**
- Close other applications to free up RAM
- Consider running smaller batches (single categories)
- Check available disk space

**5. Network timeouts**
- Check your internet connection
- Some platforms may temporarily block requests
- Try running again after a few minutes

### Debug Mode

Run with debug logging:
```bash
# Enable debug mode
DEBUG=* node scripts/runBulkUpdatesNow.js amazon electronics
```

### Dry Run

Test what would be executed without running:
```bash
# See what would be run for Amazon
node scripts/runBulkUpdatesNow.js --dry-run amazon

# See what would be run for all platforms
node scripts/runBulkUpdatesNow.js --dry-run
```

## 📈 Monitoring Progress

The scripts provide real-time progress updates including:
- Current platform and category being processed
- Number of URLs being processed
- Products extracted and stored
- Success rates and error counts
- Estimated completion time

## 🔄 Scheduling

For automated bulk updates, consider using:
- **Cron jobs** (Linux/Mac)
- **Task Scheduler** (Windows)
- **Systemd timers** (Linux)
- **Docker containers** with scheduled execution

Example cron job (run daily at 2 AM):
```bash
0 2 * * * cd /path/to/project && node scripts/quickBulkUpdate.js all-platforms
```

## 📝 Logs

Logs are stored in:
- `logs/` directory - Application logs
- Console output - Real-time progress
- Firebase - Database operation logs

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review the logs for error messages
3. Try running with `--dry-run` to test configuration
4. Start with smaller operations (single categories) before running full updates

## 🎉 Success Tips

1. **Start Small:** Begin with single categories to test your setup
2. **Monitor Resources:** Ensure sufficient RAM and disk space
3. **Check Logs:** Review logs after each run to identify issues
4. **Use Dry Run:** Test configurations before running full updates
5. **Schedule Wisely:** Run bulk updates during off-peak hours
6. **Backup First:** Ensure database backups before large operations

---

**Happy Bulk Updating! 🚀**







