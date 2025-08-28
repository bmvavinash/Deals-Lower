const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('testSystem');

async function testSystem() {
    console.log('🧪 Testing Batch Product Extraction System\n');

    try {
        // Test 1: Check module imports
        console.log('1️⃣ Testing Module Imports...');
        try {
            require('../dataSources/batchProductExtractor');
            require('../utils/enhancedBannerUtils');
            require('../dataSources/enhancedBannerExtractor');
            console.log('   ✅ All core modules imported successfully');
        } catch (error) {
            console.log('   ❌ Module import failed:', error.message);
        }
        
        // Test 2: Check scheduler
        console.log('\n2️⃣ Testing Scheduler...');
        try {
            const { hourlyScheduler } = require('../scheduler/hourlyScheduler');
            const status = hourlyScheduler.getStatus();
            console.log('   ✅ Scheduler accessible:', status);
        } catch (error) {
            console.log('   ❌ Scheduler test failed:', error.message);
        }
        
        // Test 3: Check enrichment processor
        console.log('\n3️⃣ Testing Enrichment Processor...');
        try {
            const { idleEnrichmentProcessor } = require('../dataSources/idleEnrichmentProcessor');
            const status = idleEnrichmentProcessor.getStatus();
            console.log('   ✅ Enrichment processor accessible:', status);
        } catch (error) {
            console.log('   ❌ Enrichment processor test failed:', error.message);
        }
        
        console.log('\n🎉 System Test Completed!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Install dependencies: npm install');
        console.log('   2. Run batch extraction: node scripts/runBatchProducts.js');
        console.log('   3. Start scheduler: node scripts/manageScheduler.js start');
        
    } catch (error) {
        console.error('\n❌ System Test Failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    testSystem();
}

module.exports = { testSystem };
