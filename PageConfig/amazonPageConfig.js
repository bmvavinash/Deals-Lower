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
  },
  
  // Fallback 1: Deals Grid (bottom of some category pages)
  "dealsGridPage": {
    "baseSelector": "div[data-testid='product-card']",
    "selectors": {
      "brand": { type: "css", selector: "p[id^='title-']", validate: extractBrand },
      "name": { type: "css", selector: "p[id^='title-']" },
      "discountedPrice": { type: "css", selector: "[data-testid='price-section'] .a-price .a-price-whole", validate: validatePrice },
      "originalPrice": { type: "css", selector: "[data-testid='price-section'] .a-text-price", validate: validateOriginalPrice },
      "discountPercentage": { type: "css", selector: ".style_filledRoundedBadgeLabel__Vo-4g .a-size-mini, [data-testid='price-section'] .a-size-mini", validate: validateDiscountPercentage },
      "rating": { type: "css", selector: "i.a-icon-star-medium .a-icon-alt" },
      "ratingsCount": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "productUrl": { type: "css", selector: "a[data-testid='product-card-link']", attribute: "href" },
      "productImage": { type: "css", selector: ".ProductCardImage-module__wrapper_YgLz4kq6ekChj01qeqOf img", attribute: "src" },
      "asin": { type: "css", selector: "div[data-testid='product-card']", attribute: "data-asin" }
    }
  },

  // Fallback 2: Category horizontal carousel blocks (ACS)
  "carouselPage": {
    "baseSelector": "li._carousel-v2_style_acs-product-block-v2-layout__1hFyR div.acsProductBlockV2",
    "selectors": {
      "brand": { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand },
      "name": { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" },
      "discountedPrice": { type: "css", selector: ".acsProductBlockV2__price .a-price .a-price-whole", validate: validatePrice },
      "originalPrice": { type: "css", selector: ".acsProductBlockV2__price .a-text-price", validate: validateOriginalPrice },
      "discountPercentage": { type: "css", selector: ".acsProductBlockV2__price .a-size-mini, .acsProductBlockV2__price .a-color-secondary", validate: validateDiscountPercentage },
      "rating": { type: "css", selector: ".acsProductBlockV2__review .a-icon-alt" },
      "ratingsCount": { type: "css", selector: ".acsProductBlockV2__review .acsProductBlockV2__rating__review-count", validate: validateRatingsCount },
      "productUrl": { type: "css", selector: "a.a-link-normal", attribute: "href" },
      "productImage": { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
      "asin": { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin" }
    }
  },

  // Fallback 3: Best Sellers / New Releases carousel blocks (ZGBS)
  "bestCarouselPage": {
    "baseSelector": "li.a-carousel-card div[data-asin]",
    "selectors": {
      "brand": { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand },
      "name": { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
      "discountedPrice": { type: "css", selector: "._cDEzb_p13n-sc-price_3mJ9Z, .a-color-price span" },
      "originalPrice": { type: "css", selector: ".a-text-price" },
      "discountPercentage": { type: "css", selector: ".a-size-mini.a-color-secondary" },
      "rating": { type: "css", selector: ".a-icon-alt" },
      "ratingsCount": { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
      "productUrl": { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href" },
      "productImage": { type: "css", selector: "img.p13n-sc-dynamic-image, img", attribute: "src" },
      "asin": { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin }
    }
  }
};
