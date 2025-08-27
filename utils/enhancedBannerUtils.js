const { getModuleLogger } = require("../logger/logger");

const logger = getModuleLogger('enhancedBannerUtils');

// Enhanced banner validation functions
class EnhancedBannerUtils {
	
	// Check if image is likely a promotional banner vs product image
	static isPromotionalBanner(altText, title, url, imageUrl, elementContext) {
		const text = (altText || title || "").toLowerCase();
		const urlText = (url || "").toLowerCase();
		const imageUrlText = (imageUrl || "").toLowerCase();
		
		// Strong indicators of promotional banners
		const promotionalKeywords = [
			'sale', 'offer', 'deal', 'discount', 'save', 'off', 'clearance',
			'festival', 'celebration', 'event', 'special', 'limited time',
			'up to', 'starting at', 'flash sale', 'daily deals', 'trending',
			'new arrival', 'best seller', 'featured', 'hero', 'banner',
			'prime', 'bounty', 'serve', 'trend talk', 'great freedom'
		];
		
		// Strong indicators of product images (should be excluded)
		const productKeywords = [
			'product', 'item', 'goods', 'merchandise', 'inventory',
			'add to cart', 'buy now', 'shop now', 'view details',
			'price', 'mrp', 'cost', 'amount', 'quantity', 'stock',
			'size', 'color', 'brand', 'model', 'sku', 'asin'
		];
		
		// Non-banner indicators (should be excluded)
		const nonBannerKeywords = [
			'flag', 'icon', 'logo', 'whatsapp', 'channel', 'social',
			'small', 'tiny', 'thumbnail'
		];
		
		// Check for promotional content
		const hasPromotionalContent = promotionalKeywords.some(keyword => 
			text.includes(keyword) || urlText.includes(keyword)
		);
		
		// Check for product content
		const hasProductContent = productKeywords.some(keyword => 
			text.includes(keyword) || urlText.includes(keyword)
		);
		
		// Check for non-banner content
		const hasNonBannerContent = nonBannerKeywords.some(keyword => 
			text.includes(keyword) || urlText.includes(keyword) || imageUrlText.includes(keyword)
		);
		
		// Check image URL patterns for promotional banners
		const hasPromotionalImagePattern = this.hasPromotionalImagePattern(imageUrlText);
		
		// Check for affiliate content (should be excluded)
		const hasAffiliateContent = this.hasAffiliateContent(text, urlText);
		
		// Check element context (carousel, hero section, etc.)
		const hasBannerContext = this.hasBannerContext(elementContext);
		
		// Check if image URL suggests it's a small/non-banner image
		const isSmallImage = this.isSmallImage(imageUrlText, text);
		
		// Scoring system
		let score = 0;
		
		if (hasPromotionalContent) score += 3;
		if (hasPromotionalImagePattern) score += 2;
		if (hasBannerContext) score += 2;
		if (hasProductContent) score -= 2;
		if (hasAffiliateContent) score -= 5;
		if (hasNonBannerContent) score -= 4;
		if (isSmallImage) score -= 3;
		
		// Must have positive score and no affiliate/non-banner content
		return score > 0 && !hasAffiliateContent && !hasNonBannerContent && !isSmallImage;
	}
	
	// Check if image URL suggests it's a small/non-banner image
	static isSmallImage(imageUrl, altText) {
		if (!imageUrl) return false;
		
		const url = imageUrl.toLowerCase();
		const text = (altText || "").toLowerCase();
		
		// Small image indicators
		const smallImagePatterns = [
			/flag/i,
			/icon/i,
			/logo/i,
			/gif/i,
			/\.gif$/i,
			/\.ico$/i,
			/_V\d+_/i
		];
		
		// Check URL patterns
		const hasSmallImagePattern = smallImagePatterns.some(pattern => 
			pattern.test(url)
		);
		
		// Check alt text for small image indicators
		const hasSmallImageText = text.includes('flag') || 
								 text.includes('icon') || 
								 text.includes('logo');
		
		return hasSmallImagePattern || hasSmallImageText;
	}
	
	// Check if image URL follows promotional banner patterns
	static hasPromotionalImagePattern(imageUrl) {
		if (!imageUrl) return false;
		
		// Common promotional banner image patterns
		const bannerPatterns = [
			/banner/i,
			/hero/i,
			/promo/i,
			/sale/i,
			/offer/i,
			/deal/i,
			/event/i,
			/festival/i,
			/carousel/i,
			/slider/i,
			/advertisement/i,
			/campaign/i,
			/associates/i,
			/augart/i,
			/fashion/i,
			/beauty/i,
			/consumables/i,
			/lawn/i,
			/garden/i
		];
		
		return bannerPatterns.some(pattern => pattern.test(imageUrl));
	}
	
	// Enhanced affiliate content detection
	static hasAffiliateContent(text, url) {
		if (!text && !url) return false;
		
		const combinedText = `${text || ''} ${url || ''}`.toLowerCase();
		
		// Affiliate/program-specific keywords (expanded to exclude Prime Bounty etc.)
		const affiliateKeywords = [
			'commission', 'fee', 'affiliate', 'earning', 'revenue',
			'commission rate', 'partner', 'referral', 'cashback',
			'associates program', 'affiliate program', 'partner program',
			'earn money', 'make money', 'income', 'profit', 'revenue share',
			'amazonprime', 'prime bounty', 'bounty', 'join prime', 'prime membership'
		];
		
		// Percentage patterns for commission/fees
		const percentagePatterns = [
			/\d+%\s*(?:commission|fee|earning|revenue)/i,
			/commission\s*\d+%/i,
			/fee\s*\d+%/i,
			/earning\s*\d+%/i,
			/revenue\s*\d+%/i
		];
		
		// Check for affiliate keywords
		const hasAffiliateKeywords = affiliateKeywords.some(keyword => 
			combinedText.includes(keyword)
		);
		
		// Check for percentage patterns
		const hasPercentagePatterns = percentagePatterns.some(pattern => 
			pattern.test(combinedText)
		);
		
		return hasAffiliateKeywords || hasPercentagePatterns;
	}
	
	// Check if element context suggests it's a banner
	static hasBannerContext(elementContext) {
		if (!elementContext) return false;
		
		const context = elementContext.toLowerCase();
		
		// Banner-friendly contexts
		const bannerContexts = [
			'carousel', 'slider', 'hero', 'banner', 'promotional',
			'featured', 'main', 'primary', 'top', 'header',
			'advertisement', 'campaign', 'event', 'festival'
		];
		
		// Product-unfriendly contexts
		const productContexts = [
			'product', 'item', 'listing', 'grid', 'catalog',
			'search result', 'filter', 'category', 'brand'
		];
		
		const hasBannerContext = bannerContexts.some(keyword => 
			context.includes(keyword)
		);
		
		const hasProductContext = productContexts.some(keyword => 
			context.includes(keyword)
		);
		
		return hasBannerContext && !hasProductContext;
	}
	
	// Validate banner dimensions (rectangular shape)
	static validateBannerDimensions(width, height) {
		if (!width || !height) return { isValid: false, reason: 'Missing dimensions' };
		
		const aspectRatio = width / height;
		
		// Banners should be rectangular (width > height)
		if (aspectRatio < 1.2) {
			return { isValid: false, reason: 'Not rectangular enough (aspect ratio < 1.2)' };
		}
		
		// Too wide banners might be product grids
		if (aspectRatio > 5) {
			return { isValid: false, reason: 'Too wide (aspect ratio > 5)' };
		}
		
		// Minimum dimensions for banners
		if (width < 300 || height < 100) {
			return { isValid: false, reason: 'Too small (min: 300x100)' };
		}
		
		return { isValid: true, aspectRatio };
	}
	
	// Generate banner ID with platform prefix
	static generateBannerId(platform, url, index = 0) {
		const timestamp = Date.now();
		const urlHash = this.hashString(url || 'unknown');
		return `${platform}-banner-${urlHash}-${index}`;
	}
	
	// Simple string hashing for URL
	static hashString(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
	
	// Extract banner metadata
	static extractBannerMetadata(element, platform, sourceUrl) {
		try {
			const metadata = {
				platform: platform,
				sourceUrl: sourceUrl,
				extractionTimestamp: new Date().toISOString(),
				elementType: element.tagName?.toLowerCase() || 'unknown',
				elementClasses: element.className || '',
				elementId: element.id || '',
				parentContext: this.getParentContext(element)
			};
			
			return metadata;
		} catch (error) {
			logger.error('Error extracting banner metadata:', { error: error.message });
			return null;
		}
	}
	
	// Get parent context for better banner identification
	static getParentContext(element) {
		try {
			const parent = element.parentElement;
			if (!parent) return 'no-parent';
			
			const parentClasses = parent.className || '';
			const parentId = parent.id || '';
			const parentTag = parent.tagName?.toLowerCase() || '';
			
			return `${parentTag}${parentId ? '#' + parentId : ''}${parentClasses ? '.' + parentClasses.split(' ').join('.') : ''}`;
		} catch (error) {
			return 'unknown-context';
		}
	}
	
	// Comprehensive banner validation
	static validateBanner(altText, title, url, imageUrl, elementContext, dimensions = null) {
		const validation = {
			isValid: false,
			reasons: [],
			score: 0,
			category: 'unknown'
		};
		
		// Check for affiliate content first
		if (this.hasAffiliateContent(altText, url)) {
			validation.reasons.push('Contains affiliate content');
			validation.score -= 5;
		}
		
		// Check for non-banner content
		if (this.isSmallImage(imageUrl, altText)) {
			validation.reasons.push('Appears to be small/non-banner image');
			validation.score -= 3;
		}
		
		// Check if it's a promotional banner
		if (this.isPromotionalBanner(altText, title, url, imageUrl, elementContext)) {
			validation.score += 3;
			validation.reasons.push('Identified as promotional banner');
		} else {
			validation.score -= 2;
			validation.reasons.push('Not identified as promotional banner');
		}
		
		// Check image patterns
		if (this.hasPromotionalImagePattern(imageUrl)) {
			validation.score += 2;
			validation.reasons.push('Has promotional image pattern');
		}
		
		// Check context
		if (this.hasBannerContext(elementContext)) {
			validation.score += 2;
			validation.reasons.push('Has banner context');
		}
		
		// Check dimensions if provided
		if (dimensions) {
			const dimensionValidation = this.validateBannerDimensions(dimensions.width, dimensions.height);
			if (dimensionValidation.isValid) {
				validation.score += 1;
				validation.reasons.push('Valid banner dimensions');
			} else {
				validation.score -= 1;
				validation.reasons.push(`Dimension issue: ${dimensionValidation.reason}`);
			}
		}
		
		// Determine category based on score
		if (validation.score >= 5) {
			validation.category = 'hero';
		} else if (validation.score >= 3) {
			validation.category = 'promotional';
		} else if (validation.score >= 1) {
			validation.category = 'category';
		} else {
			validation.category = 'low-quality';
		}
		
		// Final validation decision - stricter requirements
		validation.isValid = validation.score >= 3 && 
						  !validation.reasons.some(reason => 
							  reason.includes('affiliate content') ||
							  reason.includes('small/non-banner image')
						  );
		
		return validation;
	}
}

module.exports = EnhancedBannerUtils;
