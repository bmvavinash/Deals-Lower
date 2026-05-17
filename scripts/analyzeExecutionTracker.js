/**
 * Execution Tracker Analysis Script
 * Analyzes how the execution tracker works and what categories/platforms are configured
 */

const { PLATFORM_SEEDS } = require('./bulkUpdateAllPlatforms');
const { executionTracker } = require('../services/executionTracker');

// Required categories from the guide
const REQUIRED_CATEGORIES = [
  'electronics',
  'fashion',
  'home-kitchen',
  'sports-fitness',
  'beauty-personal-care',
  'books-stationery',
  'automotive',
  'baby-kids',
  'grocery',
  'tools-hardware',
  'music-entertainment',
  'pet-supplies'
];

function analyzeCategoryCoverage() {
  console.log('\n📊 CATEGORY & PLATFORM COVERAGE ANALYSIS');
  console.log('='.repeat(80));
  
  const platformCoverage = {};
  const categoryCoverage = {};
  
  // Initialize category coverage
  REQUIRED_CATEGORIES.forEach(cat => {
    categoryCoverage[cat] = [];
  });
  
  // Analyze each platform
  Object.entries(PLATFORM_SEEDS).forEach(([platform, categories]) => {
    const platformCategories = Object.keys(categories).filter(cat => cat !== 'deals');
    platformCoverage[platform] = platformCategories;
    
    platformCategories.forEach(cat => {
      if (categoryCoverage[cat]) {
        categoryCoverage[cat].push(platform);
      }
    });
  });
  
  console.log('\n🌐 PLATFORM CATEGORY COVERAGE:');
  console.log('-'.repeat(80));
  Object.entries(platformCoverage).forEach(([platform, categories]) => {
    console.log(`\n${platform.toUpperCase()}:`);
    console.log(`  Total Categories: ${categories.length}`);
    console.log(`  Categories: ${categories.join(', ')}`);
    console.log(`  Missing: ${REQUIRED_CATEGORIES.filter(cat => !categories.includes(cat)).join(', ') || 'None'}`);
  });
  
  console.log('\n📁 CATEGORY PLATFORM COVERAGE:');
  console.log('-'.repeat(80));
  Object.entries(categoryCoverage).forEach(([category, platforms]) => {
    const status = platforms.length === 4 ? '✅ Complete' : platforms.length > 0 ? '⚠️ Partial' : '❌ Missing';
    console.log(`\n${category}: ${status}`);
    console.log(`  Platforms: ${platforms.length > 0 ? platforms.join(', ') : 'NONE'}`);
    console.log(`  Missing from: ${['amazon', 'flipkart', 'myntra', 'ajio'].filter(p => !platforms.includes(p)).join(', ') || 'None'}`);
  });
  
  // Summary statistics
  console.log('\n📈 SUMMARY STATISTICS:');
  console.log('-'.repeat(80));
  const completeCategories = Object.values(categoryCoverage).filter(p => p.length === 4).length;
  const partialCategories = Object.values(categoryCoverage).filter(p => p.length > 0 && p.length < 4).length;
  const missingCategories = Object.values(categoryCoverage).filter(p => p.length === 0).length;
  
  console.log(`Total Required Categories: ${REQUIRED_CATEGORIES.length}`);
  console.log(`✅ Complete (all 4 platforms): ${completeCategories}`);
  console.log(`⚠️ Partial (some platforms): ${partialCategories}`);
  console.log(`❌ Missing (no platforms): ${missingCategories}`);
  
  return { platformCoverage, categoryCoverage };
}

async function checkExecutionTrackerStatus() {
  console.log('\n🔍 EXECUTION TRACKER STATUS:');
  console.log('='.repeat(80));
  
  const status = executionTracker.getCurrentStatus();
  
  console.log('\nCurrent Execution:');
  if (status.currentExecution) {
    const exec = status.currentExecution;
    console.log(`  ID: ${exec.id}`);
    console.log(`  Type: ${exec.type}`);
    console.log(`  Status: ${exec.status}`);
    console.log(`  Start Time: ${exec.startTime}`);
    console.log(`  Current Platform: ${exec.currentPlatform || 'N/A'}`);
    console.log(`  Current Category: ${exec.currentCategory || 'N/A'}`);
    console.log(`  Total Products: ${exec.totalProducts || 0}`);
    console.log(`  Total Processed: ${exec.totalProcessed || 0}`);
    
    if (exec.platforms && Object.keys(exec.platforms).length > 0) {
      console.log('\n  Platform Progress:');
      Object.entries(exec.platforms).forEach(([platform, platformData]) => {
        console.log(`    ${platform}:`);
        console.log(`      Total Products: ${platformData.totalProducts || 0}`);
        console.log(`      Processed: ${platformData.totalProcessed || 0}`);
        
        if (platformData.categories && Object.keys(platformData.categories).length > 0) {
          console.log(`      Categories (${Object.keys(platformData.categories).length}):`);
          Object.entries(platformData.categories).forEach(([category, catData]) => {
            const status = (catData.processed || 0) === (catData.totalProducts || 0) ? '✅' : '⏳';
            console.log(`        ${status} ${category}: ${catData.processed || 0}/${catData.totalProducts || 0}`);
          });
        }
      });
    } else {
      console.log('  No platform data yet');
    }
  } else {
    console.log('  ❌ No active execution');
  }
  
  console.log('\nTelegram Queue:');
  console.log(`  Pending: ${status.telegramQueue?.pending || 0}`);
  console.log(`  Processing: ${status.telegramQueue?.processing || 0}`);
  
  return status;
}

function analyzeExecutionFlow() {
  console.log('\n🔄 EXECUTION TRACKER FLOW ANALYSIS:');
  console.log('='.repeat(80));
  
  console.log(`
HOW IT WORKS:

1. BULK UPDATE START:
   - runBulkUpdateAll() calls executionTracker.startBulkExecution()
   - Creates execution object with:
     * id, type, status, startTime
     * platforms: {} (empty object initially)
     * currentPlatform: null
     * currentCategory: null

2. PLATFORM PROCESSING:
   - For each platform in PLATFORM_SEEDS:
     * runBulkUpdateForPlatform() processes all categories
   
3. CATEGORY PROCESSING:
   - For each category in platform:
     * runBulkUpdateForCategory() calls:
       - executionTracker.updateCurrentPlatform(platform, category)
         → Updates currentPlatform and currentCategory
         → Initializes platforms[platform] if needed
       - runBatch() extracts products
       - executionTracker.updateCategoryProgress(platform, category, progress)
         → Updates category stats (totalProducts, processed, created, updated)
         → Updates platform totals
         → Updates execution totals

4. PAGE/PRODUCT PROGRESS:
   - runBatch() calls extractAndStoreFromUrl() for each URL
   - extractAndStoreFromUrl() calls:
     * executionTracker.updatePageProgress(platform, category, url, pageIndex, progress)
     * executionTracker.updateProductProgress(platform, category, pageIndex, productCode, status)

5. COMPLETION:
   - executionTracker.completeBulkExecution(summary)
   - Moves execution to history
   - Clears currentExecution

UI DISPLAY REQUIREMENTS:
- ExecutionMonitor.tsx expects:
  * currentExecution.currentPlatform (string)
  * currentExecution.currentCategory (string)
  * currentExecution.platforms (object with platform keys)
  * currentExecution.platforms[platform].categories (object with category keys)
  * currentExecution.platforms[platform].categories[category].pages (object)

PipelineView.tsx expects:
  * execution.platforms (object)
  * execution.platforms[platform].totalProcessed
  * execution.platforms[platform].categories[category].processed
  * execution.platforms[platform].categories[category].pages[pageKey].products
  `);
}

async function main() {
  try {
    const coverage = analyzeCategoryCoverage();
    const status = await checkExecutionTrackerStatus();
    analyzeExecutionFlow();
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    // Check if execution is running
    if (!status.currentExecution) {
      console.log(`
⚠️ ISSUE IDENTIFIED:
- No active execution is currently running
- This could mean:
  1. Bulk update hasn't been started yet
  2. Bulk update completed and was moved to history
  3. Execution tracker was cleared

SOLUTION:
- Trigger a new bulk update via: POST /api/deals/manual-trigger
- Or run: node scripts/bulkUpdateAllPlatforms.js bulk website productdeals
      `);
    }
    
    // Check for missing categories
    const missingPlatforms = Object.entries(coverage.categoryCoverage)
      .filter(([cat, platforms]) => platforms.length < 4)
      .map(([cat, platforms]) => ({ category: cat, missing: ['amazon', 'flipkart', 'myntra', 'ajio'].filter(p => !platforms.includes(p)) }));
    
    if (missingPlatforms.length > 0) {
      console.log(`
⚠️ CATEGORIES WITH INCOMPLETE PLATFORM COVERAGE:
${missingPlatforms.map(({ category, missing }) => `  - ${category}: Missing from ${missing.join(', ')}`).join('\n')}
      `);
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCategoryCoverage, checkExecutionTrackerStatus };
