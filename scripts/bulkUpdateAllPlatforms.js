const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const { comprehensiveLoggingService } = require('../services/comprehensiveLoggingService');

const logger = getModuleLogger('bulkUpdateAllPlatforms');

// Comprehensive seed URLs for all platforms and categories
const PLATFORM_SEEDS = {
  amazon: {
    electronics: [
      'https://www.amazon.in/s?k=laptop&ref=sr_pg_1',
      'https://www.amazon.in/s?k=mobile+phones&ref=sr_pg_1',
      'https://www.amazon.in/s?k=headphones&ref=sr_pg_1',
      'https://www.amazon.in/s?k=smartwatch&ref=sr_pg_1'
    ],
    fashion: [
      'https://www.amazon.in/s?k=men+shirts&ref=sr_pg_1',
      'https://www.amazon.in/s?k=women+dresses&ref=sr_pg_1',
      'https://www.amazon.in/s?k=shoes&ref=sr_pg_1'
    ],
    home: [
      'https://www.amazon.in/s?k=kitchen+appliances&ref=sr_pg_1',
      'https://www.amazon.in/s?k=furniture&ref=sr_pg_1'
    ],
    deals: [
      'https://www.amazon.in/deals/ref=nav_cs_gb',
      'https://www.amazon.in/gp/bestsellers/ref=nav_cs_bestsellers'
    ]
  },
  flipkart: {
    electronics: [
      'https://www.flipkart.com/search?q=laptop',
      'https://www.flipkart.com/search?q=mobile',
      'https://www.flipkart.com/search?q=headphones'
    ],
    fashion: [
      'https://www.flipkart.com/search?q=men+shirts',
      'https://www.flipkart.com/search?q=women+dresses',
      'https://www.flipkart.com/search?q=shoes'
    ],
    home: [
      'https://www.flipkart.com/search?q=kitchen+appliances',
      'https://www.flipkart.com/search?q=furniture'
    ]
  },
  myntra: {
    fashion: [
      'https://www.myntra.com/men-tshirts',
      'https://www.myntra.com/women-dresses',
      'https://www.myntra.com/men-shirts',
      'https://www.myntra.com/women-ethnic-wear'
    ],
    accessories: [
      'https://www.myntra.com/watches',
      'https://www.myntra.com/bags'
    ]
  },
  ajio: {
    fashion: [
      'https://www.ajio.com/men-tshirts/c/830216001',
      'https://www.ajio.com/women-dresses/c/2692001',
      'https://www.ajio.com/men-shirts/c/830207001'
    ],
    accessories: [
      'https://www.ajio.com/men-watches/c/830203001',
      'https://www.ajio.com/women-handbags/c/830204001'
    ]
  }
};

async function runBulkUpdateForCategory(platform, category, urls, sourceType = 'website', targetDb = 'deals') {
  try {
    const startTime = comprehensiveLoggingService.logBulkUpdateStart(platform, category, targetDb, sourceType);
    
    logger.info(`🚀 Starting bulk update for ${platform} - ${category}`, { 
      platform, 
      category, 
      urlCount: urls.length,
      targetDb,
      sourceType
    });
    
    const categoryKey = `${platform}_${category}`;
    const result = await runBatch(urls, sourceType, categoryKey, targetDb);
    
    const categorySummary = {
      platform,
      category,
      targetDb,
      sourceType,
      urlCount: urls.length,
      totalProducts: result.totalExtracted || 0,
      successCount: result.totalStored || 0,
      errorCount: (result.totalExtracted || 0) - (result.totalStored || 0),
      createdCount: result.created || 0,
      updatedCount: result.updated || 0,
      pages: result.pages || 0,
      successRate: result.totalExtracted > 0 ? ((result.totalStored / result.totalExtracted) * 100).toFixed(2) : '0.00'
    };
    
    logger.info(`✅ Bulk update completed for ${platform} - ${category}`, categorySummary);
    
    // Log comprehensive stats
    comprehensiveLoggingService.logBulkUpdateComplete(platform, category, targetDb, sourceType, startTime, categorySummary.totalProducts, categorySummary.successCount, categorySummary.errorCount, categorySummary.createdCount, categorySummary.updatedCount);
    
    return categorySummary;
  } catch (error) {
    logger.error(`❌ Bulk update failed for ${platform} - ${category}`, {
      platform,
      category,
      targetDb,
      sourceType,
      error: error.message
    });
    throw error;
  }
}

async function runBulkUpdateForPlatform(platform, sourceType = 'website', targetDb = 'deals') {
  try {
    const startTime = comprehensiveLoggingService.logBulkUpdateStart(platform, 'ALL_CATEGORIES', targetDb, sourceType);
    
    const platformData = PLATFORM_SEEDS[platform];
    if (!platformData) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    
    const results = {};
    let totalProducts = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const [category, urls] of Object.entries(platformData)) {
      try {
        const categoryResult = await runBulkUpdateForCategory(platform, category, urls, sourceType, targetDb);
        results[category] = categoryResult;
        totalProducts += categoryResult.totalProducts || 0;
        totalSuccess += categoryResult.successCount || 0;
        totalErrors += categoryResult.errorCount || 0;
      } catch (error) {
        logger.error(`❌ Failed to process ${platform} - ${category}`, { error: error.message });
        results[category] = { error: error.message };
        totalErrors++;
      }
    }
    
    const platformSummary = {
      platform,
      sourceType,
      targetDb,
      totalCategories: Object.keys(platformData).length,
      totalProducts,
      totalSuccess,
      totalErrors,
      successRate: totalProducts > 0 ? ((totalSuccess / totalProducts) * 100).toFixed(2) : '0.00',
      results
    };
    
    logger.info(`✅ Platform bulk update completed: ${platform}`, platformSummary);
    
    // Log comprehensive stats
    comprehensiveLoggingService.logBulkUpdateComplete(platform, 'ALL_CATEGORIES', targetDb, sourceType, startTime, totalProducts, totalSuccess, totalErrors);
    
    return platformSummary;
  } catch (error) {
    logger.error(`❌ Platform bulk update failed: ${platform}`, { error: error.message });
    throw error;
  }
}

async function runBulkUpdateAll(sourceType = 'website', targetDb = 'deals') {
  try {
    logger.info('🚀 Starting bulk update for all platforms', { sourceType, targetDb });
    
    const allResults = {};
    let totalProducts = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const platform of Object.keys(PLATFORM_SEEDS)) {
      try {
        const platformResult = await runBulkUpdateForPlatform(platform, sourceType, targetDb);
        allResults[platform] = platformResult;
        totalProducts += platformResult.totalProducts || 0;
        totalSuccess += platformResult.successCount || 0;
        totalErrors += platformResult.errorCount || 0;
      } catch (error) {
        logger.error(`❌ Failed to process platform: ${platform}`, { error: error.message });
        allResults[platform] = { error: error.message };
        totalErrors++;
      }
    }
    
    // Generate comprehensive summary
    const summary = {
      sourceType,
      targetDb,
      totalPlatforms: Object.keys(PLATFORM_SEEDS).length,
      successfulPlatforms: Object.values(allResults).filter(r => !r.error).length,
      failedPlatforms: Object.values(allResults).filter(r => r.error).length,
      totalProducts,
      totalSuccess,
      totalErrors,
      successRate: totalProducts > 0 ? ((totalSuccess / totalProducts) * 100).toFixed(2) : '0.00',
      results: allResults
    };
    
    logger.info('✅ Bulk update for all platforms completed', summary);
    
    // Log comprehensive stats
    comprehensiveLoggingService.logBulkUpdateComplete('ALL_PLATFORMS', 'ALL_CATEGORIES', targetDb, sourceType, Date.now(), totalProducts, totalSuccess, totalErrors);
    
    return summary;
  } catch (error) {
    logger.error('❌ Bulk update for all platforms failed', { error: error.message });
    throw error;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const sourceType = (args[0] || 'website').toLowerCase();
  const platform = args[1] || '';
  const category = args[2] || '';
  
  return { sourceType, platform, category };
}

async function main() {
  try {
    const { sourceType, platform, category } = parseArgs();
    
    if (platform && category) {
      // Run for specific platform and category
      const urls = PLATFORM_SEEDS[platform]?.[category];
      if (!urls) {
        console.error(`❌ Unknown platform/category combination: ${platform}/${category}`);
        process.exit(1);
      }
      
      const result = await runBulkUpdateForCategory(platform, category, urls, sourceType);
      console.log(`\n✅ Bulk update completed for ${platform} - ${category}`);
      console.log(`📦 Pages processed: ${result.pages}`);
      console.log(`📊 Products extracted: ${result.totalExtracted}`);
      console.log(`💾 Products stored: ${result.totalStored}`);
      
    } else if (platform) {
      // Run for specific platform
      const result = await runBulkUpdateForPlatform(platform, sourceType);
      console.log(`\n✅ Bulk update completed for ${platform}`);
      console.log(`📊 Results:`, JSON.stringify(result, null, 2));
      
    } else {
      // Run for all platforms
      const result = await runBulkUpdateAll(sourceType);
      console.log(`\n✅ Bulk update completed for all platforms`);
      console.log(`🌐 Total platforms: ${result.totalPlatforms}`);
      console.log(`✅ Successful: ${result.successfulPlatforms}`);
      console.log(`❌ Failed: ${result.failedPlatforms}`);
    }
    
  } catch (error) {
    console.error('❌ Bulk update failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  runBulkUpdateAll, 
  runBulkUpdateForPlatform, 
  runBulkUpdateForCategory,
  PLATFORM_SEEDS 
};

