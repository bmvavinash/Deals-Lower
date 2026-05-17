const { executionTracker } = require('../services/executionTracker');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('analyzeExecutionStatus');

async function analyzeExecutionStatus() {
  try {
    console.log('\n=== EXECUTION STATUS ANALYSIS ===\n');
    
    const status = executionTracker.getCurrentStatus();
    
    // Analyze Bulk Updates
    if (status.currentExecution && status.currentExecution.type === 'bulk_update') {
      const execution = status.currentExecution;
      console.log('📊 BULK UPDATE STATUS:');
      console.log(`   Execution ID: ${execution.id}`);
      console.log(`   Status: ${execution.status}`);
      console.log(`   Current Platform: ${execution.currentPlatform || 'N/A'}`);
      console.log(`   Current Category: ${execution.currentCategory || 'N/A'}`);
      console.log(`   Start Time: ${execution.startTime}`);
      console.log(`   Last Update: ${execution.lastUpdate || 'N/A'}`);
      console.log(`   Total Products: ${execution.totalProducts || 0}`);
      console.log(`   Total Processed: ${execution.totalProcessed || 0}`);
      console.log(`   Total Created: ${execution.totalCreated || 0}`);
      console.log(`   Total Updated: ${execution.totalUpdated || 0}`);
      console.log('');
      
      // Analyze by Platform
      if (execution.platforms && typeof execution.platforms === 'object') {
        console.log('📦 PLATFORM BREAKDOWN:');
        const platforms = Object.keys(execution.platforms);
        console.log(`   Total Platforms: ${platforms.length}`);
        console.log(`   Platforms: ${platforms.join(', ')}`);
        console.log('');
        
        for (const [platform, platformData] of Object.entries(execution.platforms)) {
          console.log(`   🔹 ${platform.toUpperCase()}:`);
          console.log(`      Total Products: ${platformData.totalProducts || 0}`);
          console.log(`      Processed: ${platformData.totalProcessed || 0}`);
          console.log(`      Created: ${platformData.totalCreated || 0}`);
          console.log(`      Updated: ${platformData.totalUpdated || 0}`);
          
          if (platformData.categories && typeof platformData.categories === 'object') {
            const categories = Object.keys(platformData.categories);
            console.log(`      Categories: ${categories.length}`);
            
            // Categorize by status
            const running = [];
            const completed = [];
            const pending = [];
            const zeroProducts = [];
            
            for (const [category, categoryData] of Object.entries(platformData.categories)) {
              const total = categoryData.totalProducts || 0;
              const processed = categoryData.processed || 0;
              
              if (total === 0 && processed === 0) {
                zeroProducts.push(category);
              } else if (processed < total) {
                running.push({ category, total, processed, created: categoryData.created || 0, updated: categoryData.updated || 0 });
              } else if (total > 0 && processed >= total) {
                completed.push({ category, total, processed, created: categoryData.created || 0, updated: categoryData.updated || 0 });
              } else {
                pending.push(category);
              }
            }
            
            if (running.length > 0) {
              console.log(`      🟢 RUNNING (${running.length}):`);
              running.forEach(({ category, total, processed, created, updated }) => {
                console.log(`         - ${category}: ${processed}/${total} (Created: ${created}, Updated: ${updated})`);
              });
            }
            
            if (completed.length > 0) {
              console.log(`      ✅ COMPLETED (${completed.length}):`);
              completed.forEach(({ category, total, processed, created, updated }) => {
                console.log(`         - ${category}: ${processed}/${total} (Created: ${created}, Updated: ${updated})`);
              });
            }
            
            if (zeroProducts.length > 0) {
              console.log(`      ⚠️  ZERO PRODUCTS (${zeroProducts.length}):`);
              zeroProducts.forEach(category => {
                console.log(`         - ${category}: 0/0 (No products extracted)`);
              });
            }
            
            if (pending.length > 0) {
              console.log(`      ⏳ PENDING (${pending.length}):`);
              pending.forEach(category => {
                console.log(`         - ${category}`);
              });
            }
          }
          console.log('');
        }
      } else {
        console.log('   ⚠️  No platform data available');
      }
    } else {
      console.log('📊 BULK UPDATE STATUS: Not running');
    }
    
    // Analyze Telegram Bot
    if (status.currentExecution && status.currentExecution.type === 'telegram_bot') {
      const execution = status.currentExecution;
      console.log('🤖 TELEGRAM BOT STATUS:');
      console.log(`   Execution ID: ${execution.id}`);
      console.log(`   Status: ${execution.status}`);
      console.log(`   Start Time: ${execution.startTime}`);
      console.log(`   Messages Total: ${execution.messages?.total || 0}`);
      console.log(`   Messages Processed: ${execution.messages?.processed || 0}`);
      console.log(`   Messages Failed: ${execution.messages?.failed || 0}`);
      console.log(`   Products Total: ${execution.products?.total || 0}`);
      console.log(`   Products Processed: ${execution.products?.processed || 0}`);
      console.log(`   Products Created: ${execution.products?.created || 0}`);
      console.log(`   Products Updated: ${execution.products?.updated || 0}`);
      console.log(`   Products Failed: ${execution.products?.failed || 0}`);
      
      if (execution.products?.byPlatform && Object.keys(execution.products.byPlatform).length > 0) {
        console.log(`   By Platform:`);
        for (const [platform, platformData] of Object.entries(execution.products.byPlatform)) {
          console.log(`      - ${platform}: ${platformData.processed || 0} processed (${platformData.created || 0} created, ${platformData.updated || 0} updated)`);
        }
      }
    } else {
      console.log('🤖 TELEGRAM BOT STATUS: Not running or not tracked');
      console.log(`   Queue Status: ${JSON.stringify(status.telegramQueue, null, 2)}`);
    }
    
    console.log('\n=== END OF ANALYSIS ===\n');
    
  } catch (error) {
    logger.error('Error analyzing execution status', { error: error.message, stack: error.stack });
    console.error('❌ Error:', error.message);
  }
}

// Run analysis
analyzeExecutionStatus().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
