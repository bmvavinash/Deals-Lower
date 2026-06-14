process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static.json?orderBy="$key"&limitToFirst=2', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(JSON.stringify(JSON.parse(data), null, 2)));
});
