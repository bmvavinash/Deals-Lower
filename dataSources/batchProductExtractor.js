const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');
const { loadConfig, scrapePage } = require('../pageScheduler');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require('../utils/commonUtils');

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
	const hostname = (() => { try { return new URL(productUrl).hostname; } catch { return ''; } })();
	let productCode = '';
	if (/amazon\./i.test(hostname)) {
		productCode = getAsin(productUrl) || raw.asin || raw.productCode || '';
	} else if (/flipkart\./i.test(hostname)) {
		productCode = getFlipkartProductId(productUrl) || raw.productCode || '';
	} else if (/ajio\./i.test(hostname)) {
		productCode = getAjioCode(productUrl) || raw.productCode || '';
	} else if (/myntra\./i.test(hostname)) {
		productCode = getMyntraCode(productUrl) || raw.productCode || '';
	} else {
		productCode = raw.productCode || '';
	}
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
			
			// Clear memory after each attempt
			try {
				await driver.executeScript('if (window.gc) window.gc();');
			} catch {}
		} catch (error) {
			logger.error(`Error with ${pageType}`, { error: error.message, url });
			// Clear memory on error
			try {
				await driver.executeScript('if (window.gc) window.gc();');
			} catch {}
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

async function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error(`${label || 'TASK'}_TIMEOUT`)), ms))
	]);
}

async function extractAndStoreFromUrl(driver, url, sourceType = 'website', categoryKey = '', ctx = null, targetDb = 'deals') {
	try {
		logger.info('Batch extracting page', { url, sourceType, categoryKey });
		const config = await loadConfig('./PageConfig/amazonPageConfig.js');
		const { rawProducts, usedPageType } = await withTimeout(tryConfigs(url, driver, config), (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE');
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
		let createdCount = 0;
		let updatedCount = 0;
		try {
			const result = await withTimeout(
				productDealsDB.bulkUpsertProducts(uniqueProducts, targetDb),
				(require('../config/constants').maxPlatformTimeoutMs || 900000),
				'DB_UPSERT'
			);
			storedCount = result.count || uniqueProducts.length;
			createdCount = result.created || 0;
			updatedCount = result.updated || 0;
		} catch (e) {
			if (ctx) ctx.failedCount += uniqueProducts.length;
			throw e;
		}

		// Estimate unchanged as difference between unique and stored when DB returns fewer
		if (ctx && storedCount < uniqueProducts.length) {
			ctx.skippedUnchangedCount += (uniqueProducts.length - storedCount);
		}

		return { extracted: beforeCount, stored: storedCount, created: createdCount, updated: updatedCount };
	} catch (error) {
		logger.error('extractAndStoreFromUrl error', { url, error: error.message });
		if (ctx) ctx.errors.push({ url, error: error.message });
		return { extracted: 0, stored: 0, created: 0, updated: 0 };
	}
}

async function initializeDriver() {
	const options = new chrome.Options();
	options.addArguments('--headless=new');
	options.addArguments('--no-sandbox');
	options.addArguments('--disable-dev-shm-usage');
	options.addArguments('--window-size=1920,1080');
	options.addArguments('--disable-blink-features=AutomationControlled');
	options.addArguments('--disable-infobars');
	options.addArguments('--lang=en-US');
	options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
	options.excludeSwitches(['enable-automation']);
	
	// Memory optimization flags
	options.addArguments('--memory-pressure-off');
	options.addArguments('--disable-background-timer-throttling');
	options.addArguments('--disable-backgrounding-occluded-windows');
	options.addArguments('--disable-renderer-backgrounding');
	options.addArguments('--disable-features=TranslateUI');
	options.addArguments('--disable-ipc-flooding-protection');
	
	const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
	try {
		await driver.executeScript('Object.defineProperty(navigator, "webdriver", {get: () => undefined})');
	} catch {}
	return driver;
}

async function closeDriver(driver) {
	try { await driver.quit(); } catch {}
}

async function runBatch(seedUrls = [], sourceType = 'website', categoryKey = '', targetDb = 'deals') {
	let driver;
	// Context to persist summary details until termination
	const ctx = { noProductUrls: [], pageTypeHits: {}, missingFieldLogs: [], errors: [], dedupedCount: 0, skippedUnchangedCount: 0, failedCount: 0 };
	try {
		driver = await initializeDriver();
		let totalExtracted = 0, totalStored = 0, createdCount = 0, updatedCount = 0;
		for (const url of seedUrls) {
			await driver.get(url);
			await withTimeout(driver.wait(until.elementLocated(By.css('body')), 15000), (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE_WAIT');
			await driver.sleep(2000);
			const { extracted, stored, created, updated } = await extractAndStoreFromUrl(driver, url, sourceType, categoryKey, ctx, targetDb);
			totalExtracted += extracted;
			totalStored += stored;
			createdCount += created;
			updatedCount += updated;
			
			// Clear memory after each URL to prevent buildup
			try {
				await driver.executeScript('if (window.gc) window.gc();');
			} catch {}
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

		logger.info('Batch completed', { totalExtracted, totalStored, pages: seedUrls.length, created: createdCount, updated: updatedCount });
		return { totalExtracted, totalStored, pages: seedUrls.length, created: createdCount, updated: updatedCount, summary: ctx };
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
