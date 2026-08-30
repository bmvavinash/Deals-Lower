const { validatePrice, validateDiscount } = require("../utils/commonUtils");

// Custom validator for ratings count to clean formatting
function validateRatingsCount(value) {
  if (!value) return { isValid: false, value: "" };
  
  // Clean the value - remove newlines, pipes, and extra whitespace
  const cleanValue = value.toString().replace(/[\n\r|]/g, '').trim();
  
  if (!cleanValue) return { isValid: false, value: "" };
  
  // Extract just the number
  const match = cleanValue.match(/(\d+)/);
  if (match) {
    return { isValid: true, value: match[1] };
  }
  
  return { isValid: false, value: "" };
}

// Custom validator for reviews count to clean formatting
function validateReviewsCount(value) {
  if (!value) return { isValid: false, value: "" };
  
  // Clean the value - remove newlines, pipes, and extra whitespace
  const cleanValue = value.toString().replace(/[\n\r|]/g, '').trim();
  
  if (!cleanValue) {
    return { isValid: false, value: "" };
  }
  
  // Extract just the number
  const match = cleanValue.match(/(\d+)/);
  if (match) {
    return { isValid: true, value: match[1] };
  }
  
  return { isValid: false, value: "" };
}

module.exports = {
  "searchPage": {
    "baseSelector": "li.product-base",
    "selectors": {
      // Standardized field names matching database structure
      "brand": { type: "css", selector: "h3.product-brand" },
      "title": { type: "css", selector: "h4.product-product" },
      "shortText": { type: "css", selector: "h4.product-product" },
      "urltext": { type: "css", selector: "h4.product-product" },
      "price": { type: "css", selector: "span.product-discountedPrice", validate: validatePrice },
      "mrp": { type: "css", selector: "span.product-strike", validate: validatePrice },
      "discount": { type: "css", selector: "span.product-discountPercentage", validate: validateDiscount },
      "rating": { type: "css", selector: "div.product-ratingsContainer > span:first-child" },
      "ratingsCount": { type: "css", selector: "div.product-ratingsCount", validate: validateRatingsCount },
      "reviewsCount": { type: "css", selector: "div.product-ratingsCount", validate: validateReviewsCount },
      "productUrl": { type: "css", selector: "a", attribute: "href" },
      "photo": [
        { type: "css", selector: "img.img-responsive", attribute: "src" },
        { type: "css", selector: ".image-grid-image", attribute: "style", extractImageFromStyle: true }
      ],
      "images": [
        { type: "css", selector: "img.img-responsive", attribute: "src" },
        { type: "css", selector: ".image-grid-image", attribute: "style", extractImageFromStyle: true }
      ],
      "sizes": { type: "css", selector: "h4.product-sizes" },
      "availableSizes": { type: "css", selector: "span.product-sizeInventoryPresent" },
      "offerBadge": { type: "css", selector: "div.xcelerator-plpXceleratorInfoTag" },
      "isDeal": { type: "css", selector: "div.xcelerator-plpXceleratorInfoTag, .product-coupon, .product-badge" },
      "deal": { type: "css", selector: "div.xcelerator-plpXceleratorInfoTag, .product-coupon, .product-badge" },
      "limitedTimeDeal": { type: "css", selector: "div.xcelerator-plpXceleratorInfoTag, .product-coupon, .product-badge" },
      "productCategory": { type: "css", selector: "a[href*='/dresses/']", attribute: "href" },
      // Store type
      "storeType": { type: "static", value: "Myntra" },
      // Product code (extract from URL)
      "productCode": { type: "css", selector: "a", attribute: "href" }
    }
  }
};
