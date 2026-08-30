const { Builder, By, until } = require('selenium-webdriver');
// require('chromedriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');
const { loadConfig, scrapePage, postProcessProductData } = require('../pageScheduler');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { executionTracker } = require('../services/executionTracker');
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require('../utils/commonUtils');
const { findMatchingHierarchy, generateHierarchicalKey } = require('../config/categoryHierarchy');
const { DynamicCategoryExtractor } = require('../utils/dynamicCategoryExtractor');
const { missingDetailsTracker } = require('../utils/missingDetailsTracker');
const { storeMap } = require('../config/const');
// #region agent log
fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchProductExtractor.js:11',message:'storeMap import check',data:{storeMap_type:typeof storeMap,storeMap_isUndefined:storeMap===undefined,storeMap_keys:storeMap?Object.keys(storeMap).join(','):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
// #endregion

// Validate storeMap at module load time
if (!storeMap || typeof storeMap !== 'object') {
    const constModule = require('../config/const');
    const errorMsg = `CRITICAL: storeMap is not available in batchProductExtractor.js. constModule: ${JSON.stringify(Object.keys(constModule || {}))}, storeMap type: ${typeof storeMap}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
}

const logger = getModuleLogger('batchProductExtractor');
const dynamicCategoryExtractor = new DynamicCategoryExtractor();

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
	if (raw.deal && typeof raw.deal === 'string' && raw.deal.trim() !== '') return raw.deal;
	if (raw.limitedTimeDeal && typeof raw.limitedTimeDeal === 'string' && raw.limitedTimeDeal.trim() !== '') return raw.limitedTimeDeal;
	if (raw.isDeal && typeof raw.isDeal === 'string' && raw.isDeal.trim() !== '') return raw.isDeal;
	return '';
}

function parseTimerText(text) {
	if (!text || typeof text !== 'string') return null;
	const clean = text.toLowerCase().replace(/ends\s*in|ending\s*in/i, '').trim();
	const parts = clean.match(/(\d+)\s*(?:d|day|days)?\s*:\s*(\d+)\s*(?:h|hour|hours)?\s*:\s*(\d+)\s*(?:m|minute|minutes)?(?:\s*:\s*(\d+)\s*(?:s|second|seconds)?)?/i);
	if (parts) {
		let days = 0, hours = 0, minutes = 0, seconds = 0;
		if (parts[4] !== undefined) {
			days = parseInt(parts[1], 10) || 0;
			hours = parseInt(parts[2], 10) || 0;
			minutes = parseInt(parts[3], 10) || 0;
			seconds = parseInt(parts[4], 10) || 0;
		} else {
			const colons = clean.split(':').map(s => parseInt(s.trim(), 10) || 0);
			if (colons.length === 3) {
				hours = colons[0];
				minutes = colons[1];
				seconds = colons[2];
			} else if (colons.length === 2) {
				hours = colons[0];
				minutes = colons[1];
			}
		}
		const totalMs = (days * 24 * 3600 + hours * 3600 + minutes * 60 + seconds) * 1000;
		if (totalMs > 0) return Date.now() + totalMs;
	}
	const hrMatch = clean.match(/(\d+)\s*(?:h|hour|hours)/);
	const minMatch = clean.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
	const secMatch = clean.match(/(\d+)\s*(?:s|sec|secs|second|seconds)/);
	let totalMs = 0;
	if (hrMatch) totalMs += parseInt(hrMatch[1], 10) * 3600 * 1000;
	if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60 * 1000;
	if (secMatch) totalMs += parseInt(secMatch[1], 10) * 1000;
	if (totalMs > 0) return Date.now() + totalMs;
	return null;
}

async function extractPageTimer(driver, platform) {
	try {
		const timerText = await driver.executeScript(() => {
			const selectors = [
				'span[id*="timer"]',
				'span[class*="timer"]',
				'div[class*="timer"]',
				'span[id*="expiry"]',
				'div[class*="expiry"]',
				'.deal-timer',
				'._cDEzb_savingsBadgeMessage_2JUtl'
			];
			for (const sel of selectors) {
				const el = document.querySelector(sel);
				if (el && el.innerText && /ends\s*in|\d+\s*h\s*:\s*\d+\s*m|\d{2}\s*:\s*\d{2}\s*:\s*\d{2}/i.test(el.innerText)) {
					return el.innerText;
				}
			}
			const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
			let node;
			while (node = walk.nextNode()) {
				const txt = node.nodeValue;
				if (txt && /ends\s*in|\d+\s*h\s*:\s*\d+\s*m|\d{2}\s*:\s*\d{2}\s*:\s*\d{2}/i.test(txt)) {
					const parent = node.parentElement;
					if (parent && !['SCRIPT', 'STYLE'].includes(parent.tagName)) {
						return parent.innerText || txt;
					}
				}
			}
			return null;
		});
		if (timerText) {
			const lines = timerText.split('\n');
			for (const line of lines) {
				if (/ends\s*in|\d+\s*h\s*:\s*\d+\s*m|\d{2}\s*:\s*\d{2}\s*:\s*\d{2}/i.test(line)) {
					return line.trim();
				}
			}
		}
	} catch (e) {
		// ignore
	}
	return null;
}

function checkMissingDetails(product, sourceUrl) {
	const missingFields = [];
	const criticalFields = ['title', 'brand', 'price', 'originalPrice', 'discountPercentage'];
	
	criticalFields.forEach(field => {
		const value = product[field];
		if (!value || value === '' || value === 'undefined' || value === 'NA' || value === null) {
			missingFields.push(field);
		}
	});

	// Track if there are missing details
	if (missingFields.length > 0) {
		missingDetailsTracker.trackProduct(sourceUrl, product, missingFields);
		logger.debug('Product has missing details', {
			productCode: product.productCode || product.asin,
			missingFields,
			sourceUrl
		});
	}

	return missingFields;
}

function getManualCategoryFallback(raw, sourceType, categoryKey) {
	// Extract category from categoryKey (e.g., 'amazon_electronics' -> 'electronics')
	const categoryFromKey = categoryKey.split('_').pop() || 'general';
	
	// Set categoryGroup for database queries (required for frontend filtering)
	// categoryGroup should be lowercase, hyphenated (e.g., 'home-kitchen', 'beauty-personal-care')
	const categoryGroup = categoryFromKey.toLowerCase();
	
	// Try to extract meaningful categories from product data
	const extractedCategory = extractCategoryFromProductData(raw, sourceType, categoryFromKey);
	
	if (extractedCategory && extractedCategory.mainCategory !== 'Unknown') {
		return {
			...extractedCategory,
			confidence: 40, // Medium confidence for intelligent extraction
			source: 'intelligent-fallback'
		};
	}

	// Manual category mapping based on source type and category key
	const manualMappings = {
		'amazon': {
			'deals': { mainCategory: 'Electronics', subcategory: 'Deals', style: 'Special Offers' },
			'electronics': { mainCategory: 'Electronics', subcategory: 'Gadgets', style: 'General' },
			'fashion': { mainCategory: 'Fashion', subcategory: 'Clothing', style: 'General' },
			'home': { mainCategory: 'Home & Garden', subcategory: 'Furniture', style: 'General' }
		},
		'flipkart': {
			'electronics': { mainCategory: 'Electronics', subcategory: 'Gadgets', style: 'General' },
			'fashion': { mainCategory: 'Fashion', subcategory: 'Clothing', style: 'General' },
			'home': { mainCategory: 'Home & Garden', subcategory: 'Furniture', style: 'General' }
		},
		'myntra': {
			'fashion': { mainCategory: 'Fashion', subcategory: 'Clothing', style: 'General' },
			'accessories': { mainCategory: 'Fashion', subcategory: 'Accessories', style: 'General' }
		},
		'ajio': {
			'fashion': { mainCategory: 'Fashion', subcategory: 'Clothing', style: 'General' },
			'accessories': { mainCategory: 'Fashion', subcategory: 'Accessories', style: 'General' }
		}
	};
	
	// Get mapping for this source type
	const sourceMappings = manualMappings[sourceType] || {};
	const mapping = sourceMappings[categoryFromKey] || sourceMappings['general'];
	
	if (mapping) {
		return {
			...mapping,
			confidence: 30, // Low confidence for manual fallback
			source: 'manual'
		};
	}

	// Ultimate fallback
	return {
		mainCategory: 'General',
		subcategory: 'Products',
		style: 'General',
		confidence: 10,
		source: 'manual-fallback'
	};
}

function extractCategoryFromProductData(raw, sourceType, categoryFromKey) {
	const title = (raw.name || raw.title || '').toLowerCase();
	const brand = (raw.brand || '').toLowerCase();
	const description = (raw.description || '').toLowerCase();
	const productUrl = (raw.productUrl || '').toLowerCase();
	
	if (categoryFromKey === 'air-conditioners' || categoryFromKey === 'air_conditioners') {
		return { mainCategory: 'Electronics', subcategory: 'Air Conditioners', style: 'General' };
	}
	if (categoryFromKey === 'coolers') {
		return { mainCategory: 'Electronics', subcategory: 'Air Coolers', style: 'General' };
	}
	if (categoryFromKey === 'laptops') {
		return { mainCategory: 'Electronics', subcategory: 'Laptops', style: 'General' };
	}
	if (categoryFromKey === 'washing-machines' || categoryFromKey === 'washing_machines') {
		return { mainCategory: 'Home Appliances', subcategory: 'Washing Machines', style: 'General' };
	}
	if (categoryFromKey === 'refrigerators') {
		return { mainCategory: 'Home Appliances', subcategory: 'Refrigerators', style: 'General' };
	}
	if (categoryFromKey === 'tvs') {
		return { mainCategory: 'Electronics', subcategory: 'Televisions', style: 'General' };
	}
	
	// Extract category hints from URL
	const urlCategoryHints = extractCategoryFromUrl(productUrl, sourceType);
	
	// Combine all text for analysis
	const allText = `${title} ${brand} ${description} ${productUrl} ${urlCategoryHints.join(' ')}`.toLowerCase();
	
	// Footwear detection
	if (isFootwear(allText, title, brand)) {
		return extractFootwearCategory(allText, title, brand);
	}
	
	// Electronics detection
	if (isElectronics(allText, title, brand)) {
		return extractElectronicsCategory(allText, title, brand);
	}
	
	// Fashion detection
	if (isFashion(allText, title, brand)) {
		return extractFashionCategory(allText, title, brand);
	}
	
	// Home & Garden detection
	if (isHomeGarden(allText, title, brand)) {
		return extractHomeGardenCategory(allText, title, brand);
	}
	
	// Beauty & Personal Care detection
	if (isBeautyPersonalCare(allText, title, brand)) {
		return extractBeautyCategory(allText, title, brand);
	}
	
	// Sports & Fitness detection
	if (isSportsFitness(allText, title, brand)) {
		return extractSportsCategory(allText, title, brand);
	}
	
	return null;
}

function isFootwear(allText, title, brand) {
	const footwearKeywords = [
		'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals',
		'loafer', 'loafers', 'slipper', 'slippers', 'heel', 'heels', 'pump', 'pumps',
		'oxford', 'oxfords', 'moccasin', 'moccasins', 'clog', 'clogs', 'flip', 'flops',
		'athletic', 'running', 'walking', 'casual', 'formal', 'dress', 'hiking',
		'canvas', 'leather', 'rubber', 'synthetic', 'mesh', 'suede'
	];
	
	return footwearKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText));
}

function extractFootwearCategory(allText, title, brand) {
	let mainCategory = 'Footwear';
	let subcategory = 'Shoes';
	let style = 'General';
	
	// Determine gender
	const isMen = allText.includes('men') || allText.includes('male') || allText.includes('boy');
	const isWomen = allText.includes('women') || allText.includes('female') || allText.includes('girl') || allText.includes('ladies');
	const isUnisex = allText.includes('unisex') || allText.includes('unisex');
	
	if (isMen && !isWomen) {
		style = 'Men';
	} else if (isWomen && !isMen) {
		style = 'Women';
	} else if (isUnisex) {
		style = 'Unisex';
	} else {
		// Try to infer from brand or other context
		const menBrands = ['nike', 'adidas', 'puma', 'reebok', 'new balance', 'converse'];
		const womenBrands = ['heels', 'pumps', 'stilettos'];
		
		if (menBrands.some(b => brand.includes(b) || allText.includes(b))) {
			style = 'Men';
		} else if (womenBrands.some(b => allText.includes(b))) {
			style = 'Women';
		} else {
			style = 'Unisex';
		}
	}
	
	// Determine shoe type
	if (allText.includes('sneaker') || allText.includes('athletic') || allText.includes('running') || allText.includes('sport')) {
		subcategory = 'Sneakers';
	} else if (allText.includes('boot') || allText.includes('hiking') || allText.includes('work')) {
		subcategory = 'Boots';
	} else if (allText.includes('sandal') || allText.includes('flip') || allText.includes('flop')) {
		subcategory = 'Sandals';
	} else if (allText.includes('heel') || allText.includes('pump') || allText.includes('dress')) {
		subcategory = 'Dress Shoes';
	} else if (allText.includes('loafer') || allText.includes('oxford') || allText.includes('formal')) {
		subcategory = 'Formal Shoes';
	} else if (allText.includes('slipper') || allText.includes('casual')) {
		subcategory = 'Casual Shoes';
	}
	
	return { mainCategory, subcategory, style };
}

function isElectronics(allText, title, brand) {
	const electronicsKeywords = [
		'phone', 'smartphone', 'mobile', 'tablet', 'laptop', 'computer', 'pc', 'desktop',
		'headphone', 'earphone', 'speaker', 'bluetooth', 'wireless', 'charger', 'cable',
		'camera', 'lens', 'tripod', 'memory', 'storage', 'usb', 'hdmi', 'adapter',
		'router', 'modem', 'wifi', 'ethernet', 'monitor', 'display', 'screen',
		'keyboard', 'mouse', 'webcam', 'microphone', 'gaming', 'console', 'controller',
		'smartwatch', 'fitness', 'tracker', 'watch', 'band', 'device', 'gadget',
		'electronic', 'digital', 'smart', 'tech', 'technology'
	];
	
	return electronicsKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText)) || allText.includes('ac ') || allText.includes('air conditioner');
}

function extractElectronicsCategory(allText, title, brand) {
	let mainCategory = 'Electronics';
	let subcategory = 'Gadgets';
	let style = 'General';
	
	// Determine subcategory
	if (allText.includes('phone') || allText.includes('smartphone') || allText.includes('mobile')) {
		subcategory = 'Mobile Phones';
	} else if (allText.includes('laptop') || allText.includes('computer') || allText.includes('pc')) {
		subcategory = 'Computers';
	} else if (allText.includes('headphone') || allText.includes('earphone') || allText.includes('speaker')) {
		subcategory = 'Audio';
	} else if (allText.includes('camera') || allText.includes('lens')) {
		subcategory = 'Cameras';
	} else if (allText.includes('watch') || allText.includes('smartwatch')) {
		subcategory = 'Wearables';
	} else if (allText.includes('gaming') || allText.includes('console')) {
		subcategory = 'Gaming';
	} else if (allText.includes('home') || allText.includes('appliance')) {
		subcategory = 'Home Appliances';
	}
	
	// Determine style/brand
	if (allText.includes('apple') || allText.includes('iphone') || allText.includes('ipad') || allText.includes('mac')) {
		style = 'Apple';
	} else if (allText.includes('samsung') || allText.includes('galaxy')) {
		style = 'Samsung';
	} else if (allText.includes('sony')) {
		style = 'Sony';
	} else if (allText.includes('lg')) {
		style = 'LG';
	} else if (allText.includes('xiaomi') || allText.includes('mi')) {
		style = 'Xiaomi';
	} else if (allText.includes('oneplus')) {
		style = 'OnePlus';
	}
	
	return { mainCategory, subcategory, style };
}

function isFashion(allText, title, brand) {
	const fashionKeywords = [
		'shirt', 't-shirt', 'tshirt', 'top', 'blouse', 'dress', 'skirt', 'pant', 'pants',
		'jeans', 'trouser', 'shorts', 'jacket', 'coat', 'blazer', 'sweater', 'hoodie',
		'cardigan', 'vest', 'tank', 'crop', 'legging', 'jogger', 'chino', 'cargo',
		'clothing', 'apparel', 'garment', 'fashion', 'wear', 'outfit', 'ensemble',
		'casual', 'formal', 'party', 'evening', 'work', 'office', 'business'
	];
	
	return fashionKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText));
}

function extractFashionCategory(allText, title, brand) {
	let mainCategory = 'Fashion';
	let subcategory = 'Clothing';
	let style = 'General';
	
	// Determine gender
	const isMen = allText.includes('men') || allText.includes('male') || allText.includes('boy');
	const isWomen = allText.includes('women') || allText.includes('female') || allText.includes('girl') || allText.includes('ladies');
	
	if (isMen && !isWomen) {
		style = 'Men';
	} else if (isWomen && !isMen) {
		style = 'Women';
	} else {
		style = 'Unisex';
	}
	
	// Determine clothing type
	if (allText.includes('shirt') || allText.includes('t-shirt') || allText.includes('tshirt')) {
		subcategory = 'Shirts';
	} else if (allText.includes('dress')) {
		subcategory = 'Dresses';
	} else if (allText.includes('pant') || allText.includes('jeans') || allText.includes('trouser')) {
		subcategory = 'Pants';
	} else if (allText.includes('jacket') || allText.includes('coat') || allText.includes('blazer')) {
		subcategory = 'Outerwear';
	} else if (allText.includes('sweater') || allText.includes('hoodie') || allText.includes('cardigan')) {
		subcategory = 'Sweaters';
	} else if (allText.includes('skirt')) {
		subcategory = 'Skirts';
	} else if (allText.includes('shorts')) {
		subcategory = 'Shorts';
	}
	
	return { mainCategory, subcategory, style };
}

function isHomeGarden(allText, title, brand) {
	const homeKeywords = [
		'furniture', 'chair', 'table', 'sofa', 'bed', 'mattress', 'pillow', 'cushion',
		'decor', 'decoration', 'lamp', 'light', 'candle', 'vase', 'plant', 'garden',
		'kitchen', 'cookware', 'utensil', 'appliance', 'home', 'house', 'living',
		'bedroom', 'bathroom', 'dining', 'office', 'storage', 'organizer', 'basket'
	];
	
	return homeKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText));
}

function extractHomeGardenCategory(allText, title, brand) {
	let mainCategory = 'Home & Garden';
	let subcategory = 'Furniture';
	let style = 'General';
	
	if (allText.includes('furniture') || allText.includes('chair') || allText.includes('table') || allText.includes('sofa')) {
		subcategory = 'Furniture';
	} else if (allText.includes('kitchen') || allText.includes('cookware') || allText.includes('utensil')) {
		subcategory = 'Kitchen';
	} else if (allText.includes('decor') || allText.includes('decoration') || allText.includes('lamp')) {
		subcategory = 'Decor';
	} else if (allText.includes('garden') || allText.includes('plant')) {
		subcategory = 'Garden';
	} else if (allText.includes('bed') || allText.includes('mattress') || allText.includes('pillow')) {
		subcategory = 'Bedding';
	}
	
	return { mainCategory, subcategory, style };
}

function isBeautyPersonalCare(allText, title, brand) {
	const beautyKeywords = [
		'beauty', 'cosmetic', 'makeup', 'lipstick', 'foundation', 'concealer', 'mascara',
		'eyeliner', 'eyeshadow', 'blush', 'powder', 'cream', 'lotion', 'serum', 'moisturizer',
		'shampoo', 'conditioner', 'soap', 'body wash', 'face wash', 'cleanser', 'toner',
		'skincare', 'hair care', 'nail', 'polish', 'perfume', 'fragrance', 'deodorant'
	];
	
	return beautyKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText));
}

function extractBeautyCategory(allText, title, brand) {
	let mainCategory = 'Beauty & Personal Care';
	let subcategory = 'Skincare';
	let style = 'General';
	
	if (allText.includes('makeup') || allText.includes('cosmetic') || allText.includes('lipstick')) {
		subcategory = 'Makeup';
	} else if (allText.includes('skincare') || allText.includes('cream') || allText.includes('lotion')) {
		subcategory = 'Skincare';
	} else if (allText.includes('hair') || allText.includes('shampoo') || allText.includes('conditioner')) {
		subcategory = 'Hair Care';
	} else if (allText.includes('nail') || allText.includes('polish')) {
		subcategory = 'Nail Care';
	} else if (allText.includes('perfume') || allText.includes('fragrance')) {
		subcategory = 'Fragrance';
	}
	
	return { mainCategory, subcategory, style };
}

function isSportsFitness(allText, title, brand) {
	const sportsKeywords = [
		'sport', 'fitness', 'gym', 'workout', 'exercise', 'yoga', 'running', 'cycling',
		'cycling', 'bike', 'bicycle', 'swimming', 'tennis', 'cricket', 'football',
		'basketball', 'volleyball', 'badminton', 'squash', 'golf', 'hockey', 'baseball',
		'equipment', 'gear', 'accessory', 'training', 'athletic', 'performance'
	];
	
	return sportsKeywords.some(keyword => new RegExp('\\b' + keyword + '\\b', 'i').test(allText));
}

function extractSportsCategory(allText, title, brand) {
	let mainCategory = 'Sports & Fitness';
	let subcategory = 'Equipment';
	let style = 'General';
	
	if (allText.includes('gym') || allText.includes('workout') || allText.includes('fitness')) {
		subcategory = 'Fitness Equipment';
	} else if (allText.includes('running') || allText.includes('jogging')) {
		subcategory = 'Running';
	} else if (allText.includes('cycling') || allText.includes('bike') || allText.includes('bicycle')) {
		subcategory = 'Cycling';
	} else if (allText.includes('yoga')) {
		subcategory = 'Yoga';
	} else if (allText.includes('tennis') || allText.includes('cricket') || allText.includes('football')) {
		subcategory = 'Team Sports';
	}
	
	return { mainCategory, subcategory, style };
}

function extractCategoryFromUrl(productUrl, sourceType) {
	const url = productUrl.toLowerCase();
	const categoryHints = [];
	
	try {
		// Amazon URL patterns
		if (sourceType === 'amazon' || url.includes('amazon')) {
			// Amazon category patterns
			const amazonPatterns = {
				// Electronics
				'electronics': ['electronics', 'computers', 'phones', 'tablets', 'laptops', 'headphones', 'speakers', 'cameras', 'gaming'],
				'fashion': ['fashion', 'clothing', 'shoes', 'jewelry', 'watches', 'bags', 'accessories'],
				'home': ['home', 'kitchen', 'furniture', 'garden', 'bedding', 'bath', 'decor'],
				'beauty': ['beauty', 'health', 'personal-care', 'skincare', 'makeup', 'fragrance'],
				'sports': ['sports', 'fitness', 'outdoors', 'exercise', 'athletic'],
				'books': ['books', 'kindle', 'ebooks', 'magazines'],
				'toys': ['toys', 'games', 'kids', 'baby'],
				'automotive': ['automotive', 'car', 'vehicle', 'parts'],
				'office': ['office', 'stationery', 'supplies', 'business']
			};
			
			// Check for category patterns in URL
			Object.entries(amazonPatterns).forEach(([category, keywords]) => {
				if (keywords.some(keyword => url.includes(keyword))) {
					categoryHints.push(category);
				}
			});
			
			// Amazon specific patterns
			if (url.includes('/dp/') || url.includes('/gp/product/')) {
				// Extract from breadcrumb or category path
				const pathMatch = url.match(/\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
				if (pathMatch) {
					categoryHints.push(pathMatch[1], pathMatch[2], pathMatch[3]);
				}
			}
			
			// Amazon search patterns
			if (url.includes('/s?k=')) {
				const searchMatch = url.match(/[?&]k=([^&]+)/);
				if (searchMatch) {
					const searchTerms = decodeURIComponent(searchMatch[1]).split('+');
					categoryHints.push(...searchTerms);
				}
			}
		}
		
		// Flipkart URL patterns
		else if (sourceType === 'flipkart' || url.includes('flipkart')) {
			const flipkartPatterns = {
				'electronics': ['electronics', 'mobiles', 'laptops', 'tablets', 'headphones', 'speakers'],
				'fashion': ['fashion', 'clothing', 'shoes', 'watches', 'bags', 'jewelry'],
				'home': ['home', 'furniture', 'kitchen', 'decor', 'garden'],
				'beauty': ['beauty', 'health', 'personal-care'],
				'sports': ['sports', 'fitness', 'outdoors'],
				'books': ['books', 'stationery'],
				'toys': ['toys', 'games', 'baby'],
				'automotive': ['automotive', 'car']
			};
			
			Object.entries(flipkartPatterns).forEach(([category, keywords]) => {
				if (keywords.some(keyword => url.includes(keyword))) {
					categoryHints.push(category);
				}
			});
		}
		
		// Myntra URL patterns
		else if (sourceType === 'myntra' || url.includes('myntra')) {
			const myntraPatterns = {
				'fashion': ['men', 'women', 'kids', 'clothing', 'shoes', 'bags', 'watches', 'jewelry'],
				'accessories': ['accessories', 'bags', 'watches', 'jewelry', 'sunglasses'],
				'beauty': ['beauty', 'makeup', 'skincare', 'fragrance']
			};
			
			Object.entries(myntraPatterns).forEach(([category, keywords]) => {
				if (keywords.some(keyword => url.includes(keyword))) {
					categoryHints.push(category);
				}
			});
		}
		
		// Ajio URL patterns
		else if (sourceType === 'ajio' || url.includes('ajio')) {
			const ajioPatterns = {
				'fashion': ['men', 'women', 'kids', 'clothing', 'shoes', 'bags', 'watches'],
				'accessories': ['accessories', 'bags', 'watches', 'jewelry', 'sunglasses']
			};
			
			Object.entries(ajioPatterns).forEach(([category, keywords]) => {
				if (keywords.some(keyword => url.includes(keyword))) {
					categoryHints.push(category);
				}
			});
		}
		
		// Generic URL patterns
		const genericPatterns = {
			'electronics': ['phone', 'mobile', 'laptop', 'computer', 'headphone', 'speaker', 'camera', 'gaming', 'tech'],
			'fashion': ['shirt', 'dress', 'shoe', 'bag', 'watch', 'jewelry', 'clothing', 'apparel'],
			'home': ['furniture', 'kitchen', 'bed', 'sofa', 'chair', 'table', 'decor', 'garden'],
			'beauty': ['beauty', 'makeup', 'skincare', 'fragrance', 'cosmetic', 'shampoo'],
			'sports': ['sport', 'fitness', 'gym', 'running', 'athletic', 'exercise'],
			'books': ['book', 'kindle', 'ebook', 'magazine', 'stationery'],
			'toys': ['toy', 'game', 'kids', 'baby', 'children'],
			'automotive': ['car', 'vehicle', 'automotive', 'parts', 'accessories']
		};
		
		Object.entries(genericPatterns).forEach(([category, keywords]) => {
			if (keywords.some(keyword => url.includes(keyword))) {
				categoryHints.push(category);
			}
		});
		
		// Extract specific product types from URL
		const productTypePatterns = [
			// Footwear
			'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'heel', 'heels',
			'loafer', 'loafers', 'slipper', 'slippers', 'oxford', 'oxfords',
			// Electronics
			'smartphone', 'iphone', 'samsung', 'xiaomi', 'oneplus', 'laptop', 'macbook',
			'headphone', 'earphone', 'speaker', 'camera', 'lens', 'watch', 'smartwatch',
			// Fashion
			't-shirt', 'tshirt', 'shirt', 'dress', 'jeans', 'pants', 'jacket', 'coat',
			'sweater', 'hoodie', 'skirt', 'shorts', 'blouse', 'top',
			// Home
			'furniture', 'chair', 'table', 'sofa', 'bed', 'mattress', 'lamp', 'candle',
			'kitchen', 'cookware', 'utensil', 'appliance'
		];
		
		productTypePatterns.forEach(pattern => {
			if (url.includes(pattern)) {
				categoryHints.push(pattern);
			}
		});
		
		// Extract gender from URL
		const genderPatterns = ['men', 'women', 'male', 'female', 'boy', 'girl', 'ladies', 'gentlemen'];
		genderPatterns.forEach(pattern => {
			if (url.includes(pattern)) {
				categoryHints.push(pattern);
			}
		});
		
		// Extract brand names from URL
		const brandPatterns = [
			'nike', 'adidas', 'puma', 'reebok', 'converse', 'vans', 'new balance',
			'apple', 'samsung', 'sony', 'lg', 'xiaomi', 'oneplus', 'oppo', 'vivo',
			'zara', 'h&m', 'uniqlo', 'levis', 'wrangler', 'tommy hilfiger',
			'gucci', 'prada', 'versace', 'armani', 'calvin klein'
		];
		
		brandPatterns.forEach(brand => {
			if (url.includes(brand)) {
				categoryHints.push(brand);
			}
		});
		
	} catch (error) {
		console.warn('Error extracting category from URL:', error.message);
	}
	
	// Remove duplicates and return
	return [...new Set(categoryHints)];
}

function extractCategoryFromSearchUrl(url) {
	try {
		if (!url || typeof url !== 'string') return '';
		const urlObj = new URL(url);
		const searchParams = ['k', 'q', 'query', 'searchVal', 'p', 'search'];
		for (const param of searchParams) {
			const val = urlObj.searchParams.get(param);
			if (val) {
				return decodeURIComponent(val).replace(/\+/g, ' ').trim();
			}
		}
		
		const path = urlObj.pathname;
		const isAjio = /ajio\./i.test(urlObj.hostname);
		const isMyntra = /myntra\./i.test(urlObj.hostname);
		
		if (isAjio && path.includes('/s/')) {
			const segment = path.split('/s/')[1];
			if (segment) return segment.split('/')[0].replace(/-/g, ' ').replace(/\+/g, ' ').trim();
		}
		if (isMyntra) {
			const segments = path.split('/').filter(Boolean);
			if (segments.length === 1) {
				return segments[0].replace(/-/g, ' ').replace(/\+/g, ' ').trim();
			}
		}
		
		if (path.includes('search')) {
			const segments = path.split('/').filter(Boolean);
			const last = segments[segments.length - 1];
			if (last && last !== 'search') return last.replace(/-/g, ' ').replace(/\+/g, ' ').trim();
		}
	} catch (e) {
		// ignore
	}
	return '';
}

function getHierarchyFromSearchQuery(searchQuery) {
	if (!searchQuery) return null;
	const categoryData = {
		mainCategory: searchQuery,
		c1: searchQuery,
		c2: searchQuery,
		c3: searchQuery,
		c4: searchQuery,
		c5: searchQuery
	};
	const hierarchy = findMatchingHierarchy(categoryData);
	if (hierarchy && hierarchy.mainCategory && hierarchy.mainCategory !== 'Unknown') {
		const hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
		return {
			mainCategory: hierarchy.mainCategory,
			subcategory: hierarchy.subcategory,
			style: hierarchy.style,
			hierarchicalKey,
			confidence: 90,
			source: 'search-query'
		};
	}
	return null;
}

async function normalizeProduct(raw, url, sourceType = 'website', categoryKey = '', usedPageType = null, pageExpiresAt = null) {
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
	
	let productExpiresAt = null;
	if (raw.timer && typeof raw.timer === 'string' && raw.timer.trim() !== '') {
		try {
			const parsed = parseTimerText(raw.timer);
			if (parsed) {
				productExpiresAt = parsed;
				logger.info(`🕒 [PRODUCT TIMER DISCOVERY] Found active timer on product card: "${raw.timer}" -> expires at: ${new Date(productExpiresAt).toISOString()}`);
			}
		} catch (e) {
			logger.warn('Failed to parse product-card timer', { error: e.message, timer: raw.timer });
		}
	}
	
	// Set avinashbmvINR based on platform
	const isAmazon = /amazon\./i.test(hostname) || (raw.storeType || '').toLowerCase() === 'amazon';
	if (isAmazon && productCode) {
		// For Amazon: use clean affiliate URL with tag
		links.avinashbmvINR = `https://www.amazon.in/dp/${productCode}?tag=dealshubglo0c-21`;
	} else {
		// For non-Amazon: prepend with inrdeals.com (remove the + sign)
		links.avinashbmvINR = `https://inrdeals.com/avi646476329/${productUrl}`;
	}

	// Process hierarchical categories using dynamic extraction
	const categoryData = raw.category || {};
	let hierarchy;
	let hierarchicalKey;
	let categorySource = 'unknown';
	
	try {
		const searchQuery = extractCategoryFromSearchUrl(url);
		const searchHierarchy = getHierarchyFromSearchQuery(searchQuery);
		
		if (searchHierarchy) {
			hierarchy = searchHierarchy;
			hierarchicalKey = searchHierarchy.hierarchicalKey;
			categorySource = 'search-query';
			logger.info('🔍 Used search query categorization', {
				productCode,
				searchQuery,
				hierarchicalKey
			});
		} else {
			// Try dynamic extraction first
			const dynamicHierarchy = await dynamicCategoryExtractor.extractAndLearnCategories(raw, sourceType);
			if (dynamicHierarchy && dynamicHierarchy.confidence > 50) {
				hierarchy = dynamicHierarchy;
				hierarchicalKey = dynamicHierarchy.hierarchicalKey;
				categorySource = 'dynamic';
				logger.info('✅ Used dynamic category extraction', { 
					productCode, 
					confidence: dynamicHierarchy.confidence,
					hierarchicalKey: dynamicHierarchy.hierarchicalKey,
					mainCategory: dynamicHierarchy.mainCategory,
					subcategory: dynamicHierarchy.subcategory,
					style: dynamicHierarchy.style
				});
			} else {
				// Fallback to static matching
				hierarchy = findMatchingHierarchy(categoryData);
				hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
				categorySource = 'static';
				logger.info('📋 Used static category matching', { 
					productCode, 
					hierarchicalKey,
					mainCategory: hierarchy.mainCategory,
					subcategory: hierarchy.subcategory,
					style: hierarchy.style,
					categoryData: categoryData
				});
			}
		}
	} catch (error) {
		logger.warn('⚠️ Dynamic category extraction failed, using static matching', { 
			error: error.message, 
			productCode 
		});
		// Fallback to static matching
		hierarchy = findMatchingHierarchy(categoryData);
		hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
		categorySource = 'static-fallback';
	}

	// Manual fallback if both dynamic and static fail
	if (!hierarchy || !hierarchy.mainCategory || hierarchy.mainCategory === 'Unknown') {
		hierarchy = getManualCategoryFallback(raw, sourceType, categoryKey);
		hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
		categorySource = 'manual';
		logger.warn('🔧 Used manual category fallback', { 
			productCode,
			hierarchicalKey,
			mainCategory: hierarchy.mainCategory,
			subcategory: hierarchy.subcategory,
			style: hierarchy.style,
			sourceType,
			categoryKey
		});
	}
	
	// Extract categoryGroup from categoryKey (format: category_subcategory)
	// categoryGroup should be lowercase, hyphenated (e.g., 'home-kitchen', 'beauty-personal-care')
	let categoryGroup = '';
	if (categoryKey && typeof categoryKey === 'string' && categoryKey.includes('_')) {
		// Handles keys starting with platform names (e.g. ajio_fashion) or standard categories (e.g. electronics_audio)
		const parts = categoryKey.split('_');
		const platforms = ['amazon', 'flipkart', 'myntra', 'ajio'];
		if (platforms.includes(parts[0].toLowerCase())) {
			categoryGroup = (parts[1] || 'general').toLowerCase();
		} else {
			categoryGroup = parts[0].toLowerCase();
		}
	} else {
		// Fallback: try to derive from hierarchy or use default
		const mainCat = hierarchy?.mainCategory || '';
		if (mainCat) {
			const normalizedGroup = mainCat.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '').replace(/\//g, '-');
			const categoryMappings = {
				'home-garden': 'home-kitchen',
				'home-kitchen': 'home-kitchen',
				'homeandgarden': 'home-kitchen',
				'homeandkitchen': 'home-kitchen',
				'beauty-personal-care': 'beauty-personal-care',
				'beautypersonalcare': 'beauty-personal-care',
				'beauty': 'beauty-personal-care',
				'personal-care': 'beauty-personal-care',
				'sports-fitness': 'sports-fitness',
				'sportsfitness': 'sports-fitness',
				'sports': 'sports-fitness',
				'fitness': 'sports-fitness',
				'books-stationery': 'books-stationery',
				'booksstationery': 'books-stationery',
				'books': 'books-stationery',
				'stationery': 'books-stationery',
				'baby-kids': 'baby-kids',
				'babykids': 'baby-kids',
				'baby': 'baby-kids',
				'kids': 'baby-kids',
				'tools-hardware': 'tools-hardware',
				'toolshardware': 'tools-hardware',
				'tools': 'tools-hardware',
				'hardware': 'tools-hardware',
				'music-entertainment': 'music-entertainment',
				'musicentertainment': 'music-entertainment',
				'music': 'music-entertainment',
				'entertainment': 'music-entertainment',
				'pet-supplies': 'pet-supplies',
				'petsupplies': 'pet-supplies',
				'pet': 'pet-supplies',
				'electronics': 'electronics',
				'fashion': 'fashion',
				'automotive': 'automotive',
				'grocery': 'grocery'
			};
			categoryGroup = categoryMappings[normalizedGroup] || normalizedGroup;
		}
	}
	
	// Log categoryGroup extraction for debugging
	logger.debug('categoryGroup extracted', { categoryKey, categoryGroup, mainCategory: hierarchy?.mainCategory });

	// Console log for every product - Include Product ID and Product Code
	const productId = raw.id || raw.productId || 'N/A';
	console.log(`🏷️  Product ID: ${productId} | Product Code: ${productCode} | Category Chain:`, {
		productId: productId,
		productCode: productCode,
		source: categorySource,
		mainCategory: hierarchy.mainCategory,
		subcategory: hierarchy.subcategory,
		style: hierarchy.style,
		hierarchicalKey: hierarchicalKey,
		confidence: hierarchy.confidence || 0,
		// Separate attributes for API queries
		categoryLevel1: hierarchy.mainCategory || '',
		categoryLevel2: hierarchy.subcategory || '',
		categoryLevel3: hierarchy.style || '',
		subcategory1: hierarchy.subcategory || '',
		subcategory2: hierarchy.style || '',
		productCategory: hierarchy.mainCategory || '',
		productSubcategory: hierarchy.subcategory || '',
		productStyle: hierarchy.style || '',
		categoryPath: [hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style].filter(Boolean),
		categoryDepth: [hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style].filter(Boolean).length,
		// URL analysis
		urlHints: extractCategoryFromUrl(productUrl, sourceType),
		productUrl: productUrl
	});

	// Also log to file for better tracking
	logger.info('🏷️ Category Chain extracted', {
		productCode,
		source: categorySource,
		mainCategory: hierarchy.mainCategory,
		subcategory: hierarchy.subcategory,
		style: hierarchy.style,
		hierarchicalKey: hierarchicalKey,
		confidence: hierarchy.confidence || 0,
		categoryLevel1: hierarchy.mainCategory || '',
		categoryLevel2: hierarchy.subcategory || '',
		categoryLevel3: hierarchy.style || '',
		urlHints: extractCategoryFromUrl(productUrl, sourceType),
		productUrl: productUrl
	});

	const { extractAttributes } = require('../utils/productAttributeExtractor');
	const specsObj = raw.specifications || {};
	const title = raw.name || raw.title || '';
	const brand = (raw.brand || '').toUpperCase().replace(/\s+/g, '');
	const attributes = extractAttributes(title, specsObj);

	// Also check if extractAttributes found a model number from title/specs
	const modelNumberFromSpecs = raw.modelNumber || attributes.modelNumber || '';

	// Generate matchId for cross-platform grouping
	// Priority: MODEL > GRP (brand+specs) > GEN (title hash)
	let matchId = '';

	if (modelNumberFromSpecs) {
		// Strongest signal: exact model number (e.g., MODEL_MSA18K3FZAS, MODEL_B0D5J5V32Y)
		matchId = `MODEL_${modelNumberFromSpecs.toUpperCase().replace(/\s+/g, '')}`;
	} else if (brand && attributes.capacity && attributes.energyRating) {
		// Appliances: SAMSUNG_1.5TON_3STAR
		const inv = attributes.inverterType ? `_${attributes.inverterType.toUpperCase().replace(/\s+/g, '')}` : '';
		matchId = `GRP_${brand}_${attributes.capacity.toUpperCase().replace(/\s+/g, '')}${inv}_${attributes.energyRating.toUpperCase().replace(/\s+/g, '')}`;
	} else if (brand && attributes.capacity) {
		// Appliances without rating: SAMSUNG_1.5TON
		matchId = `GRP_${brand}_${attributes.capacity.toUpperCase().replace(/\s+/g, '')}`;
	} else if (brand && attributes.ram && attributes.storage) {
		// Laptops/Phones: LENOVO_16GB_512GB_15.6INCH
		const screen = attributes.screenSize ? `_${attributes.screenSize.toUpperCase().replace(/\s+/g, '')}` : '';
		matchId = `GRP_${brand}_${attributes.ram}_${attributes.storage}${screen}`;
	} else if (brand && attributes.screenSize && attributes.processor) {
		// Laptops with processor: HP_I512THGEN_15.6INCH
		matchId = `GRP_${brand}_${attributes.processor.toUpperCase().replace(/\s+/g, '')}_${attributes.screenSize.toUpperCase().replace(/\s+/g, '')}`;
	} else if (brand && attributes.screenSize) {
		// TVs/Monitors: SAMSUNG_55INCH
		matchId = `GRP_${brand}_${attributes.screenSize.toUpperCase().replace(/\s+/g, '')}`;
	} else if (productCode && !productCode.startsWith('http') && productCode.length > 3) {
		// Platform-specific product code (won't match across platforms)
		matchId = `MATCH_${productCode}`;
	} else {
		// Generic fallback using title hash
		matchId = `GEN_${Buffer.from(title.substring(0, 20)).toString('base64').replace(/[=+/]/g, '')}`;
	}

	const normalized = {
		brand: raw.brand || '',
		title: title,
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
		matchId,
		attributes,
		links,
		categoryKey,
		categoryPath: raw.categoryPath || [],
		// categoryGroup: Primary attribute for database queries (REQUIRED)
		// Must match exact values: electronics, fashion, home-kitchen, sports-fitness, etc.
		categoryGroup: categoryGroup,
		// Hierarchical category fields
		hierarchicalCategory: {
			mainCategory: hierarchy.mainCategory,
			subcategory: hierarchy.subcategory,
			style: hierarchy.style,
			hierarchicalKey: hierarchicalKey,
			confidence: hierarchy.confidence || 0,
			source: categorySource,
			platform: sourceType,
			extractionMethod: categorySource,
			extractionTimestamp: isoNow
		},
		// Separate category attributes for API queries
		categoryLevel1: hierarchy.mainCategory || '',
		categoryLevel2: hierarchy.subcategory || '',
		categoryLevel3: hierarchy.style || '',
		subcategory1: hierarchy.subcategory || '',
		subcategory2: hierarchy.style || '',
		productCategory: hierarchy.mainCategory || '',
		productSubcategory: hierarchy.subcategory || '',
		productStyle: hierarchy.style || '',
		categoryPath: [hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style].filter(Boolean),
		categoryDepth: [hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style].filter(Boolean).length,
		// Legacy category fields for backward compatibility
		category: {
			c1: categoryData.c1 || '',
			c2: categoryData.c2 || '',
			c3: categoryData.c3 || '',
			c4: categoryData.c4 || '',
			c5: categoryData.c5 || '',
			mainCategory: categoryData.mainCategory || ''
		},
		sourceType,
		storeType: raw.storeType || (/amazon\./i.test(hostname) ? 'Amazon' : /flipkart\./i.test(hostname) ? 'Flipkart' : /myntra\./i.test(hostname) ? 'Myntra' : /ajio\./i.test(hostname) ? 'Ajio' : (sourceType !== 'telegram' && sourceType !== 'website' ? sourceType.charAt(0).toUpperCase() + sourceType.slice(1) : 'Unknown')),
		creationTimestamp: isoNow,
		updateTimestamp: isoNow,
		date: dateOnly,
		datetime: isoNow,
		// Source listing page URL (where this product was discovered)
		// This is required later to fix selectors or debug missing prices/details
		sourceUrl: url,
		isDeal: raw.isDeal || false,
		isOffer: raw.isOffer || false,
		isOutOfStock: raw.isOutOfStock || false,
		deal: raw.deal || '',
		limitedTimeDeal: raw.limitedTimeDeal || '',
		dealProgress: raw.dealProgress || '',
		timer: raw.timer || '',
		dealName: deriveDealName(raw),
		sectionName: deriveSectionName(productUrl || url, usedPageType || '')
	};

	// Apply postProcessProductData to normalize and compute missing price/mrp/discount
	try {
		let processed = { 
			...normalized,
			mrp: normalized.originalPrice || normalized.mrp || '',
			discount: normalized.discountPercentage || normalized.discount || ''
		};
		processed = postProcessProductData(processed, normalized.storeType);
		normalized.price = processed.price;
		normalized.originalPrice = processed.mrp;
		normalized.discountPercentage = processed.discount;
	} catch (e) {
		logger.warn('Error running postProcessProductData in normalizeProduct', { error: e.message });
	}

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

	// Check for missing details and track them
	const missingFields = checkMissingDetails(normalized, url);
	if (missingFields.length > 0) {
		logger.info('Product normalized with missing details', {
			productCode: normalized.productCode,
			missingFields,
			sourceUrl: url,
			productUrl: normalized.productUrl
		});
	}

	// Look up in global.discoveredDealsMap to set homepage discovery live deal attributes
	if (global.discoveredDealsMap && url) {
		const cleanUrl = url.trim();
		if (global.discoveredDealsMap.has(cleanUrl)) {
			const match = global.discoveredDealsMap.get(cleanUrl);
			normalized.isDeal = true;
			normalized.dealName = match.dealName;
			normalized.dealLabel = match.dealName;
			normalized.dealExpiresAt = match.dealExpiresAt;
			logger.info(`🔥 [DEAL ENRICHMENT] Set product deal attributes for ${normalized.productCode || 'unknown'}: dealName="${match.dealName}"`);
		}
	}

	if (!normalized.dealExpiresAt) {
		if (productExpiresAt) {
			normalized.dealExpiresAt = productExpiresAt;
			logger.info(`🔥 [DEAL EXPIRED AT] Mapped product-card timer to product: ${normalized.productCode || 'unknown'} -> ${new Date(productExpiresAt).toISOString()}`);
		} else if (pageExpiresAt) {
			normalized.dealExpiresAt = pageExpiresAt;
			logger.info(`🔥 [DEAL EXPIRED AT] Mapped page-level timer to product: ${normalized.productCode || 'unknown'} -> ${new Date(pageExpiresAt).toISOString()}`);
		}
	}

	return normalized;
}

async function tryConfigs(url, driver, config) {
	const pageTypes = ['searchPage', 'dealsGridPage', 'carouselPage', 'bestCarouselPage'];
	
	for (const pageType of pageTypes) {
		try {
			logger.info(`🔍 Attempting extraction with ${pageType}`, { pageType, url });
			const rawProducts = await scrapePage(url, driver, config, pageType);
			if (Array.isArray(rawProducts) && rawProducts.length > 0) {
				logger.info(`✅ Extracted products using ${pageType}`, { count: rawProducts.length, url, pageType });
				return { rawProducts, usedPageType: pageType };
			}
			logger.warn(`⚠️ No results with ${pageType}`, { url, pageType, productsFound: rawProducts?.length || 0 });
			
			// Clear memory after each attempt
			try {
				await driver.executeScript('if (window.gc) window.gc();');
			} catch {}
		} catch (error) {
			logger.error(`❌ Error with ${pageType}`, { 
				error: error.message, 
				url,
				pageType,
				stack: error.stack,
				errorName: error.name
			});
			// Clear memory on error
			try {
				await driver.executeScript('if (window.gc) window.gc();');
			} catch {}
			// Don't throw - continue to next pageType to try alternatives
		}
	}
	
	logger.error('❌ [CRITICAL] All page types failed to extract products', { url, attemptedTypes: pageTypes });
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

async function extractAndStoreFromUrl(driver, url, sourceType = 'website', categoryKey = '', ctx = null, targetDb = 'deals', platform = null, category = null, pageIndex = null) {
	try {
		logger.info('Batch extracting page', { url, sourceType, categoryKey, platform, category });
		
		// Import storeMap to detect platform dynamically
		const { storeMap } = require('../config/const');
		
		// Validate storeMap
		if (!storeMap || typeof storeMap !== 'object') {
			logger.error('❌ [CRITICAL] storeMap is undefined or invalid in extractAndStoreFromUrl', {
				storeMapType: typeof storeMap,
				storeMapValue: storeMap,
				url
			});
			throw new Error('storeMap configuration is not available');
		}
		
		// Use provided platform or detect from URL
		let detectedPlatform = platform;
		if (!detectedPlatform) {
			const { resolvePlatformFromUrl } = require('../utils/platformUtils');
			let storeKey = resolvePlatformFromUrl(url) || Object.keys(storeMap).find(key => url.toLowerCase().includes(key.toLowerCase()));
			
			// Fallback to checking the current URL (in case of redirects from shortlinks)
			if (!storeKey && driver) {
				try {
					const currentUrl = await driver.getCurrentUrl();
					logger.info('Platform detection fallback: checking current URL', { url, currentUrl });
					storeKey = resolvePlatformFromUrl(currentUrl) || Object.keys(storeMap).find(key => currentUrl.toLowerCase().includes(key.toLowerCase()));
				} catch (e) {
					logger.warn('Could not get current URL for platform detection', { error: e.message });
				}
			}

			if (!storeKey) {
				logger.warn('Could not detect platform from URL, defaulting to amazon', { url, availablePlatforms: Object.keys(storeMap) });
				detectedPlatform = 'amazon';
			} else {
				detectedPlatform = storeKey;
				logger.info('Platform detected from URL', { url, detectedPlatform });
			}
		}
		
		// Load platform-specific config dynamically
		const configPath = `./PageConfig/${detectedPlatform}PageConfig.js`;
		logger.info('📦 Loading platform config', { 
			platform: detectedPlatform, 
			configPath, 
			url,
			categoryKey,
			availablePlatforms: Object.keys(storeMap)
		});
		
		let config;
		try {
			config = await loadConfig(configPath);
			logger.debug('✅ Config loaded successfully', { platform: detectedPlatform, hasConfig: !!config });
		} catch (configError) {
			logger.error('❌ [ERROR] Failed to load config', { 
				platform: detectedPlatform, 
				configPath, 
				error: configError.message,
				stack: configError.stack,
				url
			});
			throw configError;
		}
		
		let rawProducts, usedPageType;
		try {
			const tryConfigsPromise = tryConfigs(url, driver, config);
			// Prevent unhandled rejection from the background task if the timeout wins
			tryConfigsPromise.catch(e => logger.debug('Swallowed late tryConfigs error after timeout', { error: e.message }));
			const result = await withTimeout(tryConfigsPromise, (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE');
			rawProducts = result.rawProducts;
			usedPageType = result.usedPageType;
		} catch (scrapeError) {
			logger.error('❌ [ERROR] tryConfigs failed in extractAndStoreFromUrl', {
				error: scrapeError.message,
				errorStack: scrapeError.stack,
				errorName: scrapeError.name,
				url,
				categoryKey,
				platform: detectedPlatform,
				configPath
			});
			throw scrapeError;
		}
		if (ctx) {
			ctx.pageTypeHits[usedPageType || 'none'] = (ctx.pageTypeHits[usedPageType || 'none'] || 0) + 1;
		}
		
		// Extract page-level timer if present
		let pageExpiresAt = null;
		try {
			const pageTimerText = await extractPageTimer(driver, detectedPlatform);
			if (pageTimerText) {
				const parsedExpiry = parseTimerText(pageTimerText);
				if (parsedExpiry) {
					pageExpiresAt = parsedExpiry;
					logger.info(`🕒 [TIMER DISCOVERY] Found active timer on page: "${pageTimerText}" -> expires at: ${new Date(pageExpiresAt).toISOString()}`);
				}
			}
		} catch (timerErr) {
			logger.warn('Failed to extract page-level timer', { error: timerErr.message });
		}
		
		const products = Array.isArray(rawProducts) ? await Promise.all(rawProducts.map(p => normalizeProduct(p, url, sourceType, categoryKey, usedPageType, pageExpiresAt))) : [];
		if (products.length === 0) {
			logger.warn('No products extracted', { url });
			if (ctx) ctx.noProductUrls.push(url);
			
			// Deactivate the deal if this is a targeted details page and the product is no longer found
			try {
				const { getCode } = require('../utils/commonUtils');
				const codeRes = getCode(url, detectedPlatform);
				if (codeRes.isValid && codeRes.value) {
					logger.info(`🧹 [DEACTIVATION] Deactivating stale/expired deal that returned no products: ${codeRes.value}`);
					const admin = require('firebase-admin');
					const db = admin.database();
					const cleanKey = codeRes.value.replace(/[\.\#\$\[\]]/g, '_');
					
					const now = new Date().toISOString();
					const updateData = {
						isDeal: false,
						updatedAt: now,
						updatedatetime: Date.now()
					};
					
					await db.ref(`productdeals/${cleanKey}`).update(updateData);
					
					// Update search index to reflect deactivation
					try {
						await db.ref(`search_index/${cleanKey}`).update({
							t: "",
							b: "",
							p: ""
						});
					} catch (searchIndexErr) {}
				}
			} catch (deactErr) {
				logger.warn('Failed to deactivate expired deal on 0 products page:', deactErr.message);
			}
			
			return { extracted: 0, stored: 0, products: [] };
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

		let finalProductsToStore = uniqueProducts;
		let enqueuedProducts = [];
		const LIMIT = 10;
		
		const isListingPage = usedPageType && ['searchPage', 'dealsGridPage', 'carouselPage', 'bestCarouselPage'].includes(usedPageType);
		
		if ((isListingPage || sourceType === 'telegram') && uniqueProducts.length > 1) {
			const isSearchPageGroup = !!isListingPage;
			const limitToUse = isSearchPageGroup ? uniqueProducts.length : LIMIT;
			
			logger.info(`Setting up parent-child relation. isSearchPageGroup: ${isSearchPageGroup}, count: ${uniqueProducts.length}, limitToUse: ${limitToUse}`);
			
			const activeProducts = uniqueProducts.slice(0, limitToUse);
			if (!isSearchPageGroup) {
				enqueuedProducts = uniqueProducts.slice(limitToUse);
			}
			
			const parent = activeProducts[0];
			parent.isParent = true;
			parent.similarProducts = activeProducts.slice(1).map(p => ({
				brand: p.brand || '',
				title: p.title || '',
				price: p.price || '',
				originalPrice: p.originalPrice || '',
				discountPercentage: p.discountPercentage || '',
				rating: p.rating || '',
				photo: p.photo || '',
				productCode: p.productCode,
				productUrl: p.productUrl,
				links: p.links || {},
				categoryGroup: p.categoryGroup || '',
				hierarchicalCategory: p.hierarchicalCategory || {}
			}));
			
			for (let i = 1; i < activeProducts.length; i++) {
				activeProducts[i].isChild = true;
				activeProducts[i].parentId = parent.productCode || parent.id || '';
			}
			
			finalProductsToStore = activeProducts;
			
			if (enqueuedProducts.length > 0) {
				try {
					const path = require('path');
					const fs = require('fs');
					const queueFile = path.join(__dirname, 'scrappers', 'holdProducts.json');
				
				const dir = path.dirname(queueFile);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
				
				let currentQueue = [];
				if (fs.existsSync(queueFile)) {
					try {
						const data = fs.readFileSync(queueFile, 'utf8');
						currentQueue = JSON.parse(data);
					} catch (e) {
						logger.error('Failed to read existing holdProducts queue', { error: e.message });
					}
				}
				
				for (const ep of enqueuedProducts) {
					currentQueue.push({
						productUrl: ep.productUrl,
						name: ep.title || 'Queued Product',
						categoryOverride: {
							mainCategory: parent.hierarchicalCategory?.mainCategory || '',
							subcategory: parent.hierarchicalCategory?.subcategory || '',
							style: parent.hierarchicalCategory?.style || '',
							hierarchicalKey: parent.hierarchicalCategory?.hierarchicalKey || '',
							categoryLevel1: parent.categoryLevel1 || '',
							categoryLevel2: parent.categoryLevel2 || '',
							categoryLevel3: parent.categoryLevel3 || '',
							subcategory1: parent.subcategory1 || '',
							subcategory2: parent.subcategory2 || '',
							productCategory: parent.productCategory || '',
							productSubcategory: parent.productSubcategory || '',
							productStyle: parent.productStyle || '',
							categoryGroup: parent.categoryGroup || ''
						}
					});
				}
				
				fs.writeFileSync(queueFile, JSON.stringify(currentQueue, null, 2), 'utf8');
				logger.info(`Successfully added ${enqueuedProducts.length} products to holdProducts queue file`, { queueFile, queueSize: currentQueue.length });
			} catch (queueErr) {
				logger.error('Failed to write to holdProducts queue file', { error: queueErr.message });
			}
		}
	}

		// Enrich with static mapping
		const { getStaticCategoryMapping } = require('../utils/staticCategoryMapping');
		finalProductsToStore = finalProductsToStore.map(p => {
			const staticInfo = getStaticCategoryMapping(p);
			return { ...p, ...staticInfo };
		});

		let storedCount = 0;
		let createdCount = 0;
		let updatedCount = 0;
		try {
			const result = await withTimeout(
				productDealsDB.bulkUpsertProducts(finalProductsToStore, targetDb),
				(require('../config/constants').maxPlatformTimeoutMs || 900000),
				'DB_UPSERT'
			);
			storedCount = result.count || finalProductsToStore.length;
			createdCount = result.created || 0;
			updatedCount = result.updated || 0;

			// Also save to static categories node for UI consumption
			if (targetDb === 'productdeals') {
				await withTimeout(
					productDealsDB.bulkUpsertProducts(finalProductsToStore, 'productdeals_static'),
					(require('../config/constants').maxPlatformTimeoutMs || 900000),
					'DB_UPSERT_STATIC'
				);
			}
		} catch (e) {
			if (ctx) ctx.failedCount += finalProductsToStore.length;
			throw e;
		}

		// Estimate unchanged as difference between unique and stored when DB returns fewer
		if (ctx && storedCount < finalProductsToStore.length) {
			ctx.skippedUnchangedCount += (finalProductsToStore.length - storedCount);
		}

		// Check for category deals and notify favorited users (async, non-blocking)
		if (category && finalProductsToStore.length > 0) {
			try {
				const { favoritesNotificationService } = require('../services/favoritesBasedNotificationService');
				// Use first product as sample for category notification
				const sampleProduct = finalProductsToStore[0];
				favoritesNotificationService.checkCategoryDeals(category, sampleProduct).catch(err => {
					logger.debug('Category deal check failed (non-fatal)', { category, error: err.message });
				});
			} catch (e) {
				// Service not available, skip
			}
		}

		// Return products for tracking
		return { 
			extracted: beforeCount, 
			stored: storedCount, 
			created: createdCount, 
			updated: updatedCount,
			products: finalProductsToStore.map(p => ({ productCode: p.productCode, productId: p.id || p.productId || '' }))
		};
	} catch (error) {
		logger.error('❌ [ERROR] extractAndStoreFromUrl error', { 
			url, 
			error: error.message,
			stack: error.stack,
			categoryKey,
			sourceType,
			targetDb,
			errorName: error.name,
			errorType: typeof error
		});
		if (ctx) ctx.errors.push({ url, error: error.message });
		return { extracted: 0, stored: 0, created: 0, updated: 0, products: [] };
	}
}

async function initializeDriver() {
	const net = require('net');
	const isPortOpen = (port) => new Promise((resolve) => {
		const socket = new net.Socket();
		const onError = () => {
			socket.destroy();
			resolve(false);
		};
		socket.setTimeout(800);
		socket.once('error', onError);
		socket.once('timeout', onError);
		socket.connect(port, '127.0.0.1', () => {
			socket.end();
			resolve(true);
		});
	});

	const isDebuggerAvailable = await isPortOpen(9222);
	if (isDebuggerAvailable) {
		try {
			const options = new chrome.Options();
			options.debuggerAddress("localhost:9222");
			const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
			logger.info('Connected to running Chrome instance on port 9222 for batch update');
			
			// Inject DevTools command to bypass automation detection
			try {
				await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
					source: 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
				});
				logger.info('DevTools script injected successfully for remote debugger session.');
			} catch (cdpErr) {
				logger.warn('Failed to inject DevTools script in remote debugger session', { error: cdpErr.message });
			}
			
			return driver;
		} catch (error) {
			logger.warn('Failed to connect to Chrome on port 9222 for batch update, falling back to standalone...', { error: error.message });
		}
	} else {
		logger.info('Port 9222 is closed, initializing standalone headless Chrome');
	}

	const options = new chrome.Options();
	options.addArguments('--headless=new');
	options.addArguments('--no-sandbox');
	options.addArguments('--disable-dev-shm-usage');
	options.addArguments('--window-size=1920,1080');
	options.addArguments('--disable-blink-features=AutomationControlled');
	options.addArguments('--disable-infobars');
	options.addArguments('--lang=en-US');
	options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
	options.addArguments('--log-level=3'); // Suppress severe/fatal only
	options.addArguments('--disable-logging');
	options.excludeSwitches(['enable-automation', 'enable-logging']);
	
	// Memory optimization flags
	options.addArguments('--memory-pressure-off');
	options.addArguments('--disable-background-timer-throttling');
	options.addArguments('--disable-backgrounding-occluded-windows');
	options.addArguments('--disable-renderer-backgrounding');
	options.addArguments('--disable-features=TranslateUI');
	options.addArguments('--disable-ipc-flooding-protection');
	
	const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
	try {
		await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
			source: 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
		});
	} catch (cdpErr) {
		logger.warn('Failed to inject DevTools script in standalone session', { error: cdpErr.message });
		try {
			await driver.executeScript('Object.defineProperty(navigator, "webdriver", {get: () => undefined})');
		} catch {}
	}
	return driver;
}

async function isDriverAlive(driver) {
	if (!driver) return false;
	try {
		await driver.getCurrentUrl();
		return true;
	} catch {
		return false;
	}
}

async function closeDriver(driver) {
	if (!driver) return;
	try {
		await driver.quit();
	} catch (e) {
		const msg = e?.message || String(e);
		if (!/invalid session|NoSuchSession|not connected to DevTools/i.test(msg)) {
			logger.debug('closeDriver warning', { error: msg });
		}
	}
}

async function runBatch(seedUrls = [], sourceType = 'website', categoryKey = '', targetDb = 'deals', existingDriver = null) {
	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/3efbc81e-9538-4d65-80a7-bcca86ddef6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchProductExtractor.js:952',message:'runBatch entry',data:{seedUrlsCount:seedUrls.length,sourceType,categoryKey,targetDb,storeMap_type:typeof storeMap,storeMap_isUndefined:storeMap===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
	// #endregion
	logger.info('🚀 [ENTRY] runBatch called', { 
		seedUrlsCount: seedUrls.length,
		sourceType,
		categoryKey,
		targetDb,
		firstUrl: seedUrls[0] || 'N/A'
	});
	
	let driver = existingDriver;
	// Context to persist summary details until termination
	const ctx = { noProductUrls: [], pageTypeHits: {}, missingFieldLogs: [], errors: [], dedupedCount: 0, skippedUnchangedCount: 0, failedCount: 0 };
	
	// We no longer extract platform and category from categoryKey here
	// because categoryKey can be 'electronics_air-conditioners'.
	// Instead, extractAndStoreFromUrl will detect platform from the URL.
	
	// Validate storeMap is available before proceeding
	if (!storeMap || typeof storeMap !== 'object') {
		logger.error('❌ [ERROR] storeMap is not available in runBatch');
		throw new Error('storeMap configuration is not available in runBatch');
	}
	
	logger.info('✅ storeMap validated', { 
		availablePlatforms: Object.keys(storeMap)
	});
	
	const { executionTracker } = require('../services/executionTracker');
	
	try {
		if (!driver) {
			logger.info('🚗 Initializing driver...');
			driver = await initializeDriver();
			logger.info('✅ Driver initialized successfully');
		} else {
			logger.info('🚗 Using existing driver instance');
		}
		let totalExtracted = 0, totalStored = 0, createdCount = 0, updatedCount = 0;
		for (let pageIndex = 0; pageIndex < seedUrls.length; pageIndex++) {
			const url = seedUrls[pageIndex];

			if (!(await isDriverAlive(driver))) {
				logger.warn('WebDriver session lost — reinitializing', { pageIndex, url });
				try { await closeDriver(driver); } catch (_) {}
				driver = await initializeDriver();
			}
			
			// Detect platform from URL for tracker
			const { resolvePlatformFromUrl } = require('../utils/platformUtils');
			let platform = resolvePlatformFromUrl(url) || Object.keys(storeMap).find(key => url.toLowerCase().includes(key.toLowerCase())) || 'amazon';
			let category = categoryKey;

			if (platform === 'ajio' || platform === 'myntra') {
				const homepage = platform === 'ajio' ? 'https://www.ajio.com/' : 'https://www.myntra.com/';
				logger.info(`Navigating to ${platform} homepage first to establish session...`);
				try {
					await driver.get(homepage);
					await driver.sleep(4000);
				} catch (e) {
					logger.warn(`Failed to pre-load homepage for ${platform}`, { error: e.message });
				}
			}
			
			let extracted = 0, stored = 0, created = 0, updated = 0, products = [];
			try {
				await driver.get(url);
				await withTimeout(driver.wait(until.elementLocated(By.css('body')), 15000), (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE_WAIT');
				await driver.sleep(2000);
				
				const result = await extractAndStoreFromUrl(driver, url, sourceType, categoryKey, ctx, targetDb, platform, category, pageIndex);
				extracted = result.extracted || 0;
				stored = result.stored || 0;
				created = result.created || 0;
				updated = result.updated || 0;
				products = result.products || [];
			} catch (extractError) {
				logger.error('Error loading or extracting from URL (continuing to next page)', { 
					url, 
					error: extractError.message,
					platform,
					category,
					pageIndex
				});
				extracted = 0;
				stored = 0;
			}
			
			totalExtracted += extracted;
			totalStored += stored;
			createdCount += created;
			updatedCount += updated;
			
			// Update page progress with actual results (only after extraction)
			if (platform && category) {
				try {
					await executionTracker.updatePageProgress(platform, category, url, pageIndex, {
						totalProducts: extracted,
						processed: stored,
						created: created,
						updated: updated,
						errors: Math.max(0, extracted - stored)
					});
					
					// Update individual product progress
					if (products && products.length > 0) {
						for (const product of products) {
							if (product.productCode) {
								await executionTracker.updateProductProgress(
									platform,
									category,
									pageIndex,
									product.productCode,
									product.productId || product.productCode,
									'processed'
								);
							}
						}
					}
				} catch (trackerError) {
					// Silently continue - tracker is optional
					logger.debug('Page progress update failed (non-fatal)', { 
						platform, 
						category, 
						pageIndex,
						error: trackerError.message
					});
				}
			}
			
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
		if (driver && !existingDriver) await closeDriver(driver);
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
