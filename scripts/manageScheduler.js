const { hourlyScheduler } = require('../scheduler/hourlyScheduler');
const { idleEnrichmentProcessor } = require('../dataSources/idleEnrichmentProcessor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('manageScheduler');

function showHelp() {
    console.log(`
🕐 Scheduler Management CLI

Usage: node scripts/manageScheduler.js <command> [options]

Commands:
  start                    Start the hourly scheduler
  stop                     Stop the hourly scheduler
  status                   Show scheduler status
  enrich [options]         Start idle enrichment processing
  enrich-stop              Stop idle enrichment processing
  enrich-status            Show enrichment status
  manual-product           Manually trigger product extraction
  manual-banner            Manually trigger banner extraction

Enrichment Options:
  --batch-size <number>    Products per batch (default: 10)
  --delay <ms>             Delay between products in ms (default: 2000)
  --max <number>           Maximum products to process (default: 100)
  --all                    Process all products, not just missing fields

Examples:
  node scripts/manageScheduler.js start
  node scripts/manageScheduler.js enrich --batch-size 20 --max 50
  node scripts/manageScheduler.js status
  node scripts/manageScheduler.js enrich-stop
`);
}

function parseEnrichOptions(args) {
    const options = {
        batchSize: 10,
        delayBetweenProducts: 2000,
        maxProducts: 100,
        onlyMissingFields: true
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--batch-size':
                options.batchSize = parseInt(args[++i]) || 10;
                break;
            case '--delay':
                options.delayBetweenProducts = parseInt(args[++i]) || 2000;
                break;
            case '--max':
                options.maxProducts = parseInt(args[++i]) || 100;
                break;
            case '--all':
                options.onlyMissingFields = false;
                break;
        }
    }

    return options;
}

async function handleCommand(command, args = []) {
    try {
        switch (command) {
            case 'start':
                await hourlyScheduler.start();
                console.log('✅ Hourly scheduler started successfully');
                break;

            case 'stop':
                await hourlyScheduler.stop();
                console.log('✅ Hourly scheduler stopped successfully');
                break;

            case 'status':
                const status = hourlyScheduler.getStatus();
                console.log('\n📊 Scheduler Status:');
                console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
                console.log(`   Active Jobs: ${status.activeJobs.join(', ') || 'None'}`);
                console.log(`   Next Product Extraction: ${status.nextProductExtraction}`);
                console.log(`   Next Banner Extraction: ${status.nextBannerExtraction}`);
                break;

            case 'enrich':
                const options = parseEnrichOptions(args);
                console.log('🚀 Starting idle enrichment processing...');
                console.log(`   Batch Size: ${options.batchSize}`);
                console.log(`   Delay: ${options.delayBetweenProducts}ms`);
                console.log(`   Max Products: ${options.maxProducts}`);
                console.log(`   Only Missing Fields: ${options.onlyMissingFields ? 'Yes' : 'No'}`);
                
                const result = await idleEnrichmentProcessor.startProcessing(options);
                console.log('\n✅ Enrichment completed:');
                console.log(`   Processed: ${result.processed}`);
                console.log(`   Updated: ${result.updated}`);
                console.log(`   Errors: ${result.errors}`);
                break;

            case 'enrich-stop':
                idleEnrichmentProcessor.stopProcessing();
                console.log('✅ Idle enrichment processing stopped');
                break;

            case 'enrich-status':
                const enrichStatus = idleEnrichmentProcessor.getStatus();
                console.log('\n📊 Enrichment Status:');
                console.log(`   Processing: ${enrichStatus.isProcessing ? '✅ Yes' : '❌ No'}`);
                console.log(`   Processed: ${enrichStatus.processedCount}`);
                console.log(`   Updated: ${enrichStatus.updatedCount}`);
                console.log(`   Errors: ${enrichStatus.errorCount}`);
                break;

            case 'manual-product':
                console.log('🔄 Manually triggering product extraction...');
                await hourlyScheduler.triggerProductExtraction();
                console.log('✅ Manual product extraction completed');
                break;

            case 'manual-banner':
                console.log('🔄 Manually triggering banner extraction...');
                await hourlyScheduler.triggerBannerExtraction();
                console.log('✅ Manual banner extraction completed');
                break;

            case 'help':
            case '--help':
            case '-h':
                showHelp();
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log('Use "help" to see available commands');
                process.exit(1);
        }

    } catch (error) {
        console.error(`❌ Command failed: ${error.message}`);
        logger.error('Command execution failed:', error);
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        showHelp();
        return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    await handleCommand(command, commandArgs);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        logger.error('Fatal error in main:', error);
        process.exit(1);
    });
}

module.exports = { handleCommand };
