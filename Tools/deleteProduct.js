#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { bannerDB } = require('../database/firebaseDB/bannerDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('deleteProduct');

class ProductDeleter {
    constructor() {
        this.dealsFile = path.join(__dirname, '../database/deals.json');
        this.bannerFile = path.join(__dirname, '../database/banner.json');
        this.backupDir = path.join(__dirname, '../database/backups');
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // Create backup before deletion
    createBackup(filePath, type) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `${type}-backup-${timestamp}.json`);
            
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, backupPath);
                logger.info(`Backup created: ${backupPath}`);
                return backupPath;
            } else {
                logger.warn(`File not found for backup: ${filePath}`);
            }
        } catch (error) {
            logger.error(`Error creating backup: ${error.message}`, error);
        }
        return null;
    }

    // Load JSON file
    loadJsonFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                logger.debug(`Loading file: ${filePath}`);
                const data = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(data);
                logger.debug(`Successfully loaded ${Object.keys(parsed).length} records from ${filePath}`);
                return parsed;
            } else {
                logger.warn(`File not found: ${filePath}`);
            }
            return {};
        } catch (error) {
            logger.error(`Error loading file ${filePath}: ${error.message}`, error);
            return {};
        }
    }

    // Save JSON file
    saveJsonFile(filePath, data) {
        try {
            logger.debug(`Saving file: ${filePath} with ${Object.keys(data).length} records`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            logger.info(`File saved: ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`Error saving file ${filePath}: ${error.message}`, error);
            return false;
        }
    }

    // Delete products from deals.json
    async deleteProductsFromDeals(criteria = {}) {
        console.log('🗑️  Deleting products from deals.json...');
        
        // Create backup
        this.createBackup(this.dealsFile, 'deals');
        
        const deals = this.loadJsonFile(this.dealsFile);
        const originalCount = Object.keys(deals).length;
        let deletedCount = 0;
        const deletedProducts = [];
        
        for (const [productId, product] of Object.entries(deals)) {
            let shouldDelete = false;
            let reason = '';
            
            // Check criteria
            if (criteria.platform && product.storeType !== criteria.platform) {
                shouldDelete = true;
                reason = `Platform mismatch: ${product.storeType} != ${criteria.platform}`;
            }
            
            if (criteria.minDiscount && (!product.discount || product.discount < criteria.minDiscount)) {
                shouldDelete = true;
                reason = `Discount too low: ${product.discount || 0} < ${criteria.minDiscount}`;
            }
            
            if (criteria.maxDiscount && product.discount && product.discount > criteria.maxDiscount) {
                shouldDelete = true;
                reason = `Discount too high: ${product.discount} > ${criteria.maxDiscount}`;
            }
            
            if (criteria.olderThan) {
                const productDate = new Date(product.creationTimestamp || product.timestamp || Date.now());
                const cutoffDate = new Date(Date.now() - criteria.olderThan * 24 * 60 * 60 * 1000);
                if (productDate < cutoffDate) {
                    shouldDelete = true;
                    reason = `Product too old: ${productDate.toISOString()}`;
                }
            }
            
            if (criteria.inactive && product.isActive === false) {
                shouldDelete = true;
                reason = 'Product is inactive';
            }
            
            if (shouldDelete) {
                deletedProducts.push({ id: productId, reason, product });
                delete deals[productId];
                deletedCount++;
            }
        }
        
        // Save updated deals
        if (this.saveJsonFile(this.dealsFile, deals)) {
            console.log(`✅ Deleted ${deletedCount} products from deals.json`);
            console.log(`   Original count: ${originalCount}`);
            console.log(`   Remaining count: ${Object.keys(deals).length}`);
            
            // Log deleted products
            if (deletedProducts.length > 0) {
                console.log('\n📋 Deleted products:');
                deletedProducts.forEach(({ id, reason, product }) => {
                    console.log(`   - ${id}: ${reason}`);
                    console.log(`     ${product.name || 'No name'} (${product.storeType})`);
                });
            }
        }
        
        return {
            success: true,
            deleted: deletedCount,
            original: originalCount,
            remaining: Object.keys(deals).length,
            deletedProducts
        };
    }

    // Clean up banner.json - deactivate unwanted banners instead of deleting
    async cleanupBannerJson(options = {}) {
        const skipValidation = options.skipValidation || false;
        
        if (skipValidation) {
            console.log('🧹 Deactivating ALL banners in banner.json (skipping validation)...');
            logger.info('Starting banner.json deactivation process (ALL banners)');
        } else {
            console.log('🧹 Deactivating unwanted banners in banner.json...');
            logger.info('Starting banner.json deactivation process');
        }
        
        // Create backup
        const backupPath = this.createBackup(this.bannerFile, 'banner');
        logger.info(`Backup created at: ${backupPath}`);
        
        const banners = this.loadJsonFile(this.bannerFile);
        const originalCount = Object.keys(banners).length;
        logger.info(`Loaded ${originalCount} banners from banner.json`);
        
        let deactivatedCount = 0;
        const deactivatedBanners = [];
        const activeBanners = [];
        
        if (skipValidation) {
            logger.info(`Deactivating ALL ${originalCount} banners (no validation)...`);
            
            for (const [bannerId, banner] of Object.entries(banners)) {
                logger.debug(`Deactivating banner: ${bannerId}`);
                
                // Set isActive = false for ALL banners
                banners[bannerId].isActive = false;
                banners[bannerId].updateTimestamp = new Date().toISOString();
                
                deactivatedBanners.push({ 
                    id: bannerId, 
                    reason: 'Deactivated all banners (skip validation)', 
                    banner: banners[bannerId],
                    score: 0 
                });
                deactivatedCount++;
            }
        } else {
            logger.info(`Starting validation of ${originalCount} banners...`);
            
            for (const [bannerId, banner] of Object.entries(banners)) {
                logger.debug(`Validating banner: ${bannerId}`);
                logger.debug(`Banner data: ${JSON.stringify(banner, null, 2)}`);
                
                const validationResult = this.validateBannerRecord(banner, bannerId);
                
                logger.info(`Banner ${bannerId} validation result:`, {
                    shouldDeactivate: validationResult.shouldDelete,
                    score: validationResult.score,
                    reason: validationResult.reason,
                    details: validationResult.details
                });
                
                if (validationResult.shouldDelete) {
                    logger.warn(`Marking banner ${bannerId} for deactivation (Score: ${validationResult.score})`);
                    // Set isActive = false instead of deleting
                    banners[bannerId].isActive = false;
                    banners[bannerId].updateTimestamp = new Date().toISOString();
                    
                    deactivatedBanners.push({ 
                        id: bannerId, 
                        reason: validationResult.reason, 
                        banner: banners[bannerId],
                        score: validationResult.score 
                    });
                    deactivatedCount++;
                } else {
                    logger.info(`Keeping banner ${bannerId} active (Score: ${validationResult.score})`);
                    // Ensure banner is active
                    banners[bannerId].isActive = true;
                    
                    activeBanners.push({ 
                        id: bannerId, 
                        reason: validationResult.reason, 
                        banner: banners[bannerId],
                        score: validationResult.score 
                    });
                }
            }
        }
        
        logger.info(`Validation complete. Deactivated: ${deactivatedCount}, Active: ${activeBanners.length}`);
        
        // Save updated banners
        if (this.saveJsonFile(this.bannerFile, banners)) {
            console.log(`✅ Deactivated unwanted banners in banner.json`);
            console.log(`   Original count: ${originalCount}`);
            console.log(`   Total count: ${Object.keys(banners).length}`);
            console.log(`   Deactivated count: ${deactivatedCount}`);
            console.log(`   Active count: ${activeBanners.length}`);
            
            logger.info(`Deactivation summary:`, {
                original: originalCount,
                total: Object.keys(banners).length,
                deactivated: deactivatedCount,
                active: activeBanners.length
            });
            
            // Log deactivated banners
            if (deactivatedBanners.length > 0) {
                console.log('\n📋 Deactivated banners:');
                logger.warn(`Deactivated ${deactivatedBanners.length} banners:`, deactivatedBanners.map(b => ({ id: b.id, reason: b.reason, score: b.score })));
                deactivatedBanners.forEach(({ id, reason, banner, score }) => {
                    console.log(`   - ${id}: ${reason} (Score: ${score})`);
                    console.log(`     ${banner.title || 'No title'}`);
                });
            }
            
            // Log active banners
            if (activeBanners.length > 0) {
                console.log('\n✅ Active banners:');
                logger.info(`Active ${activeBanners.length} banners:`, activeBanners.map(b => ({ id: b.id, reason: b.reason, score: b.score })));
                activeBanners.forEach(({ id, reason, banner, score }) => {
                    console.log(`   - ${id}: ${reason} (Score: ${score})`);
                    console.log(`     ${banner.title || 'No title'}`);
                });
            }
        }
        
        logger.info('Banner.json deactivation process completed');
        
        return {
            success: true,
            deactivated: deactivatedCount,
            original: originalCount,
            total: Object.keys(banners).length,
            active: activeBanners.length,
            deactivatedBanners,
            activeBanners
        };
    }

    // Enhanced validation logic for banner records
    validateBannerRecord(banner, bannerId) {
        logger.debug(`Starting validation for banner: ${bannerId}`);
        
        let score = 0;
        const reasons = [];
        let shouldDelete = false;
        
        const bannerText = (banner.title || banner.description || '').toLowerCase();
        logger.debug(`Banner text: "${bannerText}"`);
        
        // 1. Check for product-specific keywords (high priority for deletion)
        const productKeywords = [
            'product', 'item', 'goods', 'merchandise', 'inventory',
            'add to cart', 'buy now', 'shop now', 'view details',
            'price', 'discount', 'offer', 'deal', 'sale', 'rs.', '₹',
            'laptop', 'phone', 'mobile', 'tv', 'camera', 'headphone', 'speaker',
            'shirt', 'dress', 'shoes', 'bag', 'watch', 'jewelry',
            'realme', 'asus', 'samsung', 'apple', 'iphone', 'vivo', 'oppo',
            'oneplus', 'motorola', 'poco', 'xiaomi', 'nokia', 'lg', 'sony'
        ];
        
        const hasProductKeywords = productKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasProductKeywords) {
            score += 80; // Very high penalty for product keywords
            reasons.push('Product-specific content detected');
            logger.debug(`Product keywords detected in banner ${bannerId}, score +80`);
        }
        
        // 2. Check image dimensions from URL
        if (banner.url) {
            const url = banner.url.toLowerCase();
            logger.debug(`Checking URL: ${url}`);
            
            // Extract dimensions from URL if present
            const dimensionMatch = url.match(/(\d+)x(\d+)/);
            if (dimensionMatch) {
                const width = parseInt(dimensionMatch[1]);
                const height = parseInt(dimensionMatch[2]);
                const aspectRatio = width / height;
                
                logger.debug(`Image dimensions: ${width}x${height}, aspect ratio: ${aspectRatio.toFixed(2)}`);
                
                // Check for square images (likely product images) - more aggressive
                if (Math.abs(aspectRatio - 1) < 0.2) { // Increased tolerance for square detection
                    score += 60;
                    reasons.push('Square/near-square image detected (likely product image)');
                    logger.debug(`Square/near-square image detected (${aspectRatio.toFixed(2)}), score +60`);
                }
                
                // Check for very small images
                if (width < 400 || height < 200) { // Increased minimum size
                    score += 40;
                    reasons.push('Image too small for banner');
                    logger.debug(`Small image detected (${width}x${height}), score +40`);
                }
                
                // Check for very large images
                if (width > 1000 || height > 500) { // Reduced maximum size
                    score += 35;
                    reasons.push('Image too large for banner');
                    logger.debug(`Large image detected (${width}x${height}), score +35`);
                }
                
                // Check for extreme aspect ratios - much more aggressive
                if (aspectRatio > 2.0 || aspectRatio < 0.5) { // Even more restrictive aspect ratio
                    score += 50;
                    reasons.push('Extreme aspect ratio detected');
                    logger.debug(`Extreme aspect ratio detected (${aspectRatio.toFixed(2)}), score +50`);
                }
                
                // Check for tall/narrow images (height > width) - these should be deleted
                if (aspectRatio < 0.8) { // Height is significantly larger than width
                    score += 80;
                    reasons.push('Tall/narrow image detected (height > width)');
                    logger.debug(`Tall/narrow image detected (${aspectRatio.toFixed(2)}), score +80`);
                }
            } else {
                logger.debug(`No dimension pattern found in URL`);
            }
            
                         // Check for specific size patterns in URL
             const smallSizes = ['100x100', '150x150', '200x200', '300x300', '400x400', '500x500'];
             const largeSizes = ['1200x1200', '1500x1500', '2000x2000', '1000x1000'];
             const squareSizes = ['240x220', '220x240', '240x240', '220x220']; // Almost square sizes
             
             if (smallSizes.some(size => url.includes(size))) {
                 score += 50;
                 reasons.push('Small image size pattern detected');
                 logger.debug(`Small size pattern detected in URL, score +50`);
             }
             
             if (largeSizes.some(size => url.includes(size))) {
                 score += 40;
                 reasons.push('Large image size pattern detected');
                 logger.debug(`Large size pattern detected in URL, score +40`);
             }
             
                           // Check for almost square sizes (like 240x220) - multiple patterns
              const squarePatterns = [
                '240x220', '220x240', '240x240', '220x220',
                '_SR240,220_', '_SR220,240_', '240,220', '220,240'
              ];
              if (squarePatterns.some(pattern => url.includes(pattern))) {
                  score += 90; // Very high penalty for almost square sizes
                  reasons.push('Almost square image size detected (240x220, 220x240, etc.)');
                  logger.debug(`Almost square size pattern detected in URL, score +90`);
              }
        } else {
            logger.debug(`No URL found in banner ${bannerId}`);
        }
        
        // 3. Check for affiliate-specific content
        const affiliateKeywords = [
            'commission', 'fee', 'affiliate', 'associate', 'earn', 'revenue',
            'commission rate', 'earning', 'partner', 'referral', 'cashback',
            '9%', '10%', '15%', '20%', '25%', '30%'
        ];
        
        const hasAffiliateKeywords = affiliateKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasAffiliateKeywords) {
            score += 45;
            reasons.push('Affiliate-specific content detected');
            logger.debug(`Affiliate keywords detected, score +45`);
        }
        
        // 4. Check for promotional content (positive indicator) - only very specific ones
        const strongPromotionalKeywords = ['freedom', 'live now', 'freedom sale'];
        const hasStrongPromotionalKeywords = strongPromotionalKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasStrongPromotionalKeywords) {
            score -= 50; // Very high positive score for specific promotional content
            reasons.push('Strong promotional content detected (keep this)');
            logger.debug(`Strong promotional keywords detected, score -50`);
        }
        
        // Regular promotional keywords get much lower positive score
        const promotionalKeywords = ['sale', 'offer', 'deal', 'discount', 'save', 'off', 'limited'];
        const hasPromotionalKeywords = promotionalKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasPromotionalKeywords) {
            score -= 5; // Very low positive score for regular promotional content
            reasons.push('Promotional content detected (good)');
            logger.debug(`Promotional keywords detected, score -5`);
        }
        
        // 5. Check for brand/store names (positive indicator)
        const brandKeywords = ['amazon', 'flipkart', 'myntra', 'ajio', 'brand', 'store', 'icici', 'bobcard'];
        const hasBrandKeywords = brandKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasBrandKeywords) {
            score -= 2; // Very low positive score for brand content
            reasons.push('Brand/store content detected (good)');
            logger.debug(`Brand keywords detected, score -2`);
        }
        
        // 6. Check URL quality
        if (banner.url) {
            const url = banner.url.toLowerCase();
            
            // Check for common banner image domains
            const bannerDomains = ['cdn', 'images', 'static', 'media', 'assets'];
            const hasBannerDomain = bannerDomains.some(domain => url.includes(domain));
            
            if (hasBannerDomain) {
                score -= 1; // Very low positive score for banner-like domains
                reasons.push('Banner-like domain detected (good)');
                logger.debug(`Banner-like domain detected, score -1`);
            }
            
            // Check for product image domains
            const productDomains = ['product', 'item', 'goods'];
            const hasProductDomain = productDomains.some(domain => url.includes(domain));
            
            if (hasProductDomain) {
                score += 25;
                reasons.push('Product-like domain detected');
                logger.debug(`Product-like domain detected, score +25`);
            }
        }
        
        // 7. Check for missing essential fields
        if (!banner.title && !banner.description) {
            score += 20;
            reasons.push('Missing title and description');
            logger.debug(`Missing title and description, score +20`);
        }
        
        if (!banner.url) {
            score += 30;
            reasons.push('Missing image URL');
            logger.debug(`Missing image URL, score +30`);
        }
        
        // 8. Check for product image indicators (very specific to product photos)
        const productImageIndicators = [
            'image', 'img', 'photo', 'picture', 'snapshot',
            'realme smart tv', 'asus vivobook', 'laptop', 'mobile phone',
            'smartphone', 'television', 'camera', 'headphones'
        ];
        
        const hasProductImageIndicators = productImageIndicators.some(indicator => 
            bannerText.includes(indicator.toLowerCase())
        );
        
        if (hasProductImageIndicators) {
            score += 70; // Very high penalty for product image indicators
            reasons.push('Product image indicators detected');
            logger.debug(`Product image indicators detected, score +70`);
        }
        
        // 9. Check for generic/meaningless content
        const genericKeywords = ['image', 'img', 'photo', 'picture', 'snapshot', '55', 'minutes', 'fashion', 'beauty'];
        const hasGenericKeywords = genericKeywords.some(keyword => 
            bannerText.includes(keyword.toLowerCase())
        );
        
        if (hasGenericKeywords) {
            score += 40; // High penalty for generic content
            reasons.push('Generic/meaningless content detected');
            logger.debug(`Generic content detected, score +40`);
        }
        
        // 10. Check for very short titles (likely product images)
        if (bannerText.length < 10) {
            score += 30;
            reasons.push('Very short title (likely product image)');
            logger.debug(`Very short title detected (${bannerText.length} chars), score +30`);
        }
        
        // Decision logic - deactivate almost everything except very specific promotional banners
        shouldDelete = score >= -5; // Deactivate almost all banners (extremely aggressive)
        
        logger.debug(`Final validation result for banner ${bannerId}:`, {
            score,
            shouldDelete,
            reasons,
            bannerText: bannerText.substring(0, 100) + (bannerText.length > 100 ? '...' : ''),
            url: banner.url ? banner.url.substring(0, 100) + (banner.url.length > 100 ? '...' : '') : 'No URL'
        });
        
        return {
            shouldDelete,
            reason: reasons.join('; '),
            score,
            details: {
                hasProductKeywords,
                hasAffiliateKeywords,
                hasPromotionalKeywords,
                hasBrandKeywords,
                reasons
            }
        };
    }

    // Clean up Firebase banners - deactivate instead of delete
    async cleanupFirebaseBanners(options = {}) {
        const skipValidation = options.skipValidation || false;
        const delete240x220 = options.delete240x220 || false;
        const activateAll = options.activateAll || false;
        const deactivateAll = options.deactivateAll || false;
        
        if (delete240x220) {
            console.log('🗑️  DELETING banners with 240x220 dimensions from Firebase...');
            logger.info('Starting Firebase banners deletion process (240x220 dimensions)');
        } else if (activateAll) {
            console.log('✅ ACTIVATING ALL Firebase banners...');
            logger.info('Starting Firebase banners activation process (ALL banners)');
        } else if (deactivateAll) {
            console.log('🔥 DEACTIVATING ALL Firebase banners...');
            logger.info('Starting Firebase banners deactivation process (ALL banners)');
        } else if (skipValidation) {
            console.log('🔥 Deactivating ALL Firebase banners (skipping validation)...');
            logger.info('Starting Firebase banners deactivation process (ALL banners)');
        } else {
            console.log('🔥 Deactivating unwanted Firebase banners...');
            logger.info('Starting Firebase banners deactivation process');
        }
        
        try {
            logger.info('Fetching banners from Firebase...');
            const allBanners = await bannerDB.getAllBanners();
            
            if (allBanners.status !== 200) {
                logger.error(`Error fetching banners from Firebase: ${allBanners.status}`);
                console.log('❌ Error fetching banners from Firebase');
                return { success: false };
            }
            
            const banners = allBanners.data || {};
            const originalCount = Object.keys(banners).length;
            logger.info(`Fetched ${originalCount} banners from Firebase`);
            
            let deactivatedCount = 0;
            const deactivatedBanners = [];
            const activeBanners = [];
            
            if (delete240x220) {
                logger.info(`Checking ${originalCount} Firebase banners for 240x220 dimensions...`);
                
                for (const [bannerId, banner] of Object.entries(banners)) {
                    logger.debug(`Checking Firebase banner: ${bannerId}`);
                    
                    // Check if banner URL contains 240x220 dimensions (multiple patterns)
                    const has240x220 = banner.url && (
                        banner.url.includes('240x220') || 
                        banner.url.includes('220x240') || 
                        banner.url.includes('240x240') || 
                        banner.url.includes('220x220') ||
                        banner.url.includes('_SR240,220_') ||
                        banner.url.includes('_SR220,240_') ||
                        banner.url.includes('240,220') ||
                        banner.url.includes('220,240')
                    );
                    
                    if (has240x220) {
                        logger.warn(`Found 240x220 banner: ${bannerId}, URL: ${banner.url}`);
                        try {
                            // DELETE the banner completely
                            const deleteResult = await bannerDB.deleteBanner(bannerId);
                            if (deleteResult.status === 200) {
                                logger.info(`Successfully DELETED Firebase banner: ${bannerId}`);
                                deactivatedBanners.push({ 
                                    id: bannerId, 
                                    reason: 'Deleted banner with 240x220 dimensions', 
                                    banner,
                                    score: 0 
                                });
                                deactivatedCount++;
                            } else {
                                logger.error(`Error deleting Firebase banner ${bannerId}: ${deleteResult.status}`);
                            }
                        } catch (error) {
                            logger.error(`Error deleting Firebase banner ${bannerId}: ${error.message}`);
                        }
                    } else {
                        logger.debug(`Banner ${bannerId} does not have 240x220 dimensions`);
                        activeBanners.push({ 
                            id: bannerId, 
                            reason: 'No 240x220 dimensions found', 
                            banner,
                            score: 0 
                        });
                    }
                }
            } else if (activateAll) {
                logger.info(`Activating ALL ${originalCount} Firebase banners...`);
                
                for (const [bannerId, banner] of Object.entries(banners)) {
                    logger.debug(`Activating Firebase banner: ${bannerId}`);
                    
                    try {
                        // Activate ALL banners
                        const activateResult = await bannerDB.activateBanner(bannerId);
                        if (activateResult.status === 200) {
                            logger.info(`Successfully activated Firebase banner: ${bannerId}`);
                            activeBanners.push({ 
                                id: bannerId, 
                                reason: 'Activated all banners', 
                                banner,
                                score: 0 
                            });
                            deactivatedCount++;
                        } else {
                            logger.error(`Error activating Firebase banner ${bannerId}: ${activateResult.status}`);
                        }
                    } catch (error) {
                        logger.error(`Error activating Firebase banner ${bannerId}: ${error.message}`);
                    }
                }
            } else if (deactivateAll) {
                logger.info(`Deactivating ALL ${originalCount} Firebase banners...`);
                
                for (const [bannerId, banner] of Object.entries(banners)) {
                    logger.debug(`Deactivating Firebase banner: ${bannerId}`);
                    
                    try {
                        // Deactivate ALL banners
                        const deactivateResult = await bannerDB.deactivateBanner(bannerId);
                        if (deactivateResult.status === 200) {
                            logger.info(`Successfully deactivated Firebase banner: ${bannerId}`);
                            deactivatedBanners.push({ 
                                id: bannerId, 
                                reason: 'Deactivated all banners', 
                                banner,
                                score: 0 
                            });
                            deactivatedCount++;
                        } else {
                            logger.error(`Error deactivating Firebase banner ${bannerId}: ${deactivateResult.status}`);
                        }
                    } catch (error) {
                        logger.error(`Error deactivating Firebase banner ${bannerId}: ${error.message}`);
                    }
                }
            } else if (skipValidation) {
                logger.info(`Deactivating ALL ${originalCount} Firebase banners (no validation)...`);
                
                for (const [bannerId, banner] of Object.entries(banners)) {
                    logger.debug(`Deactivating Firebase banner: ${bannerId}`);
                    
                    try {
                        // Deactivate ALL banners
                        const deactivateResult = await bannerDB.deactivateBanner(bannerId);
                        if (deactivateResult.status === 200) {
                            logger.info(`Successfully deactivated Firebase banner: ${bannerId}`);
                            deactivatedBanners.push({ 
                                id: bannerId, 
                                reason: 'Deactivated all banners (skip validation)', 
                                banner,
                                score: 0 
                            });
                            deactivatedCount++;
                        } else {
                            logger.error(`Error deactivating Firebase banner ${bannerId}: ${deactivateResult.status}`);
                        }
                    } catch (error) {
                        logger.error(`Error deactivating Firebase banner ${bannerId}: ${error.message}`);
                    }
                }
            } else {
                logger.info(`Starting validation of ${originalCount} Firebase banners...`);
                
                for (const [bannerId, banner] of Object.entries(banners)) {
                    logger.debug(`Validating Firebase banner: ${bannerId}`);
                    logger.debug(`Firebase banner data: ${JSON.stringify(banner, null, 2)}`);
                    
                    const validationResult = this.validateBannerRecord(banner, bannerId);
                    
                    logger.info(`Firebase banner ${bannerId} validation result:`, {
                        shouldDeactivate: validationResult.shouldDelete,
                        score: validationResult.score,
                        reason: validationResult.reason,
                        details: validationResult.details
                    });
                    
                    if (validationResult.shouldDelete) {
                        logger.warn(`Marking Firebase banner ${bannerId} for deactivation (Score: ${validationResult.score})`);
                        try {
                            // Deactivate banner instead of deleting
                            const deactivateResult = await bannerDB.deactivateBanner(bannerId);
                            if (deactivateResult.status === 200) {
                                logger.info(`Successfully deactivated Firebase banner: ${bannerId}`);
                                deactivatedBanners.push({ 
                                    id: bannerId, 
                                    reason: validationResult.reason, 
                                    banner,
                                    score: validationResult.score 
                                });
                                deactivatedCount++;
                            } else {
                                logger.error(`Error deactivating Firebase banner ${bannerId}: ${deactivateResult.status}`);
                            }
                        } catch (error) {
                            logger.error(`Error deactivating Firebase banner ${bannerId}: ${error.message}`);
                        }
                    } else {
                        logger.info(`Keeping Firebase banner ${bannerId} active (Score: ${validationResult.score})`);
                        activeBanners.push({ 
                            id: bannerId, 
                            reason: validationResult.reason, 
                            banner,
                            score: validationResult.score 
                        });
                    }
                }
            }
            
            logger.info(`Firebase validation complete. Deactivated: ${deactivatedCount}, Active: ${activeBanners.length}`);
            
            console.log(`✅ Deactivated unwanted Firebase banners`);
            console.log(`   Original count: ${originalCount}`);
            console.log(`   Deactivated count: ${deactivatedCount}`);
            console.log(`   Active count: ${activeBanners.length}`);
            
            logger.info(`Firebase deactivation summary:`, {
                original: originalCount,
                deactivated: deactivatedCount,
                active: activeBanners.length
            });
            
            // Log deactivated banners
            if (deactivatedBanners.length > 0) {
                console.log('\n📋 Deactivated Firebase banners:');
                logger.warn(`Deactivated ${deactivatedBanners.length} Firebase banners:`, deactivatedBanners.map(b => ({ id: b.id, reason: b.reason, score: b.score })));
                deactivatedBanners.forEach(({ id, reason, banner, score }) => {
                    console.log(`   - ${id}: ${reason} (Score: ${score})`);
                    console.log(`     ${banner.title || 'No title'}`);
                });
            }
            
            // Log active banners
            if (activeBanners.length > 0) {
                console.log('\n✅ Active Firebase banners:');
                logger.info(`Active ${activeBanners.length} Firebase banners:`, activeBanners.map(b => ({ id: b.id, reason: b.reason, score: b.score })));
                activeBanners.forEach(({ id, reason, banner, score }) => {
                    console.log(`   - ${id}: ${reason} (Score: ${score})`);
                    console.log(`     ${banner.title || 'No title'}`);
                });
            }
            
            logger.info('Firebase banners deactivation process completed');
            
            return {
                success: true,
                deactivated: deactivatedCount,
                original: originalCount,
                active: activeBanners.length,
                deactivatedBanners,
                activeBanners
            };
            
        } catch (error) {
            logger.error(`Error deactivating Firebase banners: ${error.message}`, error);
            console.log(`❌ Error deactivating Firebase banners: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // Run full cleanup
    async runFullCleanup(options = {}) {
        console.log('🚀 Starting full cleanup process...\n');
        logger.info('Starting full cleanup process', options);
        
        const results = {};
        
        // Clean up deals.json
        if (options.cleanDeals !== false) {
            logger.info('Starting deals cleanup...');
            results.deals = await this.deleteProductsFromDeals(options.dealsCriteria);
            console.log('');
        } else {
            logger.info('Skipping deals cleanup');
        }
        
        // Clean up banner.json
        if (options.cleanBannerJson !== false) {
            logger.info('Starting banner.json cleanup...');
            results.bannerJson = await this.cleanupBannerJson();
            console.log('');
        } else {
            logger.info('Skipping banner.json cleanup');
        }
        
        // Clean up Firebase banners
        if (options.cleanFirebase !== false) {
            logger.info('Starting Firebase cleanup...');
            results.firebase = await this.cleanupFirebaseBanners();
            console.log('');
        } else {
            logger.info('Skipping Firebase cleanup');
        }
        
        logger.info('Full cleanup process completed', results);
        console.log('✅ Full cleanup completed!');
        
        return results;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    logger.info(`Starting deleteProduct tool with command: ${command}`);
    logger.info(`Arguments: ${JSON.stringify(args)}`);
    
    const deleter = new ProductDeleter();
    
    try {
        switch (command) {
            case 'deals':
                logger.info('Executing deals cleanup command');
                const dealsCriteria = {};
                if (args.includes('--platform')) {
                    const platformIndex = args.indexOf('--platform');
                    dealsCriteria.platform = args[platformIndex + 1];
                    logger.info(`Platform filter: ${dealsCriteria.platform}`);
                }
                if (args.includes('--min-discount')) {
                    const minIndex = args.indexOf('--min-discount');
                    dealsCriteria.minDiscount = parseInt(args[minIndex + 1]);
                    logger.info(`Min discount filter: ${dealsCriteria.minDiscount}`);
                }
                if (args.includes('--max-discount')) {
                    const maxIndex = args.indexOf('--max-discount');
                    dealsCriteria.maxDiscount = parseInt(args[maxIndex + 1]);
                    logger.info(`Max discount filter: ${dealsCriteria.maxDiscount}`);
                }
                if (args.includes('--older-than')) {
                    const olderIndex = args.indexOf('--older-than');
                    dealsCriteria.olderThan = parseInt(args[olderIndex + 1]);
                    logger.info(`Older than filter: ${dealsCriteria.olderThan} days`);
                }
                if (args.includes('--inactive')) {
                    dealsCriteria.inactive = true;
                    logger.info('Inactive filter enabled');
                }
                
                logger.info(`Deals criteria: ${JSON.stringify(dealsCriteria)}`);
                await deleter.deleteProductsFromDeals(dealsCriteria);
                break;
                
            case 'banner-json':
                logger.info('Executing banner-json deactivation command');
                const bannerJsonOptions = {
                    skipValidation: args.includes('--skip-validation')
                };
                logger.info(`Banner JSON options: ${JSON.stringify(bannerJsonOptions)}`);
                await deleter.cleanupBannerJson(bannerJsonOptions);
                break;
                
            case 'firebase':
                logger.info('Executing firebase deactivation command');
                const firebaseOptions = {
                    skipValidation: args.includes('--skip-validation'),
                    delete240x220: args.includes('--delete-240x220'),
                    activateAll: args.includes('--activate-all'),
                    deactivateAll: args.includes('--deactivate-all')
                };
                logger.info(`Firebase options: ${JSON.stringify(firebaseOptions)}`);
                await deleter.cleanupFirebaseBanners(firebaseOptions);
                break;
                
            case 'full':
                logger.info('Executing full cleanup command');
                const options = {
                    cleanDeals: !args.includes('--skip-deals'),
                    cleanBannerJson: !args.includes('--skip-banner-json'),
                    cleanFirebase: !args.includes('--skip-firebase'),
                    dealsCriteria: {}
                };
                
                logger.info(`Full cleanup options: ${JSON.stringify(options)}`);
                
                // Parse deals criteria
                if (args.includes('--platform')) {
                    const platformIndex = args.indexOf('--platform');
                    options.dealsCriteria.platform = args[platformIndex + 1];
                    logger.info(`Platform filter: ${options.dealsCriteria.platform}`);
                }
                if (args.includes('--min-discount')) {
                    const minIndex = args.indexOf('--min-discount');
                    options.dealsCriteria.minDiscount = parseInt(args[minIndex + 1]);
                    logger.info(`Min discount filter: ${options.dealsCriteria.minDiscount}`);
                }
                if (args.includes('--older-than')) {
                    const olderIndex = args.indexOf('--older-than');
                    options.dealsCriteria.olderThan = parseInt(args[olderIndex + 1]);
                    logger.info(`Older than filter: ${options.dealsCriteria.olderThan} days`);
                }
                
                await deleter.runFullCleanup(options);
                break;
                
            case 'help':
            default:
                logger.info('Showing help information');
                console.log(`
🗑️  Product Deletion Tool

USAGE: node tools/deleteProduct.js <command> [options]

COMMANDS:
  deals        Delete products from deals.json
  banner-json  Deactivate unwanted banners in banner.json
  firebase     Deactivate unwanted Firebase banners
  full         Run full cleanup (all operations)
  help         Show this help

 OPTIONS:
   --platform=<platform>     Filter by platform (amazon, flipkart, etc.)
   --min-discount=<number>   Minimum discount percentage
   --max-discount=<number>   Maximum discount percentage
   --older-than=<days>       Delete products older than X days
   --inactive                Delete inactive products only
   --skip-validation         Skip validation and deactivate ALL banners
   --delete-240x220         DELETE banners with 240x220 dimensions from Firebase
   --activate-all           ACTIVATE ALL Firebase banners
   --deactivate-all         DEACTIVATE ALL Firebase banners
   --skip-deals              Skip deals cleanup in full mode
   --skip-banner-json        Skip banner.json cleanup in full mode
   --skip-firebase           Skip Firebase cleanup in full mode

EXAMPLES:
  # Delete all Amazon products
  node tools/deleteProduct.js deals --platform=amazon

  # Delete products with less than 20% discount
  node tools/deleteProduct.js deals --min-discount=20

  # Delete products older than 30 days
  node tools/deleteProduct.js deals --older-than=30

  # Deactivate unwanted banners in banner.json only
  node tools/deleteProduct.js banner-json

     # Deactivate unwanted Firebase banners only
   node tools/deleteProduct.js firebase

   # Deactivate ALL Firebase banners (skip validation)
   node tools/deleteProduct.js firebase --skip-validation

   # Deactivate ALL banner.json banners (skip validation)
   node tools/deleteProduct.js banner-json --skip-validation

   # DELETE banners with 240x220 dimensions from Firebase
   node tools/deleteProduct.js firebase --delete-240x220

   # ACTIVATE ALL Firebase banners
   node tools/deleteProduct.js firebase --activate-all

   # DEACTIVATE ALL Firebase banners
   node tools/deleteProduct.js firebase --deactivate-all

   # Run full cleanup
   node tools/deleteProduct.js full

  # Run full cleanup but skip deals
  node tools/deleteProduct.js full --skip-deals

  # Run full cleanup with specific deals criteria
  node tools/deleteProduct.js full --platform=amazon --min-discount=20 --older-than=30
`);
                break;
        }
        
        logger.info(`Command '${command}' completed successfully`);
    } catch (error) {
        logger.error(`Error executing command '${command}': ${error.message}`, error);
        console.log(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal Error:', error.message);
        process.exit(1);
    });
}

module.exports = { ProductDeleter }; 