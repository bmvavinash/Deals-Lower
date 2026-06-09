const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require('../../logger/logger');
const { getISTTimestamp } = require('../../utils/commonUtils');

const logger = getModuleLogger('productDealsDB');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

console.log(`Initializing Firebase with DB: ${DB_Name}, Token File: ${filePath}`);

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
	const dbUrl = DB_Name === 'lowerdealhub' 
		? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
		: `https://${DB_Name}-default-rtdb.firebaseio.com`;
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: dbUrl
	});
	console.log(`Firebase initialized successfully for ${DB_Name}`);
} else {
	console.log(`Firebase already initialized for ${DB_Name}`);
}

const db = admin.database();

function generateAmazonAffiliateUrl(url, productCode = null) {
    try {
        if (!url || typeof url !== 'string') return "";
        
        // Extract ASIN from URL if productCode not provided
        if (!productCode) {
            const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
            productCode = asinMatch ? asinMatch[1] : null;
        }
        
        // If we have an ASIN, use the clean format
        if (productCode && /^[A-Z0-9]{10}$/i.test(productCode)) {
            return `https://www.amazon.in/dp/${productCode}?tag=dealshubglo0c-21`;
        }
        
        // Fallback: append tag to existing URL (for non-standard URLs)
        const hasQuery = url.includes('?');
        const hasTag = /[?&]tag=/.test(url);
        if (hasTag) {
            return url.replace(/([?&]tag=)[^&]*/i, '$1dealshubglo0c-21');
        }
        return url + (hasQuery ? '&' : '?') + 'tag=dealshubglo0c-21';
    } catch (_) {
        return url || "";
    }
}

function deriveStoreTypeFromUrl(url) {
    try {
        if (!url || typeof url !== 'string') return "";
        const host = new URL(url).hostname;
        if (/amazon\./i.test(host)) return 'Amazon';
        if (/flipkart\./i.test(host)) return 'Flipkart';
        if (/myntra\./i.test(host)) return 'Myntra';
        if (/ajio\./i.test(host)) return 'Ajio';
        return '';
    } catch (_) {
        return '';
    }
}

class ProductDealsDB {
	constructor() {
		this.productdealsRef = db.ref('productdeals'); // For bulk website updates
		this.dealsRef = db.ref('deals'); // For Telegram processing
		this.staticRef = db.ref('productdeals_static'); // For static categorization
		this.ref = this.dealsRef; // Default to deals for backward compatibility
	}

	async bulkUpsertProducts(products, targetDb = 'deals') {
		try {
			if (!Array.isArray(products) || products.length === 0) {
				logger.warn('bulkUpsertProducts called with empty products array');
				return { status: 400, message: 'No products to upsert', count: 0, created: 0, updated: 0, failed: 0 };
			}

			const updates = {};
			let createdCount = 0;
			let updatedCount = 0;
			const now = getISTTimestamp();
			
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			// Only fetch the existing records for the products we are updating to avoid downloading the entire node
			const existingRecords = {};
			const fetchPromises = products.map(async (product) => {
				const key = product.productCode || product.id || product.asin || product.title || '';
				const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
				if (safeKey) {
					try {
						// Implement a 3-second timeout per read to avoid hanging on network lag
						let timeoutId;
						const readPromise = targetRef.child(safeKey).once('value');
						const timeoutPromise = new Promise((_, reject) => {
							timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 3000);
						});
						const snapshot = await Promise.race([readPromise, timeoutPromise]);
						clearTimeout(timeoutId);
						
						const val = snapshot.val();
						if (val) {
							existingRecords[safeKey] = val;
						}
					} catch (e) {
						logger.warn('Failed to fetch existing record for key (timed out or connection error)', { safeKey, error: e.message });
					}
				}
			});
			await Promise.all(fetchPromises);
			
			// Load favorites notification service (lazy load to avoid circular deps)
			let favoritesNotificationService = null;
			if (constants.notifications?.enableFavoritesService) {
				try {
					favoritesNotificationService = require('../../services/favoritesBasedNotificationService').favoritesNotificationService;
				} catch (e) {
					logger.debug('Favorites notification service not available', { error: e.message });
				}
			}

			for (const product of products) {
				const key = product.productCode || product.id || product.asin || product.title || Math.random().toString(36).slice(2);
				const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
				
				// Check if this is a new record or update
				const isNewRecord = !existingRecords[safeKey];
				const existingProduct = existingRecords[safeKey];
				
				if (isNewRecord) {
					createdCount++;
				} else {
					updatedCount++;
					
					// Check for price drops and notify favorited users (async, non-blocking)
					if (favoritesNotificationService && product.productCode && product.price && existingProduct?.price) {
						favoritesNotificationService.checkPriceDrops(
							product.productCode,
							product.price,
							existingProduct.price
						).catch(err => {
							logger.debug('Price drop check failed (non-fatal)', { productCode: product.productCode, error: err.message });
						});
					}
				}
				
				// Check for new deals on favorited products (async, non-blocking)
				if (favoritesNotificationService && product.productCode && (product.discount || product.isHotDeal)) {
					favoritesNotificationService.checkNewDeals(product.productCode, product).catch(err => {
						logger.debug('New deal check failed (non-fatal)', { productCode: product.productCode, error: err.message });
					});
				}
				
				// Ensure all required attributes are present with defaults
				const normalized = {
					// Basic product info
					brand: product.brand || "",
					title: product.title || "",
					shortText: product.shortText || product.title || "",
					urltext: product.urltext || product.title || "",
					productText: product.productText || product.title || "",
					
					// Pricing
					price: product.price || product.discountedPrice || "",
					mrp: product.mrp || product.originalPrice || "",
					discount: product.discount || product.discountPercentage || "",
					offerPrice: product.offerPrice || product.price || product.discountedPrice || "",
					
					// Ratings
					rating: product.rating || "",
					ratingsCount: product.ratingsCount || "",
					reviewsCount: product.reviewsCount || "",
					
					// URLs and images
					productUrl: product.productUrl || "",
					photo: product.photo || product.productImage || "",
					images: product.images || [product.photo || product.productImage || ""].filter(Boolean),
					
					// Product identification
					productCode: product.productCode || product.id || product.asin || "",
					asin: product.asin || "",
					id: product.id || product.productCode || product.asin || "",
					idlen: product.idlen || product.id || product.productCode || product.asin || "",
					idlength: product.idlength || product.id || product.productCode || product.asin || "",
					
					// Category and classification
					category: product.category || {
						c1: "",
						c2: "",
						c3: "",
						c4: "",
						c5: "",
						mainCategory: ""
					},
					// Hierarchical category fields
					hierarchicalCategory: product.hierarchicalCategory || {
						mainCategory: "",
						subcategory: "",
						style: "",
						hierarchicalKey: ""
					},
					// Separate category attributes for API queries
					categoryLevel1: product.categoryLevel1 || "",
					categoryLevel2: product.categoryLevel2 || "",
					categoryLevel3: product.categoryLevel3 || "",
					subcategory1: product.subcategory1 || "",
					subcategory2: product.subcategory2 || "",
					productCategory: product.productCategory || "",
					productSubcategory: product.productSubcategory || "",
					productStyle: product.productStyle || "",
					categoryPath: product.categoryPath || [],
					categoryDepth: product.categoryDepth || 0,
					// Bulk-category keys
					categoryKey: product.categoryKey || "",
					// categoryGroup: Primary attribute for database queries (REQUIRED)
					// Must match exact values: electronics, fashion, home-kitchen, sports-fitness, etc.
					// Format: lowercase, hyphenated (e.g., "home-kitchen", "beauty-personal-care")
					categoryGroup: (() => {
						// Helper function to normalize category names to categoryGroup format
						const normalizeCategoryGroup = (catName) => {
							if (!catName || typeof catName !== 'string') return '';
							return catName.toLowerCase()
								.replace(/\s+/g, '-')           // Replace spaces with hyphens
								.replace(/&/g, '')              // Remove ampersands
								.replace(/[^a-z0-9-]/g, '')     // Remove special chars except hyphens
								.replace(/-+/g, '-')            // Replace multiple hyphens with single
								.replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
						};
						
						// Helper function to map display names to standard categoryGroup values
						const mapToStandardCategoryGroup = (catName) => {
							if (!catName) return '';
							const normalized = normalizeCategoryGroup(catName);
							
							// Map common variations to standard categoryGroup values
							const categoryMappings = {
								// Home & Kitchen variations
								'home-garden': 'home-kitchen',
								'home-kitchen': 'home-kitchen',
								'homeandgarden': 'home-kitchen',
								'homeandkitchen': 'home-kitchen',
								// Beauty & Personal Care variations
								'beauty-personal-care': 'beauty-personal-care',
								'beautypersonalcare': 'beauty-personal-care',
								'beauty': 'beauty-personal-care',
								'personal-care': 'beauty-personal-care',
								// Sports & Fitness variations
								'sports-fitness': 'sports-fitness',
								'sportsfitness': 'sports-fitness',
								'sports': 'sports-fitness',
								'fitness': 'sports-fitness',
								// Books & Stationery variations
								'books-stationery': 'books-stationery',
								'booksstationery': 'books-stationery',
								'books': 'books-stationery',
								'stationery': 'books-stationery',
								// Baby & Kids variations
								'baby-kids': 'baby-kids',
								'bab kids': 'baby-kids',
								'baby': 'baby-kids',
								'kids': 'baby-kids',
								// Tools & Hardware variations
								'tools-hardware': 'tools-hardware',
								'toolshardware': 'tools-hardware',
								'tools': 'tools-hardware',
								'hardware': 'tools-hardware',
								// Music & Entertainment variations
								'music-entertainment': 'music-entertainment',
								'musicentertainment': 'music-entertainment',
								'music': 'music-entertainment',
								'entertainment': 'music-entertainment',
								// Pet Supplies variations
								'pet-supplies': 'pet-supplies',
								'petsupplies': 'pet-supplies',
								'pet': 'pet-supplies',
								// Standard categories
								'electronics': 'electronics',
								'fashion': 'fashion',
								'automotive': 'automotive',
								'grocery': 'grocery'
							};
							
							return categoryMappings[normalized] || normalized;
						};
						
						// 1. If categoryGroup is already set, check if it needs normalization
						if (product.categoryGroup && typeof product.categoryGroup === 'string') {
							const current = product.categoryGroup.toLowerCase().trim();
							// Check if it's already in correct format (contains hyphen or is a standard value)
							if (current && (current.includes('-') || ['electronics', 'fashion', 'grocery', 'automotive', 'home-kitchen', 'beauty-personal-care', 'sports-fitness', 'books-stationery', 'baby-kids', 'tools-hardware', 'music-entertainment', 'pet-supplies'].includes(current))) {
								return current;
							}
							// If not in correct format, try to map it
							return mapToStandardCategoryGroup(current);
						}
						
						// 2. Extract from categoryKey (format: platform_category) - This is the most reliable source
						if (product.categoryKey && typeof product.categoryKey === 'string' && product.categoryKey.includes('_')) {
							const categoryFromKey = product.categoryKey.split('_').pop() || '';
							if (categoryFromKey) {
								const normalized = categoryFromKey.toLowerCase().trim();
								// categoryKey should already be in correct format (e.g., "home-kitchen")
								if (normalized && (normalized.includes('-') || ['electronics', 'fashion', 'grocery', 'automotive'].includes(normalized))) {
									return normalized;
								}
								// If not, try to map it
								return mapToStandardCategoryGroup(normalized);
							}
						}
						
						// 3. Fallback: normalize from mainCategory/hierarchicalCategory
						const mainCategory = product.productCategory || product.categoryLevel1 || product.hierarchicalCategory?.mainCategory || product.category?.mainCategory || '';
						if (mainCategory) {
							return mapToStandardCategoryGroup(mainCategory);
						}
						
						return '';
					})(),
					productType: product.productType || "Website",
					
					// Product details
					color: product.color || "",
					materialCare: product.materialCare || "",
					seller: product.seller || "",
					sizeFit: product.sizeFit || "",
					sizes: product.sizes || product.availableSizes || [],
					
					// Deal and offer status
					isDeal: product.isDeal || false,
					isOffer: product.isOffer || false,
					isOutOfStock: product.isOutOfStock || false,
					isDisplay: true, // Always true for all records
					
					// Deal information
					deal: product.deal || "",
					limitedTimeDeal: product.limitedTimeDeal || "",
					dealProgress: product.dealProgress || "",
					timer: product.timer || "",
					
					// Coupon and offers
					coupon: product.coupon || product.couponAmount || "",
					couponAmount: product.couponAmount || "",
					extraOffers: product.extraOffers || "",
					promoInfo: product.promoInfo || [""],
					offers: product.offers || [{
						content: "Price",
						emi: "non-emi",
						type: ""
					}],
					
					// Links
					links: (() => {
						const existing = product.links || {};
						const isAmazon = (product.storeType || '').toLowerCase() === 'amazon' || /amazon\./i.test(product.productUrl || '');
						
						let derivedInr = existing.avinashbmvINR || "";
						
						// Fix avinashbmvINR based on platform
						if (isAmazon) {
							// For Amazon: use clean affiliate URL with productCode
							if (product.productCode) {
								derivedInr = `https://www.amazon.in/dp/${product.productCode}?tag=dealshubglo0c-21`;
							} else if (product.productUrl) {
								// Extract ASIN from URL if productCode not available
								const asinMatch = product.productUrl.match(/\/dp\/([A-Z0-9]{10})/i) || product.productUrl.match(/\/gp\/product\/([A-Z0-9]{10})/i);
								if (asinMatch && asinMatch[1]) {
									derivedInr = `https://www.amazon.in/dp/${asinMatch[1]}?tag=dealshubglo0c-21`;
								} else {
									// Fallback to generateAmazonAffiliateUrl
									derivedInr = generateAmazonAffiliateUrl(product.productUrl);
								}
							}
						} else {
							// For non-Amazon: use inrdeals.com URL
							if (product.productUrl && !derivedInr.includes('inrdeals.com')) {
								derivedInr = `https://inrdeals.com/avi646476329/${product.productUrl}`;
							} else if (!derivedInr) {
								// If no URL available, keep empty
								derivedInr = "";
							}
						}
						
						return {
							avinashbmv: existing.avinashbmv || "",
							avinashbmvINR: derivedInr
						};
					})(),
					
					// Store information
					storeType: product.storeType || deriveStoreTypeFromUrl(product.productUrl),
					
					// Timestamps
					creationTimestamp: isNewRecord ? now : (existingRecords[safeKey]?.creationTimestamp || now),
					updateTimestamp: now,
					date: product.date || now.slice(0, 10),
					datetime: product.datetime || new Date().getTime(),
					updatedatetime: new Date().getTime(),
					updatedAt: now,
					
					// Extracted attributes
					attributes: product.attributes || null
				};
				
				updates[safeKey] = normalized;
			}

			await targetRef.update(updates);
			const totalCount = Object.keys(updates).length;
			const failedCount = products.length - totalCount;
			
			logger.info(`Bulk upsert completed to ${targetDb}: ${totalCount} products (${createdCount} created, ${updatedCount} updated, ${failedCount} failed)`);
			return { 
				status: 200, 
				message: `Bulk upsert successful to ${targetDb}`, 
				count: totalCount,
				created: createdCount,
				updated: updatedCount,
				failed: failedCount
			};
		} catch (error) {
			logger.error('bulkUpsertProducts error', { error: error.message, stack: error.stack });
			return { 
				status: 500, 
				message: error.message,
				count: 0,
				created: 0,
				updated: 0,
				failed: products.length
			};
		}
	}

	// Method to update existing records with new attributes
	async updateExistingRecordsWithNewAttributes() {
		try {
			logger.info('Starting to update existing records with new attributes...');
			
			// Get all existing records
			const snapshot = await this.ref.once('value');
			const existingRecords = snapshot.val();
			
			if (!existingRecords) {
				logger.info('No existing records found to update');
				return { status: 200, message: 'No existing records to update', count: 0 };
			}

			const updates = {};
			const now = getISTTimestamp();
			
			Object.entries(existingRecords).forEach(([key, record]) => {
				// Add missing attributes with defaults
				const updatedRecord = {
					...record,
					// Ensure isDisplay is always true
					isDisplay: true,
					
					// Add missing attributes if they don't exist
					shortText: record.shortText || record.title || "",
					urltext: record.urltext || record.title || "",
					productText: record.productText || record.title || "",
					offerPrice: record.offerPrice || record.price || "",
					
					// Ensure category structure exists
					category: record.category || {
						c1: "",
						c2: "",
						c3: "",
						c4: "",
						c5: "",
						mainCategory: ""
					},
					
					// Ensure offers structure exists
					offers: record.offers || [{
						content: "Price",
						emi: "non-emi",
						type: ""
					}],
					
					// Ensure links structure exists and fix Amazon INR link
					links: (() => {
						const existing = record.links || {};
						const isAmazon = (record.storeType || '').toLowerCase() === 'amazon' || /amazon\./i.test(record.productUrl || '');
						const derivedInr = isAmazon ? generateAmazonAffiliateUrl(record.productUrl || existing.avinashbmvINR || '') : (existing.avinashbmvINR || "");
						return {
							avinashbmv: existing.avinashbmv || "",
							avinashbmvINR: derivedInr
						};
					})(),
					
					// Update timestamp
					updateTimestamp: now,
					updatedatetime: new Date().getTime(),
					updatedAt: now
				};
				
				updates[key] = updatedRecord;
			});

			await this.ref.update(updates);
			logger.info(`Updated ${Object.keys(updates).length} existing records with new attributes`);
			return { status: 200, message: 'Existing records updated successfully', count: Object.keys(updates).length };
		} catch (error) {
			logger.error('updateExistingRecordsWithNewAttributes error', { error: error.message, stack: error.stack });
			return { status: 500, message: error.message };
		}
	}

	async getProduct(productCode, targetDb = 'deals') {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
			const snapshot = await targetRef.child(safeKey).once('value');
			
			if (snapshot.exists()) {
				return snapshot.val();
			}
			
			// Fallback: search by productCode if key doesn't match
			const querySnapshot = await targetRef.orderByChild('productCode').equalTo(productCode).once('value');
			if (querySnapshot.exists()) {
				const products = querySnapshot.val();
				const keys = Object.keys(products);
				return products[keys[0]];
			}
			
			return null;
		} catch (error) {
			logger.error('getProduct error', { error: error.message });
			return null;
		}
	}

	// Method for individual product updates during idle time
	async updateIndividualProduct(productCode, updates, targetDb = 'deals') {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
			
			const updateData = {
				...updates,
				updateTimestamp: getISTTimestamp(),
				updatedatetime: new Date().getTime(),
				updatedAt: getISTTimestamp()
			};
			
			await targetRef.child(safeKey).update(updateData);
			logger.info(`Individual product updated in ${targetDb}`, { productCode: safeKey });
			return { status: 200, message: 'Product updated successfully' };
		} catch (error) {
			logger.error('updateIndividualProduct error', { productCode, error: error.message });
			return { status: 500, message: error.message };
		}
	}

	// Method to get products for idle processing
	async getProductsForIdleProcessing(targetDb = 'deals', limit = 10) {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			const snapshot = await targetRef.orderByChild('updateTimestamp').limitToFirst(limit).once('value');
			const products = snapshot.val() || {};
			
			// Filter products that need enrichment (missing critical fields)
			const productsNeedingUpdate = Object.entries(products).filter(([key, product]) => {
				return !product.brand || !product.title || !product.description || !product.offers;
			});
			
			logger.info(`Found ${productsNeedingUpdate.length} products needing update in ${targetDb}`);
			return productsNeedingUpdate;
		} catch (error) {
			logger.error('getProductsForIdleProcessing error', { error: error.message });
			return [];
		}
	}

	// Method to get products with deal timers for expiry tracking
	async getProductsWithTimers(targetDb = 'deals') {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			const snapshot = await targetRef.orderByChild('timer').startAt('').endAt('\uf8ff').once('value');
			const products = snapshot.val() || {};
			
			const productsWithTimers = Object.entries(products).filter(([key, product]) => {
				return product.timer && product.timer.trim() !== '';
			});
			
			logger.info(`Found ${productsWithTimers.length} products with timers in ${targetDb}`);
			return productsWithTimers;
		} catch (error) {
			logger.error('getProductsWithTimers error', { error: error.message });
			return [];
		}
	}

	async getAllProductDeals(targetDb = 'deals') {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : (targetDb === 'productdeals_static' ? this.staticRef : this.dealsRef);
			const snapshot = await targetRef.once('value');
			return snapshot.val() || {};
		} catch (error) {
			logger.error('getAllProductDeals error', { error: error.message });
			return {};
		}
	}

	async updateProductDeal(productCode, updates, targetDb = 'deals') {
		return this.updateIndividualProduct(productCode, updates, targetDb);
	}
}

const productDealsDB = new ProductDealsDB();
module.exports = {
	productDealsDB,
	getAllProductDeals: productDealsDB.getAllProductDeals.bind(productDealsDB),
	updateProductDeal: productDealsDB.updateProductDeal.bind(productDealsDB)
};
