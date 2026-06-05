const { getModuleLogger } = require('../logger/logger');
const { getAllProductDeals, updateProductDeal, productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { initializeDriver, closeDriver } = require('./batchProductExtractor');
const { scrapeProduct } = require('../scrappers/amazon');
const { postProcessProductData } = require('../pageScheduler');

const logger = getModuleLogger('idleEnrichmentProcessor');

class IdleEnrichmentProcessor {
    constructor() {
        this.isProcessing = false;
        this.driver = null;
        this.processedCount = 0;
        this.updatedCount = 0;
        this.errorCount = 0;
    }

    /**
     * Start idle-time enrichment processing
     */
    async startProcessing(options = {}) {
        if (this.isProcessing) {
            logger.warn('Idle enrichment is already running');
            return;
        }

        const {
            batchSize = 10,
            delayBetweenProducts = 2000,
            maxProducts = 100,
            onlyMissingFields = true,
            targetDb = 'productdeals'
        } = options;

        logger.info('Starting idle-time enrichment processing', { batchSize, delayBetweenProducts, maxProducts, onlyMissingFields, targetDb });

        try {
            this.isProcessing = true;
            this.driver = await initializeDriver();

            // Get products that need enrichment
            const productsToEnrich = await this.getProductsForEnrichment(onlyMissingFields, maxProducts, targetDb);
            logger.info(`Found ${productsToEnrich.length} products for enrichment`);

            if (productsToEnrich.length === 0) {
                logger.info('No products need enrichment');
                return { processed: 0, updated: 0, errors: 0 };
            }

            // Process in batches
            for (let i = 0; i < productsToEnrich.length; i += batchSize) {
                const batch = productsToEnrich.slice(i, i + batchSize);
                logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToEnrich.length / batchSize)}`);

                for (const product of batch) {
                    if (!this.isProcessing) {
                        logger.info('Enrichment processing stopped');
                        break;
                    }

                    try {
                        await this.enrichProduct(product, targetDb);
                        this.processedCount++;
                        
                        // Add delay between products to avoid overwhelming the server
                        if (delayBetweenProducts > 0) {
                            await this.sleep(delayBetweenProducts);
                        }

                    } catch (error) {
                        logger.error(`Failed to enrich product ${product.id}:`, error);
                        this.errorCount++;
                    }
                }

                // Small delay between batches
                if (i + batchSize < productsToEnrich.length) {
                    await this.sleep(5000);
                }
            }

            logger.info('Idle enrichment processing completed', {
                processed: this.processedCount,
                updated: this.updatedCount,
                errors: this.errorCount
            });

            return {
                processed: this.processedCount,
                updated: this.updatedCount,
                errors: this.errorCount
            };

        } catch (error) {
            logger.error('Idle enrichment processing failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Stop idle-time enrichment processing
     */
    stopProcessing() {
        logger.info('Stopping idle enrichment processing');
        this.isProcessing = false;
    }

    /**
     * Get products that need enrichment
     */
    async getProductsForEnrichment(onlyMissingFields = true, maxProducts = 100, targetDb = 'productdeals') {
        try {
            const allProducts = await getAllProductDeals(targetDb);
            const productsArray = Object.entries(allProducts).map(([id, product]) => ({
                id,
                ...product
            }));

            if (onlyMissingFields) {
                // Filter products with missing or invalid fields
                return productsArray
                    .filter(product => this.hasMissingFields(product))
                    .slice(0, maxProducts);
            } else {
                // Return all products up to max
                return productsArray.slice(0, maxProducts);
            }

        } catch (error) {
            logger.error('Failed to get products for enrichment:', error);
            throw error;
        }
    }

    /**
     * Check if product has missing fields
     */
    hasMissingFields(product) {
        const criticalFields = ['title', 'brand'];
        
        const isMissingCritical = criticalFields.some(field => {
            const value = product[field];
            return !value || value === '' || value === 'undefined' || value === 'NA';
        });
        
        if (isMissingCritical) return true;
        
        // Check price
        const price = product.price;
        if (!price || price === '' || price === 'undefined' || price === 'NA') return true;
        
        // Check originalPrice / mrp
        const mrp = product.originalPrice || product.mrp;
        if (!mrp || mrp === '' || mrp === 'undefined' || mrp === 'NA') return true;
        
        // Check discount / discountPercentage
        const discount = product.discountPercentage || product.discount;
        if (!discount || discount === '' || discount === 'undefined' || discount === 'NA') return true;
        
        // Check rating
        const rating = product.rating;
        if (!rating || rating === '' || rating === 'undefined' || rating === 'NA') return true;
        
        // Check ratingsCount / reviewsCount
        const ratingsCount = product.ratingsCount || product.reviewsCount;
        if (!ratingsCount || ratingsCount === '' || ratingsCount === 'undefined' || ratingsCount === 'NA') return true;
        
        // Check categoryGroup
        if (!product.categoryGroup) return true;
        
        return false;
    }

    /**
     * Enrich a single product with detailed information
     */
    async enrichProduct(product, targetDb = 'productdeals') {
        if (!product.productUrl) {
            logger.warn(`Product ${product.id} has no product URL, skipping`);
            return;
        }

        const platform = product.storeType ? product.storeType.toLowerCase() : 'amazon';
        logger.info(`Enriching product: ${product.id}`, { url: product.productUrl, platform });

        try {
            // Navigate to product page
            await this.driver.get(product.productUrl);
            await this.sleep(2000); // Wait for page to load

            // Scrape detailed product information
            const enrichedData = await scrapeProduct(product.productUrl, platform, this.driver);
            
            if (enrichedData && Object.keys(enrichedData).length > 0) {
                // Update product with enriched data
                await this.updateProductWithEnrichedData(product.id, enrichedData, targetDb);
                this.updatedCount++;
                logger.info(`Successfully enriched product: ${product.id}`);
            } else {
                logger.warn(`Scraped data is empty for product: ${product.id}`);
                this.errorCount++;
            }

        } catch (error) {
            logger.error(`Failed to enrich product ${product.id}:`, error);
            this.errorCount++;
        }
    }

    /**
     * Extract detailed product information from product page
     */
    async extractProductDetails() {
        try {
            const enrichedData = {};

            // Extract title
            try {
                const titleElement = await this.driver.findElement(amazonPageConfig.productPage.title);
                enrichedData.title = await titleElement.getText();
            } catch (error) {
                logger.debug('Could not extract title');
            }

            // Extract brand
            try {
                const brandElement = await this.driver.findElement(amazonPageConfig.productPage.brand);
                enrichedData.brand = await brandElement.getText();
            } catch (error) {
                logger.debug('Could not extract brand');
            }

            // Extract current price
            try {
                const priceElement = await this.driver.findElement(amazonPageConfig.productPage.currentPrice);
                enrichedData.price = await priceElement.getText();
            } catch (error) {
                logger.debug('Could not extract current price');
            }

            // Extract original price
            try {
                const originalPriceElement = await this.driver.findElement(amazonPageConfig.productPage.originalPrice);
                enrichedData.originalPrice = await originalPriceElement.getText();
            } catch (error) {
                logger.debug('Could not extract original price');
            }

            // Extract discount percentage
            try {
                const discountElement = await this.driver.findElement(amazonPageConfig.productPage.discountPercentage);
                enrichedData.discountPercentage = await discountElement.getText();
            } catch (error) {
                logger.debug('Could not extract discount percentage');
            }

            // Extract rating
            try {
                const ratingElement = await this.driver.findElement(amazonPageConfig.productPage.rating);
                enrichedData.rating = await ratingElement.getText();
            } catch (error) {
                logger.debug('Could not extract rating');
            }

            // Extract ratings count
            try {
                const ratingsCountElement = await this.driver.findElement(amazonPageConfig.productPage.ratingsCount);
                enrichedData.ratingsCount = await ratingsCountElement.getText();
            } catch (error) {
                logger.debug('Could not extract ratings count');
            }

            // Extract category information
            try {
                const categoryElements = await this.driver.findElements(amazonPageConfig.productPage.categoryPath);
                if (categoryElements.length > 0) {
                    const categoryTexts = await Promise.all(
                        categoryElements.map(el => el.getText())
                    );
                    enrichedData.categoryPath = categoryTexts.join(' > ');
                    
                    // Extract category key from path
                    if (categoryTexts.length > 0) {
                        enrichedData.categoryKey = this.extractCategoryKey(categoryTexts[categoryTexts.length - 1]);
                    }
                }
            } catch (error) {
                logger.debug('Could not extract category information');
            }

            // Extract additional details
            try {
                const descriptionElement = await this.driver.findElement(amazonPageConfig.productPage.description);
                enrichedData.description = await descriptionElement.getText();
            } catch (error) {
                logger.debug('Could not extract description');
            }

            // Extract availability
            try {
                const availabilityElement = await this.driver.findElement(amazonPageConfig.productPage.availability);
                enrichedData.availability = await availabilityElement.getText();
            } catch (error) {
                logger.debug('Could not extract availability');
            }

            // Add enrichment timestamp
            enrichedData.lastEnriched = new Date().toISOString();
            enrichedData.enrichmentSource = 'idle-processor';

            return enrichedData;

        } catch (error) {
            logger.error('Failed to extract product details:', error);
            throw error;
        }
    }

    /**
     * Extract category key from category text
     */
    extractCategoryKey(categoryText) {
        if (!categoryText) return '';
        
        // Convert to lowercase and remove special characters
        const cleanText = categoryText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        
        // Map common category patterns
        const categoryMap = {
            'mobile phones': 'mobiles',
            'smartphones': 'mobiles',
            'laptops': 'laptops',
            'computers': 'computers',
            'electronics': 'electronics',
            'home kitchen': 'home-kitchen',
            'fashion': 'fashion',
            'clothing': 'fashion',
            'beauty': 'beauty',
            'personal care': 'beauty',
            'books': 'books',
            'toys games': 'toys-games',
            'sports outdoors': 'sports',
            'grocery': 'grocery',
            'automotive': 'automotive',
            'health': 'health',
            'baby': 'baby',
            'pet supplies': 'pet-supplies'
        };

        for (const [pattern, key] of Object.entries(categoryMap)) {
            if (cleanText.includes(pattern)) {
                return key;
            }
        }

        // Return slugified version if no pattern matches
        return cleanText.replace(/\s+/g, '-');
    }

    /**
     * Update product with enriched data
     */
    async updateProductWithEnrichedData(productId, enrichedData, targetDb = 'productdeals') {
        try {
            // Get existing product data
            const product = await productDealsDB.getProduct(productId, targetDb);
            
            if (!product) {
                logger.warn(`Product ${productId} not found in database`);
                return;
            }

            // Merge enriched data with existing data
            let updatedProduct = {
                ...product,
                ...enrichedData,
                updateTimestamp: new Date().toISOString()
            };

            // Calculate missing pricing fields
            try {
                updatedProduct = postProcessProductData(updatedProduct, product.storeType || 'Amazon');
            } catch (postError) {
                logger.warn('Error running postProcessProductData in updateProductWithEnrichedData', { 
                    productId, 
                    error: postError.message 
                });
            }

            // Update the product
            await updateProductDeal(productId, updatedProduct, targetDb);
            logger.info(`Updated product ${productId} with enriched data`);

        } catch (error) {
            logger.error(`Failed to update product ${productId} with enriched data:`, error);
            throw error;
        }
    }

    /**
     * Get processing status
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            processedCount: this.processedCount,
            updatedCount: this.updatedCount,
            errorCount: this.errorCount
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.isProcessing = false;
        
        if (this.driver) {
            try {
                await closeDriver(this.driver);
                this.driver = null;
                logger.info('Driver closed successfully');
            } catch (error) {
                logger.error('Failed to close driver:', error);
            }
        }
    }

    /**
     * Utility function to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create singleton instance
const idleEnrichmentProcessor = new IdleEnrichmentProcessor();

module.exports = { IdleEnrichmentProcessor, idleEnrichmentProcessor };
