const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('improvedBannerValidator');

/**
 * Improved Banner Validator
 * 
 * This module provides enhanced validation for banner extraction to ensure
 * only actual promotional banners are extracted, not product images or
 * affiliate commission details.
 */

class ImprovedBannerValidator {
    constructor() {
        // Keywords that indicate this is NOT a banner (product-related)
        this.productKeywords = [
            'product', 'item', 'goods', 'merchandise', 'inventory',
            'add to cart', 'buy now', 'shop now', 'view details',
            'price', 'discount', 'offer', 'deal', 'sale price',
            'product image', 'item image', 'product photo',
            'asin', 'sku', 'model', 'brand', 'manufacturer',
            'reviews', 'ratings', 'stars', 'customer review',
            'shipping', 'delivery', 'return', 'warranty',
            'specification', 'features', 'description', 'details',
            'samsung', 'mi', 'tv', 'mobile', 'phone', 'galaxy',
            'spigen', 'ez fit', 's24 ultra', 'washing machine',
            'specific product', 'individual item', 'cart', 'icon',
            'promo codes', 'influencer', 'marketing', 'associates'
        ];

        // Keywords that indicate affiliate/commission content (should be excluded)
        this.affiliateKeywords = [
            'commission', 'fee', 'affiliate', 'associate', 'earn', 'revenue',
            'commission rate', 'earning', 'partner', 'referral', 'cashback',
            'affiliate program', 'associate program', 'partner program',
            'referral fee', 'commission structure', 'earning potential',
            'affiliate link', 'tracking link', 'referral link',
            'whatsapp', 'telegram', 'contact', 'join', 'sign up'
        ];

        // Keywords that indicate this IS a promotional banner
        this.bannerKeywords = [
            'banner', 'hero', 'main', 'primary', 'featured',
            'promotional', 'promotion', 'campaign', 'advertisement',
            'sale banner', 'offer banner', 'deal banner',
            'festival', 'seasonal', 'holiday', 'celebration',
            'flash sale', 'mega sale', 'grand sale', 'big sale',
            'limited time', 'limited offer', 'exclusive offer',
            'new arrival', 'trending', 'popular', 'best seller',
            'central header', 'great indian festival', 'early deals', 'live now',
            'jupiter', 'teaser', 'header', 'event', 'goldbox'
        ];

        // Image dimension thresholds for banners
        this.bannerDimensions = {
            minWidth: 400,
            minHeight: 200,
            maxWidth: 2000,
            maxHeight: 800,
            minAspectRatio: 1.5, // width/height
            maxAspectRatio: 5.0
        };

        // URL patterns that indicate banner images
        this.bannerUrlPatterns = [
            /banner/i,
            /hero/i,
            /promo/i,
            /advertisement/i,
            /campaign/i,
            /featured/i,
            /main/i,
            /primary/i,
            /header/i,
            /jupiter/i,
            /teaser/i,
            /event/i,
            /festival/i,
            /goldbox/i,
            /central/i
        ];

        // URL patterns that indicate product images (should be excluded)
        this.productUrlPatterns = [
            /product/i,
            /item/i,
            /goods/i,
            /merchandise/i,
            /inventory/i,
            /catalog/i,
            /gallery/i,
            /thumbnail/i,
            /preview/i,
            /samsung/i,
            /mi_2/i,
            /spigen/i,
            /s24/i,
            /galaxy/i,
            /washing/i,
            /machine/i,
            /\.svg$/i,  // SVG icons
            /header_cart/i,  // Cart icons
            /header_3verticalDots/i,  // Menu icons
            /batman-returns/i,  // Icon directories
            /promo_codes/i,  // Promotional codes
            /influencer/i  // Influencer content
        ];
    }

    /**
     * Comprehensive banner validation
     * @param {Object} bannerData - Banner data to validate
     * @returns {Object} Validation result
     */
    validateBanner(bannerData) {
        const { imageUrl, altText, title, clickUrl, element } = bannerData;
        
        logger.debug('Validating banner candidate', { 
            imageUrl: imageUrl?.substring(0, 100), 
            altText: altText?.substring(0, 50) 
        });

        const validation = {
            isValid: true,
            reasons: [],
            confidence: 100,
            category: 'unknown'
        };

        // 1. Basic URL validation
        const urlValidation = this.validateImageUrl(imageUrl);
        if (!urlValidation.isValid) {
            validation.isValid = false;
            validation.reasons.push(urlValidation.reason);
            return validation;
        }

        // 2. Check if it's a product image (should be excluded)
        const productCheck = this.isProductImage(imageUrl, altText, title);
        if (productCheck.isProduct) {
            validation.isValid = false;
            validation.reasons.push(`Product image detected: ${productCheck.reason}`);
            return validation;
        }

        // 3. Check for affiliate/commission content (should be excluded)
        const affiliateCheck = this.containsAffiliateContent(altText, title, clickUrl);
        if (affiliateCheck.containsAffiliate) {
            validation.isValid = false;
            validation.reasons.push(`Affiliate content detected: ${affiliateCheck.reason}`);
            return validation;
        }

        // 4. Check if it's actually a banner
        const bannerCheck = this.isPromotionalBanner(imageUrl, altText, title);
        if (!bannerCheck.isBanner) {
            validation.isValid = false;
            validation.reasons.push(`Not a promotional banner: ${bannerCheck.reason}`);
            return validation;
        }

        // 5. Validate banner dimensions (if available)
        const dimensionCheck = this.validateBannerDimensions(bannerData);
        if (!dimensionCheck.isValid) {
            validation.isValid = false;
            validation.reasons.push(`Invalid dimensions: ${dimensionCheck.reason}`);
            return validation;
        }

        // 6. Calculate confidence score
        validation.confidence = this.calculateConfidence(bannerData);
        validation.category = bannerCheck.category;

        logger.debug('Banner validation completed', { 
            isValid: validation.isValid, 
            confidence: validation.confidence,
            category: validation.category,
            reasons: validation.reasons
        });

        return validation;
    }

    /**
     * Validate image URL
     * @param {string} imageUrl - Image URL to validate
     * @returns {Object} Validation result
     */
    validateImageUrl(imageUrl) {
        if (!imageUrl) {
            return { isValid: false, reason: 'No image URL provided' };
        }

        // Check for data URLs (usually small icons)
        if (imageUrl.startsWith('data:')) {
            return { isValid: false, reason: 'Data URL detected (likely icon)' };
        }

        // Check URL length (very short URLs are usually icons)
        if (imageUrl.length < 50) {
            return { isValid: false, reason: 'URL too short (likely icon)' };
        }

        // Check for common icon patterns
        const iconPatterns = [
            /icon/i,
            /logo/i,
            /sprite/i,
            /favicon/i,
            /\.ico$/i,
            /placeholder/i
        ];

        for (const pattern of iconPatterns) {
            if (pattern.test(imageUrl)) {
                return { isValid: false, reason: 'Icon/logo detected' };
            }
        }

        return { isValid: true };
    }

    /**
     * Check if image is a product image (should be excluded)
     * @param {string} imageUrl - Image URL
     * @param {string} altText - Alt text
     * @param {string} title - Title
     * @returns {Object} Check result
     */
    isProductImage(imageUrl, altText, title) {
        const text = `${altText || ''} ${title || ''}`.toLowerCase();
        const url = (imageUrl || '').toLowerCase();

        // Check URL patterns for product images
        for (const pattern of this.productUrlPatterns) {
            if (pattern.test(url)) {
                return { isProduct: true, reason: `Product URL pattern: ${pattern}` };
            }
        }

        // Check text for product keywords
        for (const keyword of this.productKeywords) {
            if (text.includes(keyword)) {
                return { isProduct: true, reason: `Product keyword: ${keyword}` };
            }
        }

        // Check for product-specific patterns
        const productPatterns = [
            /\d+\s*(?:rs|rupees|₹)/i, // Price patterns
            /add\s+to\s+cart/i,
            /buy\s+now/i,
            /shop\s+now/i,
            /view\s+details/i,
            /product\s+image/i,
            /item\s+image/i
        ];

        for (const pattern of productPatterns) {
            if (pattern.test(text)) {
                return { isProduct: true, reason: `Product pattern: ${pattern}` };
            }
        }

        return { isProduct: false };
    }

    /**
     * Check for affiliate/commission content (should be excluded)
     * @param {string} altText - Alt text
     * @param {string} title - Title
     * @param {string} clickUrl - Click URL
     * @returns {Object} Check result
     */
    containsAffiliateContent(altText, title, clickUrl) {
        const text = `${altText || ''} ${title || ''} ${clickUrl || ''}`.toLowerCase();

        // Check for affiliate keywords
        for (const keyword of this.affiliateKeywords) {
            if (text.includes(keyword)) {
                return { containsAffiliate: true, reason: `Affiliate keyword: ${keyword}` };
            }
        }

        // Check for percentage patterns (commission rates)
        const percentagePatterns = [
            /\d+%\s*(?:commission|fee|earning)/i,
            /commission\s*\d+%/i,
            /fee\s*\d+%/i,
            /earning\s*\d+%/i,
            /referral\s*\d+%/i
        ];

        for (const pattern of percentagePatterns) {
            if (pattern.test(text)) {
                return { containsAffiliate: true, reason: `Commission pattern: ${pattern}` };
            }
        }

        // Check for contact/social media patterns
        const contactPatterns = [
            /whatsapp/i,
            /telegram/i,
            /contact\s+us/i,
            /join\s+now/i,
            /sign\s+up/i,
            /register/i
        ];

        for (const pattern of contactPatterns) {
            if (pattern.test(text)) {
                return { containsAffiliate: true, reason: `Contact pattern: ${pattern}` };
            }
        }

        return { containsAffiliate: false };
    }

    /**
     * Check if image is a promotional banner
     * @param {string} imageUrl - Image URL
     * @param {string} altText - Alt text
     * @param {string} title - Title
     * @returns {Object} Check result
     */
    isPromotionalBanner(imageUrl, altText, title) {
        const text = `${altText || ''} ${title || ''}`.toLowerCase();
        const url = (imageUrl || '').toLowerCase();

        // Check URL patterns for banners
        for (const pattern of this.bannerUrlPatterns) {
            if (pattern.test(url)) {
                return { isBanner: true, category: 'hero', reason: `Banner URL pattern: ${pattern}` };
            }
        }

        // Check text for banner keywords
        for (const keyword of this.bannerKeywords) {
            if (text.includes(keyword)) {
                let category = 'promotional';
                if (['hero', 'main', 'primary', 'featured'].includes(keyword)) {
                    category = 'hero';
                } else if (['festival', 'seasonal', 'holiday', 'celebration'].includes(keyword)) {
                    category = 'seasonal';
                }
                return { isBanner: true, category, reason: `Banner keyword: ${keyword}` };
            }
        }

        // Check for promotional patterns
        const promoPatterns = [
            /(?:flash|mega|grand|big)\s+sale/i,
            /limited\s+(?:time|offer)/i,
            /exclusive\s+offer/i,
            /new\s+arrival/i,
            /trending/i,
            /popular/i,
            /best\s+seller/i,
            /up\s+to\s+\d+%\s+off/i,
            /save\s+up\s+to/i
        ];

        for (const pattern of promoPatterns) {
            if (pattern.test(text)) {
                return { isBanner: true, category: 'promotional', reason: `Promo pattern: ${pattern}` };
            }
        }

        // If no clear banner indicators, it's likely not a banner
        return { isBanner: false, reason: 'No banner indicators found' };
    }

    /**
     * Validate banner dimensions
     * @param {Object} bannerData - Banner data
     * @returns {Object} Validation result
     */
    validateBannerDimensions(bannerData) {
        // For now, we'll do basic URL-based dimension validation
        // In production, you might want to make HEAD requests to get actual dimensions
        
        const { imageUrl } = bannerData;
        if (!imageUrl) {
            return { isValid: false, reason: 'No image URL' };
        }

        // Extract dimensions from URL if available (common pattern: widthxheight)
        const dimensionMatch = imageUrl.match(/(\d+)x(\d+)/);
        if (dimensionMatch) {
            const width = parseInt(dimensionMatch[1]);
            const height = parseInt(dimensionMatch[2]);
            const aspectRatio = width / height;

            if (width < this.bannerDimensions.minWidth || height < this.bannerDimensions.minHeight) {
                return { isValid: false, reason: `Too small: ${width}x${height}` };
            }

            if (width > this.bannerDimensions.maxWidth || height > this.bannerDimensions.maxHeight) {
                return { isValid: false, reason: `Too large: ${width}x${height}` };
            }

            if (aspectRatio < this.bannerDimensions.minAspectRatio || aspectRatio > this.bannerDimensions.maxAspectRatio) {
                return { isValid: false, reason: `Invalid aspect ratio: ${aspectRatio.toFixed(2)}` };
            }
        }

        return { isValid: true };
    }

    /**
     * Calculate confidence score for banner
     * @param {Object} bannerData - Banner data
     * @returns {number} Confidence score (0-100)
     */
    calculateConfidence(bannerData) {
        let confidence = 50; // Base confidence
        const { imageUrl, altText, title } = bannerData;
        const text = `${altText || ''} ${title || ''}`.toLowerCase();
        const url = (imageUrl || '').toLowerCase();

        // Increase confidence for banner URL patterns
        for (const pattern of this.bannerUrlPatterns) {
            if (pattern.test(url)) {
                confidence += 20;
                break;
            }
        }

        // Increase confidence for banner keywords
        for (const keyword of this.bannerKeywords) {
            if (text.includes(keyword)) {
                confidence += 15;
                break;
            }
        }

        // Increase confidence for promotional patterns
        const promoPatterns = [
            /(?:flash|mega|grand|big)\s+sale/i,
            /limited\s+(?:time|offer)/i,
            /exclusive\s+offer/i,
            /up\s+to\s+\d+%\s+off/i,
            /great\s+indian\s+festival/i,
            /early\s+deals/i,
            /live\s+now/i
        ];

        for (const pattern of promoPatterns) {
            if (pattern.test(text)) {
                confidence += 25;
                break;
            }
        }

        // Decrease confidence for product indicators
        for (const keyword of this.productKeywords) {
            if (text.includes(keyword)) {
                confidence -= 30;
                break;
            }
        }

        // Check for banners with empty bottom sections (potential layout issues)
        if (this.hasEmptyBottomSection(bannerData)) {
            confidence -= 20;
        }

        return Math.max(0, Math.min(100, confidence));
    }

    /**
     * Check if banner has empty bottom section (potential layout issue)
     * @param {Object} bannerData - Banner data
     * @returns {boolean} True if banner might have empty bottom section
     */
    hasEmptyBottomSection(bannerData) {
        const { imageUrl, altText, title } = bannerData;
        const text = `${altText || ''} ${title || ''}`.toLowerCase();
        const url = (imageUrl || '').toLowerCase();

        // Check for patterns that might indicate empty bottom sections
        const emptyBottomPatterns = [
            /teaser/i,
            /header/i,
            /top\s+section/i,
            /partial/i
        ];

        return emptyBottomPatterns.some(pattern => pattern.test(text) || pattern.test(url));
    }

    /**
     * Get banner category and priority
     * @param {Object} bannerData - Banner data
     * @returns {Object} Category and priority
     */
    getBannerCategory(bannerData) {
        const { imageUrl, altText, title } = bannerData;
        const text = `${altText || ''} ${title || ''}`.toLowerCase();
        const url = (imageUrl || '').toLowerCase();

        // Hero banners (highest priority)
        const heroKeywords = ['hero', 'main', 'primary', 'featured', 'banner'];
        if (heroKeywords.some(keyword => text.includes(keyword) || url.includes(keyword))) {
            return { category: 'hero', priority: 1 };
        }

        // Seasonal banners
        const seasonalKeywords = ['festival', 'seasonal', 'holiday', 'celebration', 'diwali', 'christmas', 'eid'];
        if (seasonalKeywords.some(keyword => text.includes(keyword))) {
            return { category: 'seasonal', priority: 2 };
        }

        // Promotional banners
        const promoKeywords = ['sale', 'offer', 'deal', 'discount', 'save', 'off', 'promo'];
        if (promoKeywords.some(keyword => text.includes(keyword))) {
            return { category: 'promotional', priority: 3 };
        }

        // Category banners (lowest priority)
        return { category: 'category', priority: 4 };
    }
}

module.exports = { ImprovedBannerValidator };
