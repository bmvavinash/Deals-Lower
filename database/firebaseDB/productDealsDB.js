const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('productDealsDB');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		// databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
		databaseURL: `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
	});
}

const db = admin.database();

function generateAmazonAffiliateUrl(url) {
    try {
        if (!url || typeof url !== 'string') return "";
        const hasQuery = url.includes('?');
        const hasTag = /[?&]tag=/.test(url);
        if (hasTag) {
            // Replace existing tag with desired one
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
			const now = new Date().toISOString();
			
			// Get existing records to determine created vs updated
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : this.dealsRef;
			const existingSnapshot = await targetRef.once('value');
			const existingRecords = existingSnapshot.val() || {};

			for (const product of products) {
				const key = product.productCode || product.id || product.asin || product.title || Math.random().toString(36).slice(2);
				const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
				
				// Check if this is a new record or update
				const isNewRecord = !existingRecords[safeKey];
				if (isNewRecord) {
					createdCount++;
				} else {
					updatedCount++;
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
					// Prefer new hierarchical fields to derive grouping to avoid misclassification
					categoryGroup: (product.categoryGroup
						|| product.productCategory
						|| product.categoryLevel1
						|| product.hierarchicalCategory?.mainCategory
						|| ((product.categoryKey && String(product.categoryKey).includes("_")) ? String(product.categoryKey).split("_")[1] : (product.category?.mainCategory || ""))),
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
						const derivedInr = isAmazon ? generateAmazonAffiliateUrl(product.productUrl || existing.avinashbmvINR || '') : (existing.avinashbmvINR || "");
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
					updatedatetime: new Date().getTime()
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
			const now = new Date().toISOString();
			
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
					updatedatetime: new Date().getTime()
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

	// Method for individual product updates during idle time
	async updateIndividualProduct(productCode, updates, targetDb = 'deals') {
		try {
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : this.dealsRef;
			const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
			
			const updateData = {
				...updates,
				updateTimestamp: new Date().toISOString(),
				updatedatetime: new Date().getTime()
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
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : this.dealsRef;
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
			const targetRef = targetDb === 'productdeals' ? this.productdealsRef : this.dealsRef;
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
}

const productDealsDB = new ProductDealsDB();
module.exports = { productDealsDB };
