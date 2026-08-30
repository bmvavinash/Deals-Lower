const { validatePrice, validateDiscount, validateRatingsCount } = require("../utils/commonUtils");

// Known brand names for validation
const knownBrands = [
    'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Oppo', 'Vivo', 'Nokia', 'Motorola', 'Lenovo',
    'HP', 'Dell', 'ASUS', 'Acer', 'MSI', 'Gigabyte', 'Razer', 'Alienware', 'Predator', 'ROG',
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance', 'Converse', 'Vans',
    'Levi\'s', 'Wrangler', 'Lee', 'Denim', 'Pepe Jeans', 'Flying Machine', 'Spykar',
    'Sony', 'LG', 'Panasonic', 'Philips', 'Boat', 'JBL', 'Sennheiser', 'Audio-Technica',
    'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Insta360',
    'Casio', 'Titan', 'Fastrack', 'Fossil', 'G-Shock', 'Timex', 'Seiko', 'Citizen',
    'Ray-Ban', 'Oakley', 'Polaroid', 'Carrera', 'Vogue', 'Vincent Chase', 'CHUWI'
];

// Custom brand validation function
function validateBrand(value) {
    if (!value || value === 'N/A') return '';
    
    // Clean the value
    const cleanValue = value.toString().trim();
    if (!cleanValue) return '';
    
    // Get first word
    const firstWord = cleanValue.split(' ')[0].toLowerCase();
    
    // Check if first word is a known brand
    const isKnownBrand = knownBrands.some(brand => 
        brand.toLowerCase() === firstWord || 
        brand.toLowerCase().includes(firstWord) ||
        firstWord.includes(brand.toLowerCase())
    );
    
    if (isKnownBrand) {
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1); // Return capitalized brand name
    }
    
    // If not a known brand, return the first word as potential brand
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

module.exports = {
  searchPage: {
      // Use robust relative CSS selectors within each product card
      // Each card has a data-id and contains anchors/images/text
      baseSelector: 'div[data-id]',
      selectors: {
          // Standardized field names matching database structure
          // Prefer product tile link and title
          "productUrl": [
            { type: 'css', selector: 'a.rPDeLR, a.WKTcLC, a.GnxRXv, a.pIpigb, a.fb4uj3', attribute: 'href' },
            { type: 'css', selector: 'a[href*="/p/"]', attribute: 'href' },
            { type: 'css', selector: 'a[href*="pid="]', attribute: 'href' }
          ],
          "title":     [
            { type: 'css', selector: 'a.WKTcLC, .KzDlHZ, a.pIpigb, a[title]' },
            { type: 'css', selector: 'div[class*="KzDlHZ"], div[class*="wjcEIp"]' },
            { type: 'css', selector: 'img[src*="rukminim2"]', attribute: 'alt' }
          ],
          "shortText": [
            { type: 'css', selector: 'a.WKTcLC, .KzDlHZ, a.pIpigb, a[title]' },
            { type: 'css', selector: 'img[src*="rukminim2"]', attribute: 'alt' }
          ],
          "urltext":   [
            { type: 'css', selector: 'a.WKTcLC, .KzDlHZ, a.pIpigb, a[title]' },
            { type: 'css', selector: 'img[src*="rukminim2"]', attribute: 'alt' }
          ],
          "brand": [
            { type: 'css', selector: 'a.WKTcLC, a.pIpigb', validate: validateBrand },
            { type: 'css', selector: '.KzDlHZ', validate: validateBrand },
            { type: 'css', selector: 'a[title*=" "]', validate: validateBrand },
            { type: 'css', selector: 'div[class*="product"]', validate: validateBrand },
            { type: 'fallback', field: 'title', validate: validateBrand }
          ],
          "price": [
            { type: 'css', selector: '.hl05eU .Nx9bqj, .hZ3P6w, .Nx9bqj', validate: validatePrice },
            { type: 'xpath', selector: '(//div[contains(text(), "₹") and string-length(text()) < 15])[1]', validate: validatePrice },
            { type: 'css', selector: 'div[class*="v1zwn2"][class*="v1zwn29"]', validate: validatePrice }
          ],
          "mrp": [
            { type: 'css', selector: '.hl05eU .yRaY8j, .kRYCnD, .yRaY8j', validate: validatePrice },
            { type: 'xpath', selector: '(//*[contains(@style, "line-through")])[1]', validate: validatePrice },
            { type: 'css', selector: 'div[class*="v1zwn2"][class*="v1zwn20"]', validate: validatePrice }
          ],
          "discount": [
            { type: 'css', selector: '.hl05eU .UkUFwK span, .HQe8jr span, .UkUFwK span', validate: validateDiscount },
            { type: 'xpath', selector: '(//*[contains(text(), "%") and string-length(text()) < 10])[1]', validate: validateDiscount },
            { type: 'xpath', selector: '(//*[contains(@style, "rgb(0, 128, 66)") and contains(text(), "%")])[1]', validate: validateDiscount },
            { type: 'css', selector: 'div[class*="v1zwn2"][class*="v1zwn24"]', validate: validateDiscount }
          ],
          "offerPrice": [
            { type: 'css', selector: '.hl05eU .Nx9bqj, .hZ3P6w, .Nx9bqj', validate: validatePrice },
            { type: 'xpath', selector: '(//div[contains(text(), "₹") and string-length(text()) < 15])[1]', validate: validatePrice },
            { type: 'css', selector: 'div[class*="v1zwn2"][class*="v1zwn29"]', validate: validatePrice }
          ],
          
          // Rating and reviews - add missing fields
          "rating": { type: 'css', selector: '.Y1HWO0 .XQDdHH, .MKiFS6, .XQDdHH', validate: validateRatingsCount },
          "ratingsCount": { type: 'css', selector: '.Wphh3N, .PvbNMB', validate: validateRatingsCount },
          "reviewsCount": { type: 'css', selector: '.Wphh3N, .PvbNMB', validate: validateRatingsCount },
          
          "photo":     { type: 'css', selector: 'img._53J4C-, img.UCc1lI, img[src*="rukminim2"]', attribute: 'src' },
          "images":    { type: 'css', selector: 'img._53J4C-, img.UCc1lI, img[src*="rukminim2"]', attribute: 'src' },
          "flipkartAssure": { type: 'css', selector: 'img[src*="fa_"]' },
          
          // Static storeType
          "storeType": { type: 'static', value: 'Flipkart' },
          
          // Fallback for productCode (also derived via getCode from productUrl)
          "productCode": [
            { type: 'css', selector: 'a.rPDeLR', attribute: 'href' },
            { type: 'css', selector: 'a.WKTcLC', attribute: 'href' },
            { type: 'css', selector: 'a[href*="/p/"]', attribute: 'href' },
            { type: 'css', selector: 'a[href*="pid="]', attribute: 'href' }
          ],
          
          // Additional fields for database structure
          "asin": { type: 'css', selector: 'a.rPDeLR', attribute: 'href' },
          "category": { type: 'css', selector: '.PkadOy div' },
          "color": { type: 'css', selector: '.PkadOy div' },
          "materialCare": { type: 'css', selector: '.PkadOy div' },
          "seller": { type: 'css', selector: '.PkadOy div' },
          "sizeFit": { type: 'css', selector: '.PkadOy div' },
          "isDeal": [
            { type: 'css', selector: 'div[class*="deal"]' },
            { type: 'css', selector: 'span[class*="deal"]' },
            { type: 'css', selector: 'div[class*="badge"]' },
            { type: 'css', selector: 'span[class*="badge"]' },
            { type: 'css', selector: '.yiggsN' },
            { type: 'css', selector: '.M4DNwV' }
          ],
          "isOffer": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "isDisplay": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "isOutOfStock": { type: 'css', selector: '.dVXNbG img' },
          "deal": [
            { type: 'css', selector: 'div[class*="deal"]' },
            { type: 'css', selector: 'span[class*="deal"]' },
            { type: 'css', selector: 'div[class*="badge"]' },
            { type: 'css', selector: 'span[class*="badge"]' },
            { type: 'css', selector: '.yiggsN' },
            { type: 'css', selector: '.M4DNwV' }
          ],
          "limitedTimeDeal": [
            { type: 'css', selector: 'div[class*="deal"]' },
            { type: 'css', selector: 'span[class*="deal"]' },
            { type: 'css', selector: 'div[class*="badge"]' },
            { type: 'css', selector: 'span[class*="badge"]' },
            { type: 'css', selector: '.yiggsN' },
            { type: 'css', selector: '.M4DNwV' }
          ],
          "coupon": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "couponAmount": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "extraOffers": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "promoInfo": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "delivery": { type: 'css', selector: '.PkadOy div' },
          "deliveryInfo": { type: 'css', selector: '.PkadOy div' },
          "boughtInPastMonth": { type: 'css', selector: '.PkadOy div' },
          "timer": [
            { type: 'css', selector: 'div[class*="timer"]' },
            { type: 'css', selector: 'span[class*="timer"]' },
            { type: 'css', selector: '.yiggsN' }
          ],
          "dealProgress": { type: 'css', selector: '.M4DNwV .yiggsN' },
          "offers": { type: 'css', selector: '.M4DNwV .yiggsN' }
      }
  }
};
