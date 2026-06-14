const https = require('https'); 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
https.get('https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app/productdeals_static.json?orderBy="staticSubcategory"&equalTo="Audio"&print="pretty"', (res) => { 
    let data = ''; 
    res.on('data', chunk => data+=chunk); 
    res.on('end', () => { 
        const prods = JSON.parse(data); 
        for (const p of Object.values(prods)) { 
            const t = p.title.toLowerCase(); 
            if (!t.includes('headphone') && !t.includes('earphone') && !t.includes('speaker') && !t.includes('soundbar') && !t.includes('earbuds') && !t.includes('tws') && !t.includes('neckband') && !t.includes('buds')) {
                console.log(p.title); 
            }
        } 
    }); 
});
