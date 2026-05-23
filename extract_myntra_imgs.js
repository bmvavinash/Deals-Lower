const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('myntra_product.html', 'utf8');
const $ = cheerio.load(html);
const imgs = [];
$('img').each((i, el) => {
  imgs.push({ class: $(el).attr('class'), src: $(el).attr('src') });
});
console.log(imgs.filter(img => img.src && img.src.includes('assets.myntassets.com') && img.src.includes('images')).slice(0, 10));
