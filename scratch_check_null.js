const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static/NON_EXISTENT_ID_999.json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("Result:", data));
});
