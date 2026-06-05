const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('amazon_test2.html', 'utf8');
const $ = cheerio.load(html);

console.log('1:', $('span.a-price .a-price-whole').first().text());
console.log('2:', $('[data-testid="price-section"] .a-price .a-price-whole').first().text());
console.log('3:', $('#priceblock_ourprice').text());
console.log('4:', $('#corePriceDisplay_desktop_feature_div .a-price-whole').first().text());
console.log('5:', $('.a-price-whole').first().text());

// Let's also check for Out of Stock or Currently unavailable
console.log('Out of Stock text:', $('#availability').text().trim());

// What is the page title?
console.log('Title:', $('title').text());
