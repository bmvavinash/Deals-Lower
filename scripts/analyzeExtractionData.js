const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('analyzeExtractionData');

function analyzeExtractionData() {
    try {
        // Read the extraction report JSON
        const reportPath = path.resolve(__dirname, '..', 'extraction_report.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        
        console.log('\n=== EXTRACTION DATA ANALYSIS ===\n');
        
        const analysis = {
            totalProducts: 0,
            platforms: {},
            dataQualityIssues: [],
            fieldMismatches: []
        };
        
        for (const [platform, details] of Object.entries(report.platformDetails)) {
            if (details.allProducts && Array.isArray(details.allProducts)) {
                const products = details.allProducts;
                analysis.totalProducts += products.length;
                
                analysis.platforms[platform] = {
                    totalProducts: products.length,
                    fieldIssues: {},
                    dataTypes: {}
                };
                
                // Analyze each field for data type consistency and quality
                const fields = ['brand', 'title', 'price', 'mrp', 'discount', 'rating', 'ratingsCount', 'reviewsCount', 'productUrl', 'productCode', 'photo', 'offerPrice'];
                
                fields.forEach(field => {
                    const values = products.map(p => p[field]).filter(v => v !== null && v !== undefined && v !== '');
                    const dataTypes = new Set();
                    const fieldIssues = [];
                    
                    values.forEach((value, index) => {
                        const dataType = typeof value;
                        dataTypes.add(dataType);
                        
                        // Check for specific data quality issues
                        if (field === 'price' || field === 'mrp' || field === 'offerPrice') {
                            if (isNaN(Number(value)) && value !== '') {
                                fieldIssues.push({
                                    type: 'non_numeric_price',
                                    value: value,
                                    productIndex: index,
                                    message: `Expected numeric value but got: ${value}`
                                });
                            }
                        }
                        
                        if (field === 'rating') {
                            if (value !== '' && !/^\d+(\.\d+)?$/.test(value)) {
                                fieldIssues.push({
                                    type: 'invalid_rating',
                                    value: value,
                                    productIndex: index,
                                    message: `Expected rating format but got: ${value}`
                                });
                            }
                        }
                        
                        if (field === 'ratingsCount' || field === 'reviewsCount') {
                            if (value !== '' && !/^\d+$/.test(value)) {
                                fieldIssues.push({
                                    type: 'invalid_count',
                                    value: value,
                                    productIndex: index,
                                    message: `Expected numeric count but got: ${value}`
                                });
                            }
                        }
                        
                        if (field === 'productUrl') {
                            if (value !== '' && !value.startsWith('http')) {
                                fieldIssues.push({
                                    type: 'invalid_url',
                                    value: value,
                                    productIndex: index,
                                    message: `Expected URL but got: ${value}`
                                });
                            }
                        }
                    });
                    
                    analysis.platforms[platform].fieldIssues[field] = fieldIssues;
                    analysis.platforms[platform].dataTypes[field] = Array.from(dataTypes);
                    
                    // Collect global field mismatches
                    if (fieldIssues.length > 0) {
                        analysis.fieldMismatches.push({
                            platform,
                            field,
                            issues: fieldIssues
                        });
                    }
                });
                
                // Log platform summary
                console.log(`${platform.toUpperCase()}:`);
                console.log(`  Total products: ${products.length}`);
                console.log(`  Fields with issues: ${Object.keys(analysis.platforms[platform].fieldIssues).filter(f => analysis.platforms[platform].fieldIssues[f].length > 0).length}`);
                
                // Show specific field issues
                Object.entries(analysis.platforms[platform].fieldIssues).forEach(([field, issues]) => {
                    if (issues.length > 0) {
                        console.log(`    ${field}: ${issues.length} issues`);
                        issues.slice(0, 3).forEach(issue => {
                            console.log(`      - ${issue.message}`);
                        });
                        if (issues.length > 3) {
                            console.log(`      ... and ${issues.length - 3} more issues`);
                        }
                    }
                });
                console.log('');
            }
        }
        
        // Overall analysis summary
        console.log('=== OVERALL ANALYSIS ===');
        console.log(`Total products analyzed: ${analysis.totalProducts}`);
        console.log(`Total field mismatches: ${analysis.fieldMismatches.length}`);
        
        // Generate detailed report
        const analysisReport = {
            timestamp: new Date().toISOString(),
            summary: analysis,
            detailedIssues: analysis.fieldMismatches
        };
        
        const analysisPath = path.resolve(__dirname, '..', 'extraction_analysis.json');
        fs.writeFileSync(analysisPath, JSON.stringify(analysisReport, null, 2));
        
        console.log(`\nDetailed analysis saved to: ${analysisPath}`);
        
        // Recommendations
        console.log('\n=== RECOMMENDATIONS ===');
        if (analysis.fieldMismatches.length > 0) {
            console.log('1. Review and fix selectors for fields with data type mismatches');
            console.log('2. Add stricter validation in the extraction process');
            console.log('3. Check for HTML structure changes on the target websites');
        } else {
            console.log('✅ Data extraction looks good! No major issues detected.');
        }
        
        return analysis;
        
    } catch (error) {
        logger.error('Analysis failed:', error.message);
        console.error('❌ Analysis failed:', error.message);
        return null;
    }
}

// Run the analysis if this file is executed directly
if (require.main === module) {
    analyzeExtractionData();
}

module.exports = { analyzeExtractionData };

