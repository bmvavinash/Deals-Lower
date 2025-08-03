const { validatePrice, validateDiscount, extractAsin, extractProductUrl, extractBrand, validateRatingsCount, validateDiscountPercentage, validateBoughtInPastMonth, validateOriginalPrice } = require("../utils/commonUtils");

module.exports = {
  "searchPage": {
    "baseSelector": "div.puis-card-container",
    "selectors": {
      // Product brand - extract just the brand name (e.g., "Acer")
      "brand": { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
      
      // Product name - full product title
      "name": { type: "css", selector: "h2.a-size-medium span" },
      
      // Price information - main price without strike-through
      "discountedPrice": { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
      
      // Original price with strike-through - fixed selector
      "originalPrice": { type: "css", selector: "div.a-section.aok-inline-block span.a-price.a-text-price span.a-price-whole", validate: validateOriginalPrice },
      
      // Discount percentage - fixed selector to get the actual discount text
      "discountPercentage": { type: "css", selector: "div.a-row span:not(.a-price):not(.a-badge):not(.s-coupon-unclipped):not(.a-size-base):not(.a-color-secondary)", validate: validateDiscountPercentage },
      
      // Rating and reviews - fixed selector for ratings count
      "rating": { type: "css", selector: "span.a-size-small.a-color-base" },
      "ratingsCount": { type: "css", selector: "a[aria-label*='ratings'] span.a-size-small", validate: validateRatingsCount },
      
      // Product URL - extract from sponsored link format
      "productUrl": { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
      
      // Product Image
      "productImage": { type: "css", selector: "img.s-image", attribute: "src" },
      
      // Stock status
      "stockStatus": { type: "css", selector: "div.out-of-stock-message" },
      
      // Limited time deal badge - "Limited time deal" text
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      
      // Coupon information - updated selector for "Save ₹X,XXX with coupon"
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      
      // Delivery information - "FREE delivery as soon as..."
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      
      // Additional product info - "XK+ bought in past month" - fixed selector
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      
      // ASIN (Amazon Standard Identification Number) - extract from data attribute
      "asin": { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin },
      
      // Deal - should show "Limited time deal" instead of "Previously viewed"
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" }
    }
  }
};
