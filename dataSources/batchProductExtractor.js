const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');
const { loadConfig, scrapePage } = require('../pageScheduler');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getAsin } = require('../utils/commonUtils');

const logger = getModuleLogger('batchProductExtractor');

function deriveSectionName(url, usedPageType) {
	if (/bestseller/i.test(url) || /bestsellers/i.test(url)) return 'BestSellers';
	if (/new-releases/i.test(url)) return 'NewReleases';
	switch (usedPageType) {
		case 'searchPage': return 'SearchResults';
		case 'dealsGridPage': return 'DealsGrid';
		case 'carouselPage': return 'Carousel';
		case 'bestCarouselPage': return 'BestCarousel';
		default: return 'Unknown';
	}
}

function deriveDealName(raw) {
	if (raw.deal && typeof raw.deal === 'string') return raw.deal;
	if (raw.discountPercentage && typeof raw.discountPercentage === 'string') return raw.discountPercentage;
	return '';
}

function normalizeProduct(raw, url, sourceType = 'website', categoryKey = '', usedPageType = null) {
	const productUrl = raw.productUrl || url || '';
	const productCode = getAsin(productUrl) || raw.asin || raw.productCode || '';
	const now = new Date();
	const isoNow = now.toISOString();
	const dateOnly = isoNow.slice(0, 10);
	const links = raw.links || {};
	links.avinashbmvINR = `https://inrdeals.com/avi646476329/+${productUrl}`;

	const normalized = {
		brand: raw.brand || '',
		title: raw.name || raw.title || '',
		price: raw.discountedPrice || raw.price || '',
		originalPrice: raw.originalPrice || raw.mrp || '',
		discountPercentage: raw.discountPercentage || raw.discount || '',
		rating: raw.rating || '',
		ratingsCount: raw.ratingsCount || '',
		coupon: raw.couponAmount || raw.coupon || '',
		photo: raw.productImage || raw.photo || '',
		images: raw.images || [],
		productCode,
		productUrl,
		links,
		categoryKey,
		categoryPath: raw.categoryPath || [],
		sourceType,
		storeType: 'Amazon',
		creationTimestamp: isoNow,
		updateTimestamp: isoNow,
		date: dateOnly,
		datetime: isoNow,
		dealName: deriveDealName(raw),
		sectionName: deriveSectionName(productUrl || url, usedPageType || '')
	};
	const requiredFields = ['productCode', 'price', 'discountPercentage'];
	requiredFields.forEach(field => {
		const val = normalized[field];
		if (!val || val === 'NA') {
			logger.error('Required field missing', { field, url: productUrl, productCode: normalized.productCode || '' });
		}
	});
	['title','photo','productUrl'].forEach(field => {
		const val = normalized[field];
		if (val === '' || val === undefined || val === 'NA') {
			logger.warn(`Missing field: ${field}`, { url: productUrl, field });
		}
	});
	return normalized;
}

async function tryConfigs(url, driver, config) {
	const pageTypes = ['searchPage', 'dealsGridPage', 'carouselPage', 'bestCarouselPage'];
	for (const pageType of pageTypes) {
		try {
			const rawProducts = await scrapePage(url, driver, config, pageType);
			if (Array.isArray(rawProducts) && rawProducts.length > 0) {
				logger.info(`Extracted products using ${pageType}`, { count: rawProducts.length, url });
				return { rawProducts, usedPageType: pageType };
			}
			logger.debug(`No results with ${pageType}`);
		} catch (error) {
			logger.debug(`scrapePage failed for ${pageType}: ${error.message}`);
		}
	}
	return { rawProducts: [], usedPageType: null };
}

function dedupeByProductCode(products) {
	const map = new Map();
	for (const p of products) {
		if (!p.productCode) continue;
		if (!map.has(p.productCode)) map.set(p.productCode, p);
	}
	return Array.from(map.values());
}

async function extractAndStoreFromUrl(driver, url, sourceType = 'website', categoryKey = '', ctx = null) {
	try {
		logger.info('Batch extracting page', { url, sourceType, categoryKey });
		const config = await loadConfig('./PageConfig/amazonPageConfig.js');
		const { rawProducts, usedPageType } = await tryConfigs(url, driver, config);
		if (ctx) {
			ctx.pageTypeHits[usedPageType || 'none'] = (ctx.pageTypeHits[usedPageType || 'none'] || 0) + 1;
		}
		const products = Array.isArray(rawProducts) ? rawProducts.map(p => normalizeProduct(p, url, sourceType, categoryKey, usedPageType)) : [];
		if (products.length === 0) {
			logger.warn('No products extracted', { url });
			if (ctx) ctx.noProductUrls.push(url);
			return { extracted: 0, stored: 0 };
		}

		// Deduplicate by productCode for accurate counts
		const beforeCount = products.length;
		const uniqueProducts = dedupeByProductCode(products);
		const deduped = beforeCount - uniqueProducts.length;
		if (ctx) ctx.dedupedCount += deduped;

		// Accumulate missing field info for consolidated summary
		if (ctx) {
			for (const p of uniqueProducts) {
				['productCode','price','discountPercentage','title','photo','productUrl'].forEach(field => {
					const val = p[field];
					if (!val || val === 'NA') {
						ctx.missingFieldLogs.push({ field, productCode: p.productCode, url: p.productUrl || url });
					}
				});
			}
		}

		let storedCount = 0;
		try {
			const result = await productDealsDB.bulkUpsertProducts(uniqueProducts);
			storedCount = result.count || uniqueProducts.length;
		} catch (e) {
			if (ctx) ctx.failedCount += uniqueProducts.length;
			throw e;
		}

		// Estimate unchanged as difference between unique and stored when DB returns fewer
		if (ctx && storedCount < uniqueProducts.length) {
			ctx.skippedUnchangedCount += (uniqueProducts.length - storedCount);
		}

		return { extracted: beforeCount, stored: storedCount };
	} catch (error) {
		logger.error('extractAndStoreFromUrl error', { url, error: error.message });
		if (ctx) ctx.errors.push({ url, error: error.message });
		return { extracted: 0, stored: 0 };
	}
}

async function initializeDriver() {
	const options = new chrome.Options();
	options.addArguments('--headless');
	options.addArguments('--no-sandbox');
	options.addArguments('--disable-dev-shm-usage');
	options.addArguments('--window-size=1920,1080');
	return await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function closeDriver(driver) {
	try { await driver.quit(); } catch {}
}

async function runBatch(seedUrls = [], sourceType = 'website', categoryKey = '') {
	let driver;
	// Context to persist summary details until termination
	const ctx = { noProductUrls: [], pageTypeHits: {}, missingFieldLogs: [], errors: [], dedupedCount: 0, skippedUnchangedCount: 0, failedCount: 0 };
	try {
		driver = await initializeDriver();
		let totalExtracted = 0, totalStored = 0;
		for (const url of seedUrls) {
			await driver.get(url);
			await driver.wait(until.elementLocated(By.css('body')), 15000);
			await driver.sleep(2000);
			const { extracted, stored } = await extractAndStoreFromUrl(driver, url, sourceType, categoryKey, ctx);
			totalExtracted += extracted;
			totalStored += stored;
		}

		// Consolidated summary logging before termination
		logger.info('Batch extraction summary', {
			totalExtracted,
			totalStored,
			pages: seedUrls.length,
			noProductUrls: ctx.noProductUrls,
			pageTypeHits: ctx.pageTypeHits,
			missingFieldSamples: ctx.missingFieldLogs.slice(0, 20),
			missingFieldTotal: ctx.missingFieldLogs.length,
			dedupedCount: ctx.dedupedCount,
			skippedUnchangedCount: ctx.skippedUnchangedCount,
			failedCount: ctx.failedCount,
			errors: ctx.errors
		});

		logger.info('Batch completed', { totalExtracted, totalStored, pages: seedUrls.length });
		return { totalExtracted, totalStored, pages: seedUrls.length, summary: ctx };
	} catch (error) {
		logger.error('runBatch error', { error: error.message });
		throw error;
	} finally {
		if (driver) await closeDriver(driver);
	}
}

function buildSearchUrl(query) {
	const q = encodeURIComponent(query);
	return `https://www.amazon.in/s?k=${q}`;
}

async function runSearchBatch(queries = [], sourceType = 'website') {
	const urls = queries.map(buildSearchUrl);
	return await runBatch(urls, sourceType, '');
}

module.exports = { runBatch, extractAndStoreFromUrl, normalizeProduct, initializeDriver, closeDriver, runSearchBatch };
