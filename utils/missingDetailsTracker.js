const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('missingDetailsTracker');

class MissingDetailsTracker {
    constructor() {
        this.missingDetailsFile = path.join(__dirname, '../logs/missingDetails.json');
        this.ensureLogDirectory();
        this.missingDetails = this.loadMissingDetails();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.missingDetailsFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    loadMissingDetails() {
        try {
            if (fs.existsSync(this.missingDetailsFile)) {
                const data = fs.readFileSync(this.missingDetailsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.error('Error loading missing details file:', error);
        }
        return {
            products: {},
            summary: {
                totalProducts: 0,
                productsWithMissingDetails: 0,
                missingFields: {},
                lastUpdated: null
            }
        };
    }

    saveMissingDetails() {
        try {
            this.missingDetails.summary.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.missingDetailsFile, JSON.stringify(this.missingDetails, null, 2));
            logger.info('Missing details saved to file', { 
                file: this.missingDetailsFile,
                totalProducts: this.missingDetails.summary.totalProducts,
                productsWithMissingDetails: this.missingDetails.summary.productsWithMissingDetails
            });
        } catch (error) {
            logger.error('Error saving missing details file:', error);
        }
    }

    trackProduct(sourceUrl, product, missingFields) {
        if (!missingFields || missingFields.length === 0) {
            return; // No missing fields, skip tracking
        }

        const productKey = product.productCode || product.asin || product.id || 'unknown';
        const timestamp = new Date().toISOString();

        // Check for hierarchical data issues
        const hierarchicalIssues = this.detectHierarchicalIssues(product);
        const allMissingFields = [...missingFields, ...hierarchicalIssues];

        if (allMissingFields.length === 0) {
            return; // No issues to track
        }

        // Initialize product entry if not exists
        if (!this.missingDetails.products[productKey]) {
            this.missingDetails.products[productKey] = {
                productCode: productKey,
                productUrl: product.productUrl || '',
                title: product.title || '',
                brand: product.brand || '',
                price: product.price || '',
                originalPrice: product.originalPrice || '',
                discountPercentage: product.discountPercentage || '',
                sourceUrl: sourceUrl,
                missingFields: [],
                hierarchicalIssues: [],
                firstDetected: timestamp,
                lastDetected: timestamp,
                detectionCount: 0,
                categoryChain: product.hierarchicalCategory || null
            };
        }

        // Update missing fields
        const existingProduct = this.missingDetails.products[productKey];
        existingProduct.lastDetected = timestamp;
        existingProduct.detectionCount += 1;
        
        // Add new missing fields (avoid duplicates)
        missingFields.forEach(field => {
            if (!existingProduct.missingFields.includes(field)) {
                existingProduct.missingFields.push(field);
            }
        });

        // Add hierarchical issues (avoid duplicates)
        hierarchicalIssues.forEach(issue => {
            if (!existingProduct.hierarchicalIssues.includes(issue)) {
                existingProduct.hierarchicalIssues.push(issue);
            }
        });

        // Update summary statistics
        this.updateSummary();
        
        logger.debug('Tracked product with missing details', {
            productKey,
            sourceUrl,
            missingFields,
            detectionCount: existingProduct.detectionCount
        });
    }

    updateSummary() {
        const products = Object.values(this.missingDetails.products);
        this.missingDetails.summary.totalProducts = products.length;
        this.missingDetails.summary.productsWithMissingDetails = products.length;

        // Count missing fields
        const fieldCounts = {};
        products.forEach(product => {
            product.missingFields.forEach(field => {
                fieldCounts[field] = (fieldCounts[field] || 0) + 1;
            });
        });

        this.missingDetails.summary.missingFields = fieldCounts;
    }

    getProductsWithMissingDetails(limit = 50) {
        const products = Object.values(this.missingDetails.products);
        
        // Sort by detection count (most frequently missing first)
        products.sort((a, b) => b.detectionCount - a.detectionCount);
        
        return products.slice(0, limit);
    }

    getProductsByMissingField(field, limit = 50) {
        const products = Object.values(this.missingDetails.products)
            .filter(product => product.missingFields.includes(field))
            .sort((a, b) => b.detectionCount - a.detectionCount);
        
        return products.slice(0, limit);
    }

    getProductsBySourceUrl(sourceUrl, limit = 50) {
        const products = Object.values(this.missingDetails.products)
            .filter(product => product.sourceUrl === sourceUrl)
            .sort((a, b) => b.detectionCount - a.detectionCount);
        
        return products.slice(0, limit);
    }

    markProductAsFixed(productKey, fixedFields) {
        if (this.missingDetails.products[productKey]) {
            const product = this.missingDetails.products[productKey];
            
            // Remove fixed fields from missing list
            fixedFields.forEach(field => {
                const index = product.missingFields.indexOf(field);
                if (index > -1) {
                    product.missingFields.splice(index, 1);
                }
            });

            // If no more missing fields, remove from tracking
            if (product.missingFields.length === 0) {
                delete this.missingDetails.products[productKey];
                logger.info('Product removed from missing details tracking', { productKey });
            } else {
                logger.info('Product missing fields updated', { 
                    productKey, 
                    remainingMissingFields: product.missingFields 
                });
            }

            this.updateSummary();
            this.saveMissingDetails();
        }
    }

    getSummary() {
        return {
            ...this.missingDetails.summary,
            topMissingFields: Object.entries(this.missingDetails.summary.missingFields)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([field, count]) => ({ field, count }))
        };
    }

    generateReport() {
        const summary = this.getSummary();
        const products = this.getProductsWithMissingDetails(20);
        
        const report = {
            generatedAt: new Date().toISOString(),
            summary,
            topProductsWithMissingDetails: products.map(product => ({
                productCode: product.productCode,
                productUrl: product.productUrl,
                title: product.title || 'MISSING TITLE',
                brand: product.brand || 'MISSING BRAND',
                price: product.price || 'MISSING PRICE',
                sourceUrl: product.sourceUrl,
                missingFields: product.missingFields,
                detectionCount: product.detectionCount,
                categoryChain: product.categoryChain
            }))
        };

        return report;
    }

    saveReport() {
        const report = this.generateReport();
        const reportFile = path.join(__dirname, '../logs/missingDetailsReport.json');
        
        try {
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            logger.info('Missing details report saved', { reportFile });
            return reportFile;
        } catch (error) {
            logger.error('Error saving missing details report:', error);
            return null;
        }
    }

    clearOldEntries(daysOld = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        let removedCount = 0;
        Object.keys(this.missingDetails.products).forEach(productKey => {
            const product = this.missingDetails.products[productKey];
            const lastDetected = new Date(product.lastDetected);
            
            if (lastDetected < cutoffDate) {
                delete this.missingDetails.products[productKey];
                removedCount++;
            }
        });

        if (removedCount > 0) {
            this.updateSummary();
            this.saveMissingDetails();
            logger.info('Cleared old missing details entries', { removedCount, daysOld });
        }

        return removedCount;
    }

    /**
     * Detect hierarchical data issues in a product
     */
    detectHierarchicalIssues(product) {
        const issues = [];
        
        // Check for missing hierarchical fields
        const hierarchicalFields = [
            'productCategory', 'productSubcategory', 'productStyle',
            'categoryLevel1', 'categoryLevel2', 'categoryLevel3',
            'hierarchicalCategory'
        ];

        hierarchicalFields.forEach(field => {
            if (!product[field] || product[field] === '' || product[field] === 'undefined') {
                issues.push(`missing_${field}`);
            }
        });

        // Check for dummy category values
        const dummyCategories = ['General', 'Products', 'Unknown', 'N/A', 'NA'];
        hierarchicalFields.forEach(field => {
            if (dummyCategories.includes(product[field])) {
                issues.push(`dummy_${field}`);
            }
        });

        // Check for incomplete hierarchicalCategory
        if (!product.hierarchicalCategory || 
            !product.hierarchicalCategory.mainCategory || 
            product.hierarchicalCategory.mainCategory === 'General') {
            issues.push('incomplete_hierarchical_category');
        }

        return issues;
    }

    /**
     * Get products with hierarchical issues
     */
    getProductsWithHierarchicalIssues(limit = 50) {
        const products = Object.values(this.missingDetails.products)
            .filter(product => product.hierarchicalIssues && product.hierarchicalIssues.length > 0)
            .sort((a, b) => b.detectionCount - a.detectionCount);
        
        return products.slice(0, limit);
    }
}

// Create singleton instance
const missingDetailsTracker = new MissingDetailsTracker();

module.exports = { MissingDetailsTracker, missingDetailsTracker };



