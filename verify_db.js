process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static.json', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            if (!parsed) {
                console.log('Database is empty or missing!');
                return;
            }
            
            const keys = Object.keys(parsed);
            console.log('Total records in productdeals_static.json:', keys.length);
            
            let valid = 0;
            let invalid = 0;
            let sampleValid = null;
            let sampleInvalid = null;
            
            keys.forEach(k => {
                const p = parsed[k];
                if (p.staticCategory && p.staticSubcategory) {
                    valid++;
                    if (!sampleValid) sampleValid = p;
                } else {
                    invalid++;
                    if (!sampleInvalid) sampleInvalid = p;
                }
            });
            
            console.log(`\nValidation Results:`);
            console.log(`- Successfully Categorized (has static fields): ${valid}`);
            console.log(`- Missing Static Categorization: ${invalid}`);
            
            if (sampleValid) {
                console.log(`\nSample Valid Record:`);
                console.log(`  Title: ${sampleValid.title}`);
                console.log(`  Dynamic Category: ${sampleValid.hierarchicalCategory ? (sampleValid.hierarchicalCategory.mainCategory + ' > ' + sampleValid.hierarchicalCategory.subcategory) : 'N/A'}`);
                console.log(`  Mapped Static Category: ${sampleValid.staticCategory} > ${sampleValid.staticSubcategory}`);
                console.log(`  Mapped Static Style: ${sampleValid.staticStyle}`);
            }
            
        } catch(e) {
            console.log('Error parsing JSON:', e.message);
        }
    });
});
