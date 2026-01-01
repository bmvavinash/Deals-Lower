const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');
const { loadConfig, scrapePage } = require('../pageScheduler');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require('../utils/commonUtils');
const { findMatchingHierarchy, generateHierarchicalKey } = require('../config/categoryHierarchy');
const { DynamicCategoryExtractor } = require('../utils/dynamicCategoryExtractor');
const { missingDetailsTracker } = require('../utils/missingDetailsTracker');

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
	if (raw.deal && typeof raw.deal === 'string') return raw.deal;
	if (raw.discountPercentage && typeof raw.discountPercentage === 'string') return raw.discountPercentage;
	return '';
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
	
	return footwearKeywords.some(keyword => allText.includes(keyword));
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
	
	return electronicsKeywords.some(keyword => allText.includes(keyword));
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
	
	return fashionKeywords.some(keyword => allText.includes(keyword));
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
	
	return homeKeywords.some(keyword => allText.includes(keyword));
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
	
	return beautyKeywords.some(keyword => allText.includes(keyword));
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
	
	return sportsKeywords.some(keyword => allText.includes(keyword));
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

async function normalizeProduct(raw, url, sourceType = 'website', categoryKey = '', usedPageType = null) {
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
	// Generate affiliate links based on platform
	// Amazon: Use clean Amazon affiliate tag format (amazon.in/dp/ASIN?tag=xxx)
	// Non-Amazon: Use INR Deals URL
	if (/amazon\./i.test(hostname)) {
		// Amazon affiliate link - clean format with tag
		const amazonTag = 'dealshubglo0c-21';
		links.avinashbmvINR = `https://www.amazon.in/dp/${productCode}?tag=${amazonTag}`;
	} else {
		// Non-Amazon: Use INR Deals affiliate URL
		links.avinashbmvINR = `https://inrdeals.com/avi646476329/+${productUrl}`;
	}

	// Process hierarchical categories using dynamic extraction
	const categoryData = raw.category || {};
	let hierarchy;
	let hierarchicalKey;
	let categorySource = 'unknown';
	
	try {
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

async function extractAndStoreFromUrl(driver, url, sourceType = 'website', categoryKey = '', ctx = null, targetDb = 'deals', platform = null, category = null, pageIndex = null) {
	try {
		logger.info('Batch extracting page', { url, sourceType, categoryKey });
		const config = await loadConfig('./PageConfig/amazonPageConfig.js');
		const { rawProducts, usedPageType } = await withTimeout(tryConfigs(url, driver, config), (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE');
		if (ctx) {
			ctx.pageTypeHits[usedPageType || 'none'] = (ctx.pageTypeHits[usedPageType || 'none'] || 0) + 1;
		}
		const products = Array.isArray(rawProducts) ? await Promise.all(rawProducts.map(p => normalizeProduct(p, url, sourceType, categoryKey, usedPageType))) : [];
		if (products.length === 0) {
			logger.warn('No products extracted', { url });
			if (ctx) ctx.noProductUrls.push(url);
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

		// Return products for tracking
		return { 
			extracted: beforeCount, 
			stored: storedCount, 
			created: createdCount, 
			updated: updatedCount,
			products: uniqueProducts.map(p => ({ productCode: p.productCode, productId: p.id || p.productId || '' }))
		};
	} catch (error) {
		logger.error('extractAndStoreFromUrl error', { url, error: error.message });
		if (ctx) ctx.errors.push({ url, error: error.message });
		return { extracted: 0, stored: 0, created: 0, updated: 0, products: [] };
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
	
	// Extract platform and category from categoryKey (format: platform_category)
	const [platform, category] = categoryKey.split('_');
	const { executionTracker } = require('../services/executionTracker');
	
	try {
		driver = await initializeDriver();
		let totalExtracted = 0, totalStored = 0, createdCount = 0, updatedCount = 0;
		for (let pageIndex = 0; pageIndex < seedUrls.length; pageIndex++) {
			const url = seedUrls[pageIndex];
			
			// Update page progress
			if (platform && category) {
				await executionTracker.updatePageProgress(platform, category, url, pageIndex, {
					totalProducts: 0,
					processed: 0,
					created: 0,
					updated: 0,
					errors: 0
				});
			}
			
			await driver.get(url);
			await withTimeout(driver.wait(until.elementLocated(By.css('body')), 15000), (require('../config/constants').maxPageTimeoutMs || 120000), 'PAGE_WAIT');
			await driver.sleep(2000);
			const { extracted, stored, created, updated, products } = await extractAndStoreFromUrl(driver, url, sourceType, categoryKey, ctx, targetDb, platform, category, pageIndex);
			totalExtracted += extracted;
			totalStored += stored;
			createdCount += created;
			updatedCount += updated;
			
			// Update page progress with results
			if (platform && category) {
				await executionTracker.updatePageProgress(platform, category, url, pageIndex, {
					totalProducts: extracted,
					processed: stored,
					created: created,
					updated: updated,
					errors: extracted - stored
				});
				
				// Update product-level progress
				if (products && Array.isArray(products)) {
					for (const product of products) {
						await executionTracker.updateProductProgress(
							platform,
							category,
							pageIndex,
							product.productCode || '',
							product.productId || '',
							stored > 0 ? 'processed' : 'failed'
						);
					}
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
