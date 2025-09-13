const { Builder, By } = require('selenium-webdriver');
const { scrapePage } = require('../pageScheduler');
const { getModuleLogger } = require('../logger/logger');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('extractionReport');

async function generateExtractionReport() {
    const driver = await new Builder().forBrowser('chrome').build();
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {},
        platformDetails: {}
    };

    try {
        const testUrls = {
            amazon: 'https://www.amazon.in/s?k=laptop',
            flipkart: 'https://www.flipkart.com/search?q=laptop',
            myntra: 'https://www.myntra.com/dresses',
            ajio: 'https://www.ajio.com/search/?text=men+watches'
        };

        for (const [platform, url] of Object.entries(testUrls)) {
            logger.info(`Generating report for ${platform} platform...`);
            
            try {
                await driver.get(url);
                await driver.sleep(3000); // Wait for page to load
                
                const products = await scrapePage(url, driver, {}, 'searchPage');
                
                // Platform summary
                const requiredFields = [
                    'brand', 'title', 'shortText', 'urltext', 'price', 'mrp', 'discount', 
                    'rating', 'ratingsCount', 'reviewsCount', 'productUrl', 'photo', 
                    'images', 'productCode', 'storeType', 'offerPrice'
                ];
                
                const missingFields = new Set();
                const fieldStats = {};
                
                if (products && products.length) {
                    // Calculate field statistics
                    for (const field of requiredFields) {
                        const populated = products.filter(p => p[field] && p[field] !== '' && p[field] !== '').length;
                        const empty = products.length - populated;
                        const percentage = Math.round((populated / products.length) * 100);
                        
                        fieldStats[field] = {
                            populated,
                            empty,
                            percentage,
                            total: products.length
                        };
                        
                        if (populated === 0) {
                            missingFields.add(field);
                        }
                    }
                    
                    // Sample products for detailed analysis
                    const sampleProducts = products.slice(0, 3).map(p => ({
                        brand: p.brand || '',
                        title: p.title || '',
                        price: p.price || '',
                        mrp: p.mrp || '',
                        discount: p.discount || '',
                        rating: p.rating || '',
                        productUrl: p.productUrl || '',
                        productCode: p.productCode || ''
                    }));
                    
                    report.platformDetails[platform] = {
                        url: url,
                        totalProducts: products.length,
                        extractionSuccess: true,
                        fieldStats: fieldStats,
                        missingFields: Array.from(missingFields),
                        sampleProducts: sampleProducts,
                        allProducts: products.map(p => ({
                            brand: p.brand || '',
                            title: p.title || '',
                            price: p.price || '',
                            mrp: p.mrp || '',
                            discount: p.discount || '',
                            rating: p.rating || '',
                            ratingsCount: p.ratingsCount || '',
                            reviewsCount: p.reviewsCount || '',
                            productUrl: p.productUrl || '',
                            productCode: p.productCode || '',
                            photo: p.photo || '',
                            offerPrice: p.offerPrice || ''
                        }))
                    };
                    
                    report.summary[platform] = {
                        extracted: products.length,
                        missingFields: Array.from(missingFields)
                    };
                    
                } else {
                    report.platformDetails[platform] = {
                        url: url,
                        totalProducts: 0,
                        extractionSuccess: false,
                        error: 'No products extracted'
                    };
                    
                    report.summary[platform] = {
                        extracted: 0,
                        missingFields: requiredFields
                    };
                }
                
            } catch (error) {
                logger.error(`Error generating report for ${platform}:`, error.message);
                report.platformDetails[platform] = {
                    url: url,
                    totalProducts: 0,
                    extractionSuccess: false,
                    error: error.message
                };
                
                report.summary[platform] = {
                    extracted: 0,
                    missingFields: requiredFields
                };
            }
            
            await driver.sleep(2000); // Wait between platforms
        }

        // Generate comprehensive summary
        const overallSummary = {
            totalProducts: Object.values(report.summary).reduce((sum, p) => sum + p.extracted, 0),
            platformBreakdown: report.summary,
            successRate: Object.values(report.summary).filter(p => p.extracted > 0).length / Object.keys(report.summary).length * 100
        };
        
        report.overallSummary = overallSummary;
        
        // Save report to file
        const reportPath = path.join(__dirname, '../extraction_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        logger.info('Extraction report generated and saved to:', reportPath);
        
        // Also save a simplified CSV version
        const csvPath = path.join(__dirname, '../extraction_report.csv');
        generateCSV(report, csvPath);
        
        logger.info('CSV report generated and saved to:', csvPath);
        
        // Display summary in console
        console.log('\n=== EXTRACTION REPORT SUMMARY ===');
        console.log(`Generated at: ${report.timestamp}`);
        console.log(`Total products extracted: ${overallSummary.totalProducts}`);
        console.log(`Overall success rate: ${overallSummary.successRate.toFixed(1)}%`);
        
        for (const [platform, details] of Object.entries(report.summary)) {
            console.log(`\n${platform.toUpperCase()}:`);
            console.log(`  Products extracted: ${details.extracted}`);
            if (details.missingFields.length > 0) {
                console.log(`  Missing fields: ${details.missingFields.join(', ')}`);
            } else {
                console.log(`  All fields populated ✓`);
            }
        }
        
        console.log(`\nDetailed reports saved to:`);
        console.log(`  JSON: ${reportPath}`);
        console.log(`  CSV: ${csvPath}`);
        
    } catch (error) {
        logger.error('Report generation failed:', error.message);
    } finally {
        await driver.quit();
    }
}

function generateCSV(report, filePath) {
    let csv = 'Platform,Product Index,Brand,Title,Price,MRP,Discount,Rating,Ratings Count,Reviews Count,Product URL,Product Code,Photo,Offer Price\n';
    
    for (const [platform, details] of Object.entries(report.platformDetails)) {
        if (details.allProducts) {
            details.allProducts.forEach((product, index) => {
                // Helper function to properly escape CSV values
                const escapeCSV = (value) => {
                    if (value === null || value === undefined || value === '') {
                        return '';
                    }
                    const stringValue = String(value);
                    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        return '"' + stringValue.replace(/"/g, '""') + '"';
                    }
                    return stringValue;
                };
                
                // Extract and clean values, ensuring empty strings for missing data
                const brand = escapeCSV(product.brand || '');
                const title = escapeCSV(product.title || '');
                const price = escapeCSV(product.price || '');
                const mrp = escapeCSV(product.mrp || '');
                const discount = escapeCSV(product.discount || '');
                const rating = escapeCSV(product.rating || '');
                const ratingsCount = escapeCSV(product.ratingsCount || '');
                const reviewsCount = escapeCSV(product.reviewsCount || '');
                const productUrl = escapeCSV(product.productUrl || '');
                const productCode = escapeCSV(product.productCode || '');
                const photo = escapeCSV(product.photo || '');
                const offerPrice = escapeCSV(product.offerPrice || '');
                
                csv += `${platform},${index + 1},${brand},${title},${price},${mrp},${discount},${rating},${ratingsCount},${reviewsCount},${productUrl},${productCode},${photo},${offerPrice}\n`;
            });
        }
    }
    
    fs.writeFileSync(filePath, csv);
}

// Run the report generation if this file is executed directly
if (require.main === module) {
    generateExtractionReport().catch(console.error);
}

module.exports = { generateExtractionReport };
