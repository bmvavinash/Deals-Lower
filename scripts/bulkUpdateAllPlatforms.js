process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const { comprehensiveLoggingService } = require('../services/comprehensiveLoggingService');
const { CategoryHierarchyDB } = require('../database/firebaseDB/categoryHierarchyDB');
const { getAllCategories } = require('../config/categoryHierarchy');
const { executionTracker } = require('../services/executionTracker');

const logger = getModuleLogger('bulkUpdateAllPlatforms');
const categoryHierarchyDB = new CategoryHierarchyDB();

// Flag to temporarily disable execution tracker for debugging
const DISABLE_EXECUTION_TRACKER = process.env.DISABLE_EXECUTION_TRACKER === 'true' || false;

// Comprehensive seed URLs for all platforms and categories
const PLATFORM_SEEDS = {
  amazon: {
    electronics: [
      'https://www.amazon.in/s?k=laptop&ref=sr_pg_1',
      'https://www.amazon.in/s?k=mobile+phones&ref=sr_pg_1',
      'https://www.amazon.in/s?k=headphones&ref=sr_pg_1',
      'https://www.amazon.in/s?k=smartwatch&ref=sr_pg_1',
      'https://www.amazon.in/s?k=tablets&ref=sr_pg_1',
      'https://www.amazon.in/s?k=cameras&ref=sr_pg_1'
    ],
    fashion: [
      'https://www.amazon.in/s?k=men+shirts&ref=sr_pg_1',
      'https://www.amazon.in/s?k=women+dresses&ref=sr_pg_1',
      'https://www.amazon.in/s?k=shoes&ref=sr_pg_1',
      'https://www.amazon.in/s?k=watches&ref=sr_pg_1',
      'https://www.amazon.in/s?k=handbags&ref=sr_pg_1'
    ],
    'home-kitchen': [
      'https://www.amazon.in/s?k=kitchen+appliances&ref=sr_pg_1',
      'https://www.amazon.in/s?k=furniture&ref=sr_pg_1',
      'https://www.amazon.in/s?k=home+decor&ref=sr_pg_1',
      'https://www.amazon.in/s?k=cookware&ref=sr_pg_1'
    ],
    'sports-fitness': [
      'https://www.amazon.in/s?k=fitness+equipment&ref=sr_pg_1',
      'https://www.amazon.in/s?k=sports+shoes&ref=sr_pg_1',
      'https://www.amazon.in/s?k=gym+equipment&ref=sr_pg_1'
    ],
    'beauty-personal-care': [
      'https://www.amazon.in/s?k=skincare&ref=sr_pg_1',
      'https://www.amazon.in/s?k=makeup&ref=sr_pg_1',
      'https://www.amazon.in/s?k=hair+care&ref=sr_pg_1'
    ],
    'books-stationery': [
      'https://www.amazon.in/s?k=books&ref=sr_pg_1',
      'https://www.amazon.in/s?k=stationery&ref=sr_pg_1',
      'https://www.amazon.in/s?k=office+supplies&ref=sr_pg_1'
    ],
    automotive: [
      'https://www.amazon.in/s?k=car+accessories&ref=sr_pg_1',
      'https://www.amazon.in/s?k=automotive+parts&ref=sr_pg_1'
    ],
    'baby-kids': [
      'https://www.amazon.in/s?k=baby+products&ref=sr_pg_1',
      'https://www.amazon.in/s?k=kids+toys&ref=sr_pg_1'
    ],
    grocery: [
      'https://www.amazon.in/s?k=grocery&ref=sr_pg_1',
      'https://www.amazon.in/s?k=food+items&ref=sr_pg_1'
    ],
    'tools-hardware': [
      'https://www.amazon.in/s?k=tools&ref=sr_pg_1',
      'https://www.amazon.in/s?k=hardware&ref=sr_pg_1'
    ],
    'music-entertainment': [
      'https://www.amazon.in/s?k=musical+instruments&ref=sr_pg_1',
      'https://www.amazon.in/s?k=entertainment&ref=sr_pg_1'
    ],
    'pet-supplies': [
      'https://www.amazon.in/s?k=pet+supplies&ref=sr_pg_1',
      'https://www.amazon.in/s?k=pet+food&ref=sr_pg_1'
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
      'https://www.flipkart.com/search?q=headphones',
      'https://www.flipkart.com/search?q=smartwatch',
      'https://www.flipkart.com/search?q=tablets'
    ],
    fashion: [
      'https://www.flipkart.com/search?q=men+shirts',
      'https://www.flipkart.com/search?q=women+dresses',
      'https://www.flipkart.com/search?q=shoes',
      'https://www.flipkart.com/search?q=watches'
    ],
    'home-kitchen': [
      'https://www.flipkart.com/search?q=kitchen+appliances',
      'https://www.flipkart.com/search?q=furniture',
      'https://www.flipkart.com/search?q=home+decor'
    ],
    'sports-fitness': [
      'https://www.flipkart.com/search?q=fitness+equipment',
      'https://www.flipkart.com/search?q=sports+shoes'
    ],
    'beauty-personal-care': [
      'https://www.flipkart.com/search?q=skincare',
      'https://www.flipkart.com/search?q=makeup'
    ],
    'books-stationery': [
      'https://www.flipkart.com/search?q=books',
      'https://www.flipkart.com/search?q=stationery'
    ],
    automotive: [
      'https://www.flipkart.com/search?q=car+accessories'
    ],
    'baby-kids': [
      'https://www.flipkart.com/search?q=baby+products',
      'https://www.flipkart.com/search?q=kids+toys'
    ],
    grocery: [
      'https://www.flipkart.com/search?q=grocery'
    ],
    'tools-hardware': [
      'https://www.flipkart.com/search?q=tools'
    ],
    'music-entertainment': [
      'https://www.flipkart.com/search?q=musical+instruments'
    ],
    'pet-supplies': [
      'https://www.flipkart.com/search?q=pet+supplies'
    ]
  },
  myntra: {
    fashion: [
      'https://www.myntra.com/men-tshirts',
      'https://www.myntra.com/women-dresses',
      'https://www.myntra.com/men-shirts',
      'https://www.myntra.com/women-ethnic-wear',
      'https://www.myntra.com/men-jeans',
      'https://www.myntra.com/women-tops'
    ],
    accessories: [
      'https://www.myntra.com/watches',
      'https://www.myntra.com/bags',
      'https://www.myntra.com/sunglasses',
      'https://www.myntra.com/jewellery'
    ],
    'beauty-personal-care': [
      'https://www.myntra.com/beauty',
      'https://www.myntra.com/skincare'
    ],
    'sports-fitness': [
      'https://www.myntra.com/sports-shoes',
      'https://www.myntra.com/fitness'
    ],
    'home-kitchen': [
      'https://www.myntra.com/home-living'
    ],
    'baby-kids': [
      'https://www.myntra.com/kids'
    ],
    'books-stationery': [
      'https://www.myntra.com/books'
    ],
    automotive: [
      'https://www.myntra.com/automotive'
    ],
    grocery: [
      'https://www.myntra.com/grocery'
    ],
    'tools-hardware': [
      'https://www.myntra.com/tools'
    ],
    'music-entertainment': [
      'https://www.myntra.com/music'
    ],
    'pet-supplies': [
      'https://www.myntra.com/pet-supplies'
    ]
  },
  ajio: {
    fashion: [
      'https://www.ajio.com/men-tshirts/c/830216001',
      'https://www.ajio.com/women-dresses/c/2692001',
      'https://www.ajio.com/men-shirts/c/830207001',
      'https://www.ajio.com/women-tops/c/2692002',
      'https://www.ajio.com/men-jeans/c/830207002'
    ],
    accessories: [
      'https://www.ajio.com/men-watches/c/830203001',
      'https://www.ajio.com/women-handbags/c/830204001',
      'https://www.ajio.com/sunglasses/c/830205001',
      'https://www.ajio.com/jewellery/c/830206001'
    ],
    'beauty-personal-care': [
      'https://www.ajio.com/beauty/c/830208001',
      'https://www.ajio.com/skincare/c/830209001'
    ],
    'sports-fitness': [
      'https://www.ajio.com/sports-shoes/c/830210001',
      'https://www.ajio.com/fitness/c/830211001'
    ],
    'home-kitchen': [
      'https://www.ajio.com/home-living/c/830212001'
    ],
    'baby-kids': [
      'https://www.ajio.com/kids/c/830213001'
    ],
    'books-stationery': [
      'https://www.ajio.com/books/c/830214001'
    ],
    automotive: [
      'https://www.ajio.com/automotive/c/830215001'
    ],
    grocery: [
      'https://www.ajio.com/grocery/c/830216001'
    ],
    'tools-hardware': [
      'https://www.ajio.com/tools/c/830217001'
    ],
    'music-entertainment': [
      'https://www.ajio.com/music/c/830218001'
    ],
    'pet-supplies': [
      'https://www.ajio.com/pet-supplies/c/830219001'
    ]
  }
};
// #region agent log
fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:224',message:'PLATFORM_SEEDS defined',data:{PLATFORM_SEEDS_type:typeof PLATFORM_SEEDS,PLATFORM_SEEDS_isUndefined:PLATFORM_SEEDS===undefined,PLATFORM_SEEDS_keys:PLATFORM_SEEDS?Object.keys(PLATFORM_SEEDS).join(','):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

async function runBulkUpdateForCategory(platform, category, urls, sourceType = 'website', targetDb = 'deals') {
  // DEBUG: Log function entry with all parameters
  console.log(`\n[DEBUG] ========== runBulkUpdateForCategory ENTRY ==========`);
  console.log(`[DEBUG] platform=${platform}, category=${category}, urls=${Array.isArray(urls) ? urls.length : typeof urls}, sourceType=${sourceType}, targetDb=${targetDb}`);
  
  // Validate inputs immediately
  if (!urls || !Array.isArray(urls)) {
    const error = new Error(`Invalid urls parameter: ${typeof urls}. Expected array.`);
    console.error(`[DEBUG] Invalid urls:`, { platform, category, urlsType: typeof urls, urls });
    logger.error('Invalid urls in runBulkUpdateForCategory', { platform, category, urlsType: typeof urls, urls });
    throw error;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:227',message:'runBulkUpdateForCategory entry',data:{platform,category,urlCount:urls.length,sourceType,targetDb,runBatch_type:typeof runBatch,runBatch_isUndefined:runBatch===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  // Wrap everything in try-catch to capture the exact error
  let startTime;
  try {
    console.log(`[DEBUG] About to call logBulkUpdateStart`);
    startTime = comprehensiveLoggingService.logBulkUpdateStart(platform, category, targetDb, sourceType);
    console.log(`[DEBUG] ✅ logBulkUpdateStart completed, startTime=${startTime}`);
  } catch (logError) {
    console.error(`[DEBUG] ❌ logBulkUpdateStart failed:`, logError.message);
    console.error(`[DEBUG] Stack:`, logError.stack);
    logger.error('Failed to log bulk update start', { error: logError.message, stack: logError.stack, platform, category });
    // Continue anyway - logging is non-fatal
    startTime = Date.now();
  }
  
  try {
    console.log(`[DEBUG] About to call executionTracker.updateCurrentPlatform`);
    
    // Update execution tracker (completely non-fatal - never throw)
    if (!DISABLE_EXECUTION_TRACKER) {
      try {
        await executionTracker.updateCurrentPlatform(platform, category);
        console.log(`[DEBUG] ✅ executionTracker.updateCurrentPlatform completed`);
      } catch (trackerError) {
        console.error(`[DEBUG] ❌ executionTracker.updateCurrentPlatform failed:`, trackerError.message);
        console.error(`[DEBUG] Stack:`, trackerError.stack);
        // Silently continue - tracker is optional
        logger.debug('Execution tracker update failed (non-fatal)', { 
          platform, 
          category, 
          error: trackerError.message
        });
      }
    } else {
      console.log(`[DEBUG] ⚠️ Execution tracker is DISABLED`);
    }
    
    console.log(`[DEBUG] About to call logger.info`);
    logger.info(`🚀 Starting bulk update for ${platform} - ${category}`, { 
      platform, 
      category, 
      urlCount: urls.length,
      targetDb,
      sourceType
    });
    
    const categoryKey = `${platform}_${category}`;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:242',message:'Before runBatch call',data:{categoryKey,urlCount:urls.length,runBatch_type:typeof runBatch,runBatch_isFunction:typeof runBatch==='function',runBatch_isUndefined:runBatch===undefined,platform,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    logger.info(`📦 About to call runBatch`, { 
      categoryKey, 
      urlCount: urls.length,
      runBatchType: typeof runBatch,
      hasRunBatch: !!runBatch,
      platform,
      category
    });
    
    let result;
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:252',message:'Calling runBatch',data:{categoryKey,urlCount:urls.length,sourceType,targetDb,platform,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      logger.info(`🚀 [BEFORE] Calling runBatch with params`, {
        urlsCount: urls.length,
        sourceType,
        categoryKey,
        targetDb,
        platform,
        category,
        firstUrl: urls[0] || 'N/A'
      });
      result = await runBatch(urls, sourceType, categoryKey, targetDb);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:255',message:'runBatch completed',data:{totalExtracted:result?.totalExtracted||0,totalStored:result?.totalStored||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      logger.info(`✅ runBatch completed`, { 
        totalExtracted: result?.totalExtracted || 0,
        totalStored: result?.totalStored || 0
      });
    } catch (batchError) {
      logger.error(`❌ [ERROR] runBatch threw error`, {
        error: batchError.message,
        stack: batchError.stack,
        errorName: batchError.name,
        categoryKey,
        platform,
        category,
        urlCount: urls.length,
        fullError: JSON.stringify(batchError, Object.getOwnPropertyNames(batchError))
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:batchError',message:'runBatch error caught',data:{error:batchError.message,stack:batchError.stack,platform,category},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      throw batchError;
    }
    
    // Update progress in execution tracker (with error handling to prevent crashes)
    try {
      const progressData = {
        totalProducts: result.totalExtracted || 0,
        processed: result.totalStored || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        errors: (result.totalExtracted || 0) - (result.totalStored || 0)
      };
      
      logger.info('📊 Updating execution tracker with progress', {
        platform,
        category,
        progress: progressData,
        resultTotalExtracted: result.totalExtracted,
        resultTotalStored: result.totalStored,
        resultCreated: result.created,
        resultUpdated: result.updated
      });
      
      await executionTracker.updateCategoryProgress(platform, category, progressData);
      
      logger.info('✅ Execution tracker updated successfully', {
        platform,
        category,
        progress: progressData
      });
    } catch (trackerError) {
      // Log error but continue - tracker is optional
      logger.error('❌ Category progress update failed (non-fatal)', {
        platform,
        category,
        error: trackerError.message,
        stack: trackerError.stack,
        resultTotalExtracted: result.totalExtracted,
        resultTotalStored: result.totalStored
      });
    }
    
    // Get hierarchical category statistics
    let hierarchyStats = null;
    try {
      const stats = await categoryHierarchyDB.getCategoryStats();
      hierarchyStats = {
        totalProducts: stats.totalProducts,
        categories: Object.keys(stats.categories).length,
        subcategories: Object.keys(stats.subcategories).length,
        styles: Object.keys(stats.styles).length
      };
    } catch (error) {
      logger.warn('Failed to get hierarchy stats', { error: error.message });
    }
    
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
      successRate: result.totalExtracted > 0 ? ((result.totalStored / result.totalExtracted) * 100).toFixed(2) : '0.00',
      hierarchyStats
    };
    
    logger.info(`✅ Bulk update completed for ${platform} - ${category}`, categorySummary);
    
    // Log comprehensive stats (non-fatal)
    try {
      comprehensiveLoggingService.logBulkUpdateComplete(platform, category, targetDb, sourceType, startTime, categorySummary.totalProducts, categorySummary.successCount, categorySummary.errorCount, categorySummary.createdCount, categorySummary.updatedCount);
    } catch (logError) {
      logger.debug('Failed to log bulk update complete (non-fatal)', { error: logError.message, platform, category });
    }
    
    return categorySummary;
  } catch (error) {
    logger.error(`❌ [ERROR] Bulk update failed for ${platform} - ${category}`, {
      platform,
      category,
      targetDb,
      sourceType,
      error: error.message,
      stack: error.stack,
      errorName: error.name,
      errorType: typeof error
    });
    
    // Log additional context
    logger.error(`❌ [ERROR CONTEXT]`, {
      platform,
      category,
      urlCount: urls?.length || 0,
      firstUrl: urls?.[0] || 'N/A',
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 10).join('\n') // First 10 lines of stack
    });
    
    throw error;
  }
}

async function runBulkUpdateForPlatform(platform, sourceType = 'website', targetDb = 'deals') {
  // DEBUG: Log function entry
  console.log(`\n[DEBUG] ========== runBulkUpdateForPlatform ENTRY ==========`);
  console.log(`[DEBUG] platform=${platform}, PLATFORM_SEEDS type=${typeof PLATFORM_SEEDS}, PLATFORM_SEEDS keys=${PLATFORM_SEEDS ? Object.keys(PLATFORM_SEEDS).join(',') : 'N/A'}`);
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:289',message:'runBulkUpdateForPlatform entry',data:{platform,sourceType,targetDb,PLATFORM_SEEDS_type:typeof PLATFORM_SEEDS,PLATFORM_SEEDS_keys:PLATFORM_SEEDS?Object.keys(PLATFORM_SEEDS):'N/A',hasPlatform:!!PLATFORM_SEEDS?.[platform]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const startTime = comprehensiveLoggingService.logBulkUpdateStart(platform, 'ALL_CATEGORIES', targetDb, sourceType);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:293',message:'Before PLATFORM_SEEDS access',data:{platform,PLATFORM_SEEDS_type:typeof PLATFORM_SEEDS,PLATFORM_SEEDS_value:PLATFORM_SEEDS,PLATFORM_SEEDS_isUndefined:PLATFORM_SEEDS===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Validate PLATFORM_SEEDS before accessing
    console.log(`[DEBUG] Validating PLATFORM_SEEDS: type=${typeof PLATFORM_SEEDS}, isObject=${typeof PLATFORM_SEEDS === 'object'}, isNull=${PLATFORM_SEEDS === null}`);
    if (!PLATFORM_SEEDS || typeof PLATFORM_SEEDS !== 'object') {
      const error = new Error('PLATFORM_SEEDS configuration is not available');
      console.error(`[DEBUG] PLATFORM_SEEDS validation failed:`, { PLATFORM_SEEDSType: typeof PLATFORM_SEEDS, PLATFORM_SEEDSValue: PLATFORM_SEEDS, platform });
      logger.error('CRITICAL: PLATFORM_SEEDS is not available', {
        PLATFORM_SEEDSType: typeof PLATFORM_SEEDS,
        PLATFORM_SEEDSValue: PLATFORM_SEEDS,
        platform
      });
      throw error;
    }
    
    console.log(`[DEBUG] Accessing PLATFORM_SEEDS[${platform}]:`, { hasKey: platform in PLATFORM_SEEDS, keys: Object.keys(PLATFORM_SEEDS) });
    const platformData = PLATFORM_SEEDS[platform];
    console.log(`[DEBUG] platformData:`, { type: typeof platformData, isNull: platformData === null, isUndefined: platformData === undefined, isObject: typeof platformData === 'object', keys: platformData ? Object.keys(platformData) : 'N/A' });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bulkUpdateAllPlatforms.js:295',message:'After PLATFORM_SEEDS access',data:{platform,platformData_type:typeof platformData,platformData_value:platformData,platformData_isNull:platformData===null,platformData_isUndefined:platformData===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!platformData) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    
    const results = {};
    let totalProducts = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    for (const [category, urls] of Object.entries(platformData)) {
      // DEBUG: Log before calling runBulkUpdateForCategory
      console.log(`[DEBUG] About to call runBulkUpdateForCategory: platform=${platform}, category=${category}, urls=${Array.isArray(urls) ? urls.length : 'NOT_ARRAY'}`);
      logger.debug('About to process category', { platform, category, urlsType: typeof urls, urlsIsArray: Array.isArray(urls), urlsLength: Array.isArray(urls) ? urls.length : 'N/A' });
      
      try {
        const categoryResult = await runBulkUpdateForCategory(platform, category, urls, sourceType, targetDb);
        results[category] = categoryResult;
        totalProducts += categoryResult.totalProducts || 0;
        totalSuccess += categoryResult.successCount || 0;
        totalErrors += categoryResult.errorCount || 0;
      } catch (error) {
        // Log full error details including stack trace
        const errorDetails = {
          error: error.message,
          stack: error.stack,
          errorName: error.name,
          platform,
          category,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          errorToString: String(error),
          errorConstructor: error.constructor?.name
        };
        
        // Also log to console for immediate visibility
        console.error(`[CRITICAL ERROR] Failed to process ${platform} - ${category}:`, error);
        console.error(`[STACK TRACE]:`, error.stack);
        
        logger.error(`❌ Failed to process ${platform} - ${category}`, errorDetails);
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

async function runBulkUpdateAll(sourceType = 'website', targetDb = 'deals', clientMetadata = null) {
  try {
    logger.info('🚀 [ENTRY] Starting bulk update for all platforms', { 
      sourceType, 
      targetDb,
      clientMetadata,
      platformCount: Object.keys(PLATFORM_SEEDS).length,
      platforms: Object.keys(PLATFORM_SEEDS)
    });
    
    // Start execution tracking
    let execution;
    try {
      execution = await executionTracker.startBulkExecution(sourceType, targetDb, clientMetadata);
      logger.info('✅ Execution tracker started', { executionId: execution?.id });
    } catch (trackerError) {
      logger.error('❌ [ERROR] Failed to start execution tracker', { 
        error: trackerError.message,
        stack: trackerError.stack
      });
      // Continue execution even if tracker fails
    }
    
    const allResults = {};
    let totalProducts = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Validate PLATFORM_SEEDS before iterating
    if (!PLATFORM_SEEDS || typeof PLATFORM_SEEDS !== 'object') {
      logger.error('❌ [CRITICAL] PLATFORM_SEEDS is undefined or invalid in runBulkUpdateAll', {
        PLATFORM_SEEDSType: typeof PLATFORM_SEEDS,
        PLATFORM_SEEDSValue: PLATFORM_SEEDS
      });
      throw new Error('PLATFORM_SEEDS configuration is not available');
    }
    
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
    
    // Complete execution tracking
    try {
      await executionTracker.completeBulkExecution(summary);
      logger.info('✅ Execution tracker completed');
    } catch (trackerError) {
      logger.error('❌ [ERROR] Failed to complete execution tracker', { 
        error: trackerError.message,
        stack: trackerError.stack
      });
      // Don't throw - summary is still valid
    }
    
    return summary;
  } catch (error) {
    logger.error('❌ Bulk update for all platforms failed', { error: error.message });
    throw error;
  }
}

/**
 * Initialize category hierarchy in database
 */
async function initializeCategoryHierarchy() {
  try {
    logger.info('Initializing category hierarchy...');
    await categoryHierarchyDB.initializeHierarchy();
    logger.info('✅ Category hierarchy initialized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Failed to initialize category hierarchy', { error: error.message });
    return false;
  }
}

/**
 * Migrate existing products to hierarchical categories
 */
async function migrateToHierarchical() {
  try {
    logger.info('Starting migration to hierarchical categories...');
    const result = await categoryHierarchyDB.migrateToHierarchical();
    logger.info('✅ Migration completed', { migratedCount: result.migratedCount });
    return result;
  } catch (error) {
    logger.error('❌ Migration failed', { error: error.message });
    throw error;
  }
}

/**
 * Get category statistics
 */
async function getCategoryStats() {
  try {
    const stats = await categoryHierarchyDB.getCategoryStats();
    logger.info('Category statistics retrieved', {
      totalProducts: stats.totalProducts,
      uniqueCategories: Object.keys(stats.categories).length,
      uniqueSubcategories: Object.keys(stats.subcategories).length,
      uniqueStyles: Object.keys(stats.styles).length
    });
    return stats;
  } catch (error) {
    logger.error('Failed to get category statistics', { error: error.message });
    throw error;
  }
}

/**
 * Search products by hierarchical category
 */
async function searchProductsByHierarchy(searchCriteria) {
  try {
    const products = await categoryHierarchyDB.searchProducts(searchCriteria);
    logger.info('Products found', { 
      searchCriteria, 
      count: products.length 
    });
    return products;
  } catch (error) {
    logger.error('Failed to search products', { 
      error: error.message, 
      searchCriteria 
    });
    throw error;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'bulk';
  const sourceType = (args[1] || 'website').toLowerCase();
  
  // Handle different argument patterns
  let platform = '';
  let category = '';
  let targetDb = 'deals';
  
  if (args.length === 3) {
    // node script.js bulk website targetDb
    targetDb = args[2];
  } else if (args.length === 4) {
    // node script.js bulk website platform targetDb
    platform = args[2];
    targetDb = args[3];
  } else if (args.length >= 5) {
    // node script.js bulk website platform category targetDb
    platform = args[2];
    category = args[3];
    targetDb = args[4];
  }
  
  return { command, sourceType, platform, category, targetDb };
}

async function main() {
  try {
    const { command, sourceType, platform, category, targetDb } = parseArgs();
    console.log('Debug args:', { command, sourceType, platform, category, targetDb });
    
    // Add immediate execution flag
    const immediateMode = process.argv.includes('--immediate') || process.argv.includes('-i');
    
    if (immediateMode) {
      console.log('\n🚀 IMMEDIATE MODE - Starting bulk update now...');
      console.log('==============================================');
      console.log(`Platform: ${platform || 'ALL'}`);
      console.log(`Category: ${category || 'ALL'}`);
      console.log(`Target DB: ${targetDb}`);
      console.log(`Source Type: ${sourceType}`);
      console.log(`Started: ${new Date().toLocaleString()}`);
      console.log('==============================================\n');
    }
    
    switch (command) {
      case 'init':
        // Initialize category hierarchy
        await initializeCategoryHierarchy();
        break;
        
      case 'migrate':
        // Migrate existing products to hierarchical categories
        await migrateToHierarchical();
        break;
        
      case 'stats':
        // Get category statistics
        const stats = await getCategoryStats();
        console.log('\n📊 Category Statistics:');
        console.log(`Total Products: ${stats.totalProducts}`);
        console.log(`Unique Categories: ${Object.keys(stats.categories).length}`);
        console.log(`Unique Subcategories: ${Object.keys(stats.subcategories).length}`);
        console.log(`Unique Styles: ${Object.keys(stats.styles).length}`);
        break;
        
      case 'search':
        // Search products by hierarchical category
        const searchCriteria = {
          mainCategory: platform || 'electronics',
          subcategory: category || null,
          limit: 50
        };
        const products = await searchProductsByHierarchy(searchCriteria);
        console.log(`\n🔍 Found ${products.length} products`);
        products.slice(0, 10).forEach((product, index) => {
          console.log(`${index + 1}. ${product.title} - ${product.hierarchicalCategory?.hierarchicalKey || 'No hierarchy'}`);
        });
        break;
        
      case 'bulk':
      default:
        // Original bulk update functionality
        const startTime = Date.now();
        
        if (platform && category) {
          // Run for specific platform and category
          const urls = PLATFORM_SEEDS[platform]?.[category];
          if (!urls) {
            console.error(`❌ Unknown platform/category combination: ${platform}/${category}`);
            process.exit(1);
          }
          
          console.log(`📦 Processing ${platform} - ${category} (${urls.length} URLs)`);
          const result = await runBulkUpdateForCategory(platform, category, urls, sourceType, targetDb);
          
          const duration = Date.now() - startTime;
          console.log(`\n✅ Bulk update completed for ${platform} - ${category}`);
          console.log(`⏱️  Duration: ${Math.round(duration / 60000)} minutes`);
          console.log(`📦 Pages processed: ${result.pages || 0}`);
          console.log(`📊 Products extracted: ${result.totalProducts || 0}`);
          console.log(`💾 Products stored: ${result.successCount || 0}`);
          console.log(`✅ Success rate: ${result.successRate || 'N/A'}%`);
          
          if (result.hierarchyStats) {
            console.log(`🏷️  Hierarchy Stats: ${result.hierarchyStats.categories} categories, ${result.hierarchyStats.subcategories} subcategories, ${result.hierarchyStats.styles} styles`);
          }
          
        } else if (platform) {
          // Run for specific platform
          console.log(`📦 Processing ${platform} platform`);
          const result = await runBulkUpdateForPlatform(platform, sourceType, targetDb);
          
          const duration = Date.now() - startTime;
          console.log(`\n✅ Bulk update completed for ${platform}`);
          console.log(`⏱️  Duration: ${Math.round(duration / 60000)} minutes`);
          console.log(`📊 Results:`, JSON.stringify(result, null, 2));
          
        } else {
          // Run for all platforms
          console.log('📦 Processing all platforms');
          const result = await runBulkUpdateAll(sourceType, targetDb);
          
          const duration = Date.now() - startTime;
          console.log(`\n✅ Bulk update completed for all platforms`);
          console.log(`⏱️  Duration: ${Math.round(duration / 60000)} minutes`);
          console.log(`🌐 Total platforms: ${result.totalPlatforms}`);
          console.log(`✅ Successful: ${result.successfulPlatforms}`);
          console.log(`❌ Failed: ${result.failedPlatforms}`);
          console.log(`📊 Total products: ${result.totalProducts}`);
          console.log(`🎯 Success rate: ${result.successRate}%`);
        }
        break;
    }
    
    if (immediateMode) {
      console.log('\n==============================================');
      console.log(`✅ Immediate bulk update completed successfully`);
      console.log(`Completed: ${new Date().toLocaleString()}`);
      console.log('==============================================');
    }
    
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
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

