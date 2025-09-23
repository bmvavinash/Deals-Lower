const { missingDetailsTracker } = require('../utils/missingDetailsTracker');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('checkMissingDetails');

async function main() {
    try {
        console.log('🔍 Checking Missing Details Report\n');

        // Generate and save report
        const reportFile = missingDetailsTracker.saveReport();
        const summary = missingDetailsTracker.getSummary();

        console.log('📊 MISSING DETAILS SUMMARY');
        console.log('========================');
        console.log(`Total Products with Missing Details: ${summary.totalProducts}`);
        console.log(`Last Updated: ${summary.lastUpdated}`);
        console.log('');

        if (summary.topMissingFields && summary.topMissingFields.length > 0) {
            console.log('🏆 TOP MISSING FIELDS:');
            summary.topMissingFields.forEach((item, index) => {
                console.log(`${index + 1}. ${item.field}: ${item.count} products`);
            });
            console.log('');
        }

        // Show top products with missing details
        const topProducts = missingDetailsTracker.getProductsWithMissingDetails(10);
        if (topProducts.length > 0) {
            console.log('🎯 TOP PRODUCTS WITH MISSING DETAILS:');
            console.log('=====================================');
            
            topProducts.forEach((product, index) => {
                console.log(`\n${index + 1}. Product Code: ${product.productCode}`);
                console.log(`   Title: ${product.title || 'MISSING TITLE'}`);
                console.log(`   Brand: ${product.brand || 'MISSING BRAND'}`);
                console.log(`   Price: ${product.price || 'MISSING PRICE'}`);
                console.log(`   Product URL: ${product.productUrl}`);
                console.log(`   Source URL: ${product.sourceUrl}`);
                console.log(`   Missing Fields: ${product.missingFields.join(', ')}`);
                console.log(`   Detection Count: ${product.detectionCount}`);
                console.log(`   Category Chain: ${product.categoryChain ? JSON.stringify(product.categoryChain) : 'N/A'}`);
            });
        } else {
            console.log('✅ No products with missing details found!');
        }

        // Show products by missing field
        const criticalFields = ['title', 'brand', 'price', 'originalPrice', 'discountPercentage'];
        console.log('\n📋 PRODUCTS BY MISSING FIELD:');
        console.log('==============================');
        
        criticalFields.forEach(field => {
            const products = missingDetailsTracker.getProductsByMissingField(field, 5);
            if (products.length > 0) {
                console.log(`\n🔸 Missing ${field.toUpperCase()} (${products.length} products):`);
                products.forEach((product, index) => {
                    console.log(`   ${index + 1}. ${product.productCode} - ${product.productUrl}`);
                });
            }
        });

        // Show products by source URL
        const allProducts = missingDetailsTracker.getProductsWithMissingDetails(50);
        const sourceUrls = [...new Set(allProducts.map(p => p.sourceUrl))];
        
        if (sourceUrls.length > 0) {
            console.log('\n🌐 PRODUCTS BY SOURCE URL:');
            console.log('===========================');
            
            sourceUrls.forEach(sourceUrl => {
                const products = missingDetailsTracker.getProductsBySourceUrl(sourceUrl, 5);
                if (products.length > 0) {
                    console.log(`\n🔗 ${sourceUrl} (${products.length} products with missing details):`);
                    products.forEach((product, index) => {
                        console.log(`   ${index + 1}. ${product.productCode} - Missing: ${product.missingFields.join(', ')}`);
                    });
                }
            });
        }

        if (reportFile) {
            console.log(`\n📄 Full report saved to: ${reportFile}`);
        }

        console.log('\n✅ Missing details check completed!');

    } catch (error) {
        logger.error('Error checking missing details:', error);
        console.error('❌ Error:', error.message);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'report';

switch (command) {
    case 'report':
        main();
        break;
    case 'clear':
        const daysOld = parseInt(args[1]) || 7;
        const removedCount = missingDetailsTracker.clearOldEntries(daysOld);
        console.log(`🧹 Cleared ${removedCount} old entries (older than ${daysOld} days)`);
        break;
    case 'summary':
        const summary = missingDetailsTracker.getSummary();
        console.log(JSON.stringify(summary, null, 2));
        break;
    default:
        console.log(`
🔍 Missing Details Checker

Usage: node scripts/checkMissingDetails.js [command]

Commands:
  report     Generate and display missing details report (default)
  clear [days]  Clear old entries (default: 7 days)
  summary    Show summary only

Examples:
  node scripts/checkMissingDetails.js report
  node scripts/checkMissingDetails.js clear 14
  node scripts/checkMissingDetails.js summary
        `);
        break;
}

module.exports = { main };



