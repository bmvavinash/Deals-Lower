const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals.json?orderBy="categoryGroup"&equalTo="electronics"&limitToFirst=2&print="pretty"', (res) => {
    let data = '';
    res.on('data', chunk => data+=chunk);
    res.on('end', () => {
        console.log('Status productdeals categoryGroup:', res.statusCode);
        console.log(data.substring(0, 500));
    });
});
