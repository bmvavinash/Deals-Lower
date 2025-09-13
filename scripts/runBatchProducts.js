const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('runBatchProducts');

const DEFAULT_SEEDS = [
	// Amazon
	'https://www.amazon.in/s?k=mobile+phones',
	'https://www.amazon.in/bestsellers',
	// Flipkart
	'https://www.flipkart.com/search?q=mobile',
	// Myntra
	'https://www.myntra.com/men-tshirts',
	// Ajio
	'https://www.ajio.com/men-tshirts/c/830216'
];

function parseArgs() {
	const args = process.argv.slice(2);
	const sourceType = (args[0] || 'website').toLowerCase();
	const categoryKey = args[1] || '';
	const seedsArg = args[2] || '';
	const seeds = seedsArg ? seedsArg.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_SEEDS;
	return { sourceType, categoryKey, seeds };
}

async function main() {
	try {
		const { sourceType, categoryKey, seeds } = parseArgs();
		logger.info('Starting batch products run', { sourceType, categoryKey, seedsCount: seeds.length });
		const result = await runBatch(seeds, sourceType, categoryKey);
		console.log('\n✅ Batch Extraction Complete');
		console.log(`📦 Pages processed: ${seeds.length}`);
		console.log(`📊 Products extracted: ${result.totalExtracted}`);
		console.log(`💾 Products stored: ${result.totalStored}`);
	} catch (error) {
		console.error('❌ runBatchProducts failed:', error.message);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}

module.exports = { DEFAULT_SEEDS };
