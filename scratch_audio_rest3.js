const https = require('https'); 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static.json?orderBy="staticSubcategory"&equalTo="Audio"&print="pretty"', (res) => { 
    let data = ''; 
    res.on('data', chunk => data+=chunk); 
    res.on('end', () => { 
        const prods = JSON.parse(data); 
        for (const p of Object.values(prods)) { 
            if (p.title.includes('Acer Nitro')) {
                console.log(JSON.stringify(p, null, 2)); 
                break;
            }
        } 
    }); 
});
