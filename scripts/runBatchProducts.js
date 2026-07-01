process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { runBatch } = require('../dataSources/batchProductExtractor');
const { getModuleLogger } = require('../logger/logger');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('runBatchProducts');

function getPlatformUrl(platform, searchTerm, page) {
	const encodedTerm = encodeURIComponent(searchTerm);
	switch(platform) {
		case 'amazon':
			return `https://www.amazon.in/s?k=${encodedTerm}&page=${page}`;
		case 'flipkart':
			return `https://www.flipkart.com/search?q=${encodedTerm}&page=${page}`;
		case 'myntra':
			// Myntra uses p=2
			return `https://www.myntra.com/${encodedTerm.replace(/\s+/g, '-')}${page > 1 ? `?p=${page}` : ''}`;
		case 'ajio':
			// Ajio pagination relies on API usually but we can append page param to query
			return `https://www.ajio.com/search/?text=${encodedTerm}${page > 1 ? `&page=${page}` : ''}`;
		default:
			return '';
	}
}

function loadPriorityConfig() {
	try {
		const configPath = path.join(__dirname, '../config/categoryPriority.json');
		if (!fs.existsSync(configPath)) return null;
		return JSON.parse(fs.readFileSync(configPath, 'utf8'));
	} catch (err) {
		logger.error('Error reading category priorities', { error: err.message });
		return null;
	}
}

/**
 * Build a flat, prioritized list of scrape jobs from the category config.
 * Each job carries enough context so that the batch runner can tag products correctly.
 * 
 * Returns: Array of { searchTerm, categoryId, subcategoryId, categoryKey, platforms }
 */
function getPrioritizedJobs(data) {
	const jobs = [];
	const defaultPlatforms = data.defaultPlatforms || ['amazon', 'flipkart'];
	const categories = (data.categories || []).slice().sort((a, b) => (a.priority || 999) - (b.priority || 999));

	for (const cat of categories) {
		const catPlatforms = cat.platforms || defaultPlatforms;
		const subcats = (cat.subcategories || []).slice().sort((a, b) => (a.priority || 999) - (b.priority || 999));

		for (const sub of subcats) {
			const platforms = sub.platforms || catPlatforms;
			// Build a categoryKey like "electronics_air-conditioners" for DB tagging
			const categoryKey = `${cat.id}_${sub.id.replace(/_/g, '-')}`;

			// Primary search term
			if (sub.searchTerm) {
				jobs.push({
					searchTerm: sub.searchTerm,
					categoryId: cat.id,
					subcategoryId: sub.id,
					categoryKey,
					categoryName: cat.name,
					subcategoryName: sub.name,
					platforms
				});
			}

			// Alternative search terms (lower priority – appended after primary)
			if (Array.isArray(sub.searchTermAlt)) {
				for (const alt of sub.searchTermAlt) {
					jobs.push({
						searchTerm: alt,
						categoryId: cat.id,
						subcategoryId: sub.id,
						categoryKey,
						categoryName: cat.name,
						subcategoryName: sub.name,
						platforms,
						isAlt: true
					});
				}
			}
		}
	}

	return jobs;
}

function parseArgs() {
	const args = process.argv.slice(2).filter(a => !a.startsWith('--platform='));
	const platformArg = process.argv.find(a => a.startsWith('--platform='))?.split('=')[1] || '';
	const sourceType = (args[0] || 'website').toLowerCase();
	const categoryKey = args[1] || '';
	const seedsArg = args[2] || '';
	
	return { sourceType, categoryKey, seedsArg, platformArg };
}

async function main() {
	try {
		const { sourceType, categoryKey, seedsArg, platformArg } = parseArgs();
		
		let customSeeds = [];
		if (seedsArg) {
			customSeeds = seedsArg.split(',').map(s => s.trim()).filter(Boolean);
		}

		// If manual seeds are provided, bypass multipass logic
		if (customSeeds.length > 0) {
			logger.info('Starting batch run with custom seeds', { seedsCount: customSeeds.length });
			await runBatch(customSeeds, sourceType, categoryKey, 'productdeals');
			console.log('\n✅ Batch Extraction Complete');
			process.exit(0);
		}

		// MULTIPASS BREADTH-FIRST LOGIC
		const configData = loadPriorityConfig();
		if (!configData) {
			logger.error('No configuration found. Exiting.');
			process.exit(1);
		}

		const maxPages = configData.maxPagesToScrape || 1;
		const jobs = getPrioritizedJobs(configData);

		// If a specific category was requested via CLI, filter jobs
		const filteredJobs = categoryKey
			? jobs.filter(j => j.categoryId === categoryKey || j.categoryKey.startsWith(categoryKey))
			: jobs;

		if (filteredJobs.length === 0) {
			logger.error(`No jobs found for category filter: "${categoryKey}". Available: ${[...new Set(jobs.map(j => j.categoryId))].join(', ')}`);
			process.exit(1);
		}

		let totalExtracted = 0;
		let totalStored = 0;

		logger.info(`🚀 Starting Category-First Breadth-First Sweep`, {
			maxPages,
			totalJobs: filteredJobs.length,
			primaryTerms: filteredJobs.filter(j => !j.isAlt).length,
			altTerms: filteredJobs.filter(j => j.isAlt).length,
			categoryFilter: categoryKey || 'ALL'
		});

		// Breadth-first: sweep all categories on page 1 first, then page 2, etc.
		for (let page = 1; page <= maxPages; page++) {
			logger.info(`\n=================== STARTING PAGE ${page} SWEEP ===================\n`);

			// For the first page, run ALL terms (primary + alt).
			// For subsequent pages, only run PRIMARY terms to save resources.
			const pageJobs = page === 1 ? filteredJobs : filteredJobs.filter(j => !j.isAlt);
			
			// Group jobs by categoryKey so we can run one batch per category
			const jobsByCategory = {};
			for (const job of pageJobs) {
				if (!jobsByCategory[job.categoryKey]) {
					jobsByCategory[job.categoryKey] = {
						categoryKey: job.categoryKey,
						categoryName: job.categoryName,
						subcategoryName: job.subcategoryName,
						seeds: []
					};
				}
				for (const platform of job.platforms) {
					if (platformArg && platform !== platformArg) continue;
					const url = getPlatformUrl(platform, job.searchTerm, page);
					if (url) {
						jobsByCategory[job.categoryKey].seeds.push(url);
					}
				}
			}

			// Execute each category batch sequentially
			for (const [catKey, batch] of Object.entries(jobsByCategory)) {
				if (batch.seeds.length === 0) continue;

				logger.info(`📦 [Page ${page}] Category: ${batch.categoryName} > ${batch.subcategoryName}`, {
					categoryKey: catKey,
					seedCount: batch.seeds.length,
					seeds: batch.seeds.map(s => s.substring(0, 80))
				});

				try {
					const result = await runBatch(batch.seeds, sourceType, catKey, 'productdeals');
					totalExtracted += result.totalExtracted || 0;
					totalStored += result.totalStored || 0;

					logger.info(`✅ [Page ${page}] Completed ${catKey}: ${result.totalExtracted || 0} extracted, ${result.totalStored || 0} stored`);
				} catch (batchErr) {
					logger.error(`❌ [Page ${page}] Failed ${catKey}`, { error: batchErr.message });
				}
			}

			logger.info(`=================== FINISHED PAGE ${page} SWEEP ===================`);
		}

		console.log('\n✅ Category-First Breadth-First Batch Extraction Complete');
		console.log(`📊 Total Products extracted: ${totalExtracted}`);
		console.log(`💾 Total Products stored: ${totalStored}`);
		process.exit(0);

	} catch (error) {
		console.error('❌ runBatchProducts failed:', error.message);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}

module.exports = { getPlatformUrl, loadPriorityConfig, getPrioritizedJobs };

