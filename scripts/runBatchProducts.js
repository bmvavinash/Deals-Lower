const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('runBatchProducts');

const DEFAULT_SEEDS = [
	'https://www.amazon.in',
	'https://www.amazon.in/deals',
	'https://www.amazon.in/bestsellers',
	'https://www.amazon.in/new-releases',
	'https://www.amazon.in/s?k=mobile+phones',
	'https://www.amazon.in/gp/browse.html?node=1389401031', // Mobiles & Accessories
	'https://www.amazon.in/gp/browse.html?node=976419031',  // Electronics
	'https://www.amazon.in/gp/browse.html?node=976442031',  // Home & Kitchen
	'https://www.amazon.in/gp/browse.html?node=976392031',  // Computers & Accessories
	'https://www.amazon.in/gp/browse.html?node=1380365031', // Large Appliances
	'https://www.amazon.in/gp/browse.html?node=1355016031', // Beauty & Personal Care
	'https://www.amazon.in/gp/browse.html?node=1968024031', // Fashion (Men)
	'https://www.amazon.in/gp/browse.html?node=1968253031', // Fashion (Women)
	'https://www.amazon.in/gp/browse.html?node=976389031',  // Books
	'https://www.amazon.in/gp/browse.html?node=1350380031', // Toys & Games
	'https://www.amazon.in/gp/browse.html?node=1984443031', // Sports & Outdoors
	'https://www.amazon.in/gp/browse.html?node=4859480031'  // Grocery & Gourmet Foods
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
