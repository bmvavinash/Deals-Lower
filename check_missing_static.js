process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static.json', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        const keys = Object.keys(parsed);
        let missingCount = 0;
        let missingExamples = [];
        keys.forEach(k => {
            const p = parsed[k];
            if (!p.staticCategory || !p.staticSubcategory) {
                missingCount++;
                if (missingExamples.length < 3) missingExamples.push(p);
            }
        });
        console.log(`Total missing static mappings: ${missingCount}`);
        if (missingExamples.length > 0) {
            console.log('Examples:', JSON.stringify(missingExamples, null, 2));
        }
    });
});
