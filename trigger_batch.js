const { processAndPostBatchedDeals } = require('./services/batchDealsService.js');

async function testBatch() {
    console.log("Processing and posting batched deals...");
    await processAndPostBatchedDeals();
    console.log("Done.");
    process.exit(0);
}

testBatch();
