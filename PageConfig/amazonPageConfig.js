const { validatePrice, validateDiscount, extractAsin, extractProductUrl, extractBrand, validateRatingsCount, validateDiscountPercentage, validateBoughtInPastMonth, validateOriginalPrice } = require("../utils/commonUtils");

module.exports = {
  "searchPage": {
    "baseSelector": "div.puis-card-container",
    "selectors": {
      // Standardized field names matching Flipkart structure
      "brand": [
        { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium a", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium", validate: extractBrand },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", validate: extractBrand },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand },
        { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand }
      ],
      "title": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "shortText": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "urltext": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      
      // Price information - More specific selectors to avoid wrong data
      "price": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "span.a-price[data-a-size='xl'] .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price[data-a-size='xl'] .a-offscreen", validate: validatePrice },
        { type: "css", selector: "div[data-cy='price-recipe'] span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "div[data-cy='price-recipe'] span.a-price .a-offscreen", validate: validatePrice }
      ],
      "mrp": [
        { type: "css", selector: "div[data-cy='price-recipe'] .a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: "div[data-cy='price-recipe'] .a-text-price .a-offscreen", validate: validateOriginalPrice },
        { type: "css", selector: "div[data-cy='price-recipe'] .a-section.aok-inline-block span.a-price.a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: "div[data-cy='price-recipe'] .a-section.aok-inline-block span.a-price.a-text-price .a-offscreen", validate: validateOriginalPrice },
        { type: "css", selector: "span.a-offscreen:contains('M.R.P:')", validate: validateOriginalPrice },
        { type: "css", selector: "div.a-section.aok-inline-block span.a-price.a-text-price", validate: validateOriginalPrice }
      ],
      "offerPrice": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "span.a-price[data-a-size='xl'] .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price[data-a-size='xl'] .a-offscreen", validate: validatePrice },
        { type: "css", selector: "div[data-cy='price-recipe'] span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "div[data-cy='price-recipe'] span.a-price .a-offscreen", validate: validatePrice }
      ],
      "discount": [
        { type: "css", selector: "div[data-cy='price-recipe'] span.a-letter-space + span", validate: validateDiscountPercentage },
        { type: "css", selector: "div[data-cy='price-recipe'] span:contains('% off')", validate: validateDiscountPercentage },
        { type: "css", selector: "div[data-cy='price-recipe'] span:contains('off')", validate: validateDiscountPercentage },
        { type: "css", selector: "div[data-cy='price-recipe'] .a-row span:not(.a-price):not(.a-badge)", validate: validateDiscountPercentage },
        { type: "css", selector: "span.a-size-mini.a-color-secondary:contains('%')", validate: validateDiscountPercentage },
        { type: "css", selector: "span.a-size-mini.a-color-secondary:contains('off')", validate: validateDiscountPercentage }
      ],
      

      
      // Product URL and Image
      "productUrl": [
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal.aok-block[href]", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "h2.a-size-medium a", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a[data-testid='product-card-link']", attribute: "href", validate: extractProductUrl }
      ],
      "photo": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: ".ProductCardImage-module__wrapper_YgLz4kq6ekChj01qeqOf img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "images": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: ".ProductCardImage-module__wrapper_YgLz4kq6ekChj01qeqOf img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      
      // Product identification
      "asin": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin },
        { type: "css", selector: "div[data-asin]", attribute: "data-asin" },
        { type: "css", selector: "[data-asin]", attribute: "data-asin" },
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin }
      ],
      "productCode": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin },
        { type: "css", selector: "div[data-asin]", attribute: "data-asin" },
        { type: "css", selector: "[data-asin]", attribute: "data-asin" },
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin }
      ],
      
      // Ratings and Reviews
      "rating": [
        { type: "css", selector: "i.a-icon-star span.a-icon-alt", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: ".a-icon-row a[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: ".a-icon-row i .a-icon-alt" },
        { type: "css", selector: "i.a-icon-star-small span.a-icon-alt", attribute: "textContent" },
        { type: "css", selector: "i.a-icon-star", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='stars']", attribute: "aria-label" },
        { type: "css", selector: ".a-icon-alt" },
        { type: "css", selector: ".acsProductBlockV2__review .a-icon-alt" }
      ],
      "ratingsCount": [
        { type: "css", selector: "span.a-size-small", attribute: "textContent", validate: validateRatingsCount },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a[aria-label*='out of 5 stars']", attribute: "aria-label", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", attribute: "textContent", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: "a[aria-label*='stars'] span", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small.a-color-secondary", validate: validateRatingsCount }
      ],
      "reviewsCount": [
        { type: "css", selector: "span.a-size-small", attribute: "textContent", validate: validateRatingsCount },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a[aria-label*='out of 5 stars']", attribute: "aria-label", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", attribute: "textContent", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: "a[aria-label*='stars'] span", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small.a-color-secondary", validate: validateRatingsCount }
      ],
      
      // Stock and deal status
      "isOutOfStock": { type: "css", selector: "div.out-of-stock-message" },
      "isDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "isOffer": { type: "css", selector: "span.s-coupon-unclipped" },
      "isDisplay": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      
      // Deal information
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      
      // Coupon and offers
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      
      // Delivery information
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      
      // Additional product info
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      
      // Store type
      "storeType": { type: "static", value: "Amazon" },
      
      // Timer and deal progress (Amazon specific)
      "timer": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "dealProgress": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      
      // Additional product details
      "category": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "color": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "materialCare": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "seller": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "sizeFit": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      "offers": { type: "css", selector: "span.s-coupon-unclipped" }
    }
  },
  
  // Fallback 1: Deals Grid (bottom of some category pages)
  "dealsGridPage": {
    "baseSelector": "div[data-testid='product-card']",
    "selectors": {
      "brand": [
        { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium a", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium", validate: extractBrand },
        { type: "css", selector: "p[id^='title-']", validate: extractBrand },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand },
        { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand }
      ],
      "title": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "p[id^='title-']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "shortText": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "p[id^='title-']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "urltext": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "p[id^='title-']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "price": [
        { type: "css", selector: "[data-testid='price-section'] .a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice }
      ],
      "mrp": [
        { type: "css", selector: "span.a-price.a-text-price .a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: "span.a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: ".a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: "[data-testid='price-section'] .a-text-price", validate: validateOriginalPrice }
      ],
      "discount": [
        { type: "css", selector: "span.a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='% off']", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='off']", validate: validateDiscountPercentage },
        { type: "css", selector: ".style_filledRoundedBadgeLabel__Vo-4g .a-size-mini", validate: validateDiscountPercentage },
        { type: "css", selector: "[data-testid='price-section'] .a-size-mini", validate: validateDiscountPercentage }
      ],
      "offerPrice": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice },
        { type: "css", selector: "[data-testid='price-section'] .a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: ".a-color-price", validate: validatePrice }
      ],
      "rating": [
        { type: "css", selector: "i.a-icon-star span.a-icon-alt", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: "i.a-icon-star-medium .a-icon-alt" },
        { type: "css", selector: ".a-icon-alt" },
        { type: "css", selector: "i.a-icon-star-small span.a-icon-alt", attribute: "textContent" }
      ],
      "ratingsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small.a-color-secondary", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "reviewsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: "span.a-size-small.a-color-secondary", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "productUrl": [
        { type: "css", selector: "a[data-testid='product-card-link']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal.aok-block[href]", attribute: "href", validate: extractProductUrl }
      ],
      "photo": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".ProductCardImage-module__wrapper_YgLz4kq6ekChj01qeqOf img", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "images": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".ProductCardImage-module__wrapper_YgLz4kq6ekChj01qeqOf img", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "asin": [
        { type: "css", selector: "div[data-testid='product-card']", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      "productCode": [
        { type: "css", selector: "div[data-testid='product-card']", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      
      // Additional fields
      "shortText": { type: "css", selector: "p[id^='title-']" },
      "urltext": { type: "css", selector: "p[id^='title-']" },
      "category": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "color": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "materialCare": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "seller": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "sizeFit": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "isOutOfStock": { type: "css", selector: "span.a-size-medium.a-color-price" },
      "isDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "isOffer": { type: "css", selector: "span.s-coupon-unclipped" },
      "isDisplay": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      "timer": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "dealProgress": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "offers": { type: "css", selector: "span.s-coupon-unclipped" },
      "storeType": { type: "static", value: "Amazon" }
    }
  },

  // Fallback 2: Category horizontal carousel blocks (ACS)
  "carouselPage": {
    "baseSelector": "li._carousel-v2_style_acs-product-block-v2-layout__1hFyR div.acsProductBlockV2",
    "selectors": {
      "brand": [
        { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium a", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium", validate: extractBrand },
        { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand }
      ],
      "title": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" }
      ],
      "shortText": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" }
      ],
      "urltext": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" }
      ],
      "price": [
        { type: "css", selector: ".acsProductBlockV2__price .a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice }
      ],
      "mrp": [
        { type: "css", selector: "span.a-price.a-text-price .a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: "span.a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: ".a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: ".acsProductBlockV2__price .a-text-price", validate: validateOriginalPrice }
      ],
      "discount": [
        { type: "css", selector: "span.a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='% off']", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='off']", validate: validateDiscountPercentage },
        { type: "css", selector: ".acsProductBlockV2__price .a-size-mini", validate: validateDiscountPercentage },
        { type: "css", selector: ".acsProductBlockV2__price .a-color-secondary", validate: validateDiscountPercentage }
      ],
      "offerPrice": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice },
        { type: "css", selector: ".acsProductBlockV2__price .a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: ".a-color-price", validate: validatePrice }
      ],
      "rating": [
        { type: "css", selector: "i.a-icon-star span.a-icon-alt", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: ".acsProductBlockV2__review .a-icon-alt" },
        { type: "css", selector: ".a-icon-alt" },
        { type: "css", selector: "i.a-icon-star-small span.a-icon-alt", attribute: "textContent" }
      ],
      "ratingsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__review .acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "reviewsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__review .acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "productUrl": [
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal.aok-block[href]", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal", attribute: "href", validate: extractProductUrl }
      ],
      "photo": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "images": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "asin": [
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      "productCode": [
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      
      // Additional fields
      "category": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "color": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "materialCare": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "seller": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "sizeFit": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "isOutOfStock": { type: "css", selector: "span.a-size-medium.a-color-price" },
      "isDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "isOffer": { type: "css", selector: "span.s-coupon-unclipped" },
      "isDisplay": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      "timer": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "dealProgress": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "offers": { type: "css", selector: "span.s-coupon-unclipped" },
      "storeType": { type: "static", value: "Amazon" }
    }
  },

  // Fallback 3: Best Sellers / New Releases carousel blocks (ZGBS)
  "bestCarouselPage": {
    "baseSelector": "li.a-carousel-card div[data-asin]",
    "selectors": {
      "brand": [
        { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium a", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium", validate: extractBrand },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand },
        { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand }
      ],
      "title": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "shortText": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "urltext": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "price": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "._cDEzb_p13n-sc-price_3mJ9Z", validate: validatePrice },
        { type: "css", selector: ".a-color-price span", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice }
      ],
      "mrp": [
        { type: "css", selector: "span.a-price.a-text-price .a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: "span.a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: ".a-price.a-text-price", validate: validateOriginalPrice }
      ],
      "discount": [
        { type: "css", selector: "span.a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='% off']", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='off']", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini", validate: validateDiscountPercentage }
      ],
      "offerPrice": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "._cDEzb_p13n-sc-price_3mJ9Z", validate: validatePrice },
        { type: "css", selector: ".a-color-price span", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice }
      ],
      "rating": [
        { type: "css", selector: "i.a-icon-star span.a-icon-alt", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: ".a-icon-row i .a-icon-alt" },
        { type: "css", selector: ".a-icon-alt" },
        { type: "css", selector: "i.a-icon-star-small span.a-icon-alt", attribute: "textContent" }
      ],
      "ratingsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "reviewsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "productUrl": [
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal.aok-block[href]", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a[data-testid='product-card-link']", attribute: "href", validate: extractProductUrl }
      ],
      "photo": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "images": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "asin": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin },
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin }
      ],
      "productCode": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin },
        { type: "css", selector: "div.acsProductBlockV2", attribute: "data-asin", validate: extractAsin }
      ],
      
      // Additional fields
      "category": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "color": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "materialCare": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "seller": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "sizeFit": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "isOutOfStock": { type: "css", selector: "span.a-size-medium.a-color-price" },
      "isDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "isOffer": { type: "css", selector: "span.s-coupon-unclipped" },
      "isDisplay": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      "timer": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "dealProgress": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "offers": { type: "css", selector: "span.s-coupon-unclipped" },
      "storeType": { type: "static", value: "Amazon" }
    }
  },

  // Fallback 4: Trending sections and sponsored carousel blocks (SP Search Thematic)
  "trendingCarouselPage": {
    "baseSelector": "li.a-carousel-card div[data-asin]",
    "selectors": {
      "brand": [
        { type: "css", selector: "h2.a-size-medium span", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium a", validate: extractBrand },
        { type: "css", selector: "h2.a-size-medium", validate: extractBrand },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", validate: extractBrand },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2", validate: extractBrand },
        { type: "css", selector: ".acsProductBlockV2__contributor .a-text-bold", validate: extractBrand }
      ],
      "title": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: "a.a-link-normal[href*='/dp/']" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "shortText": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "urltext": [
        { type: "css", selector: "h2.a-size-medium span" },
        { type: "css", selector: "h2.a-size-medium a" },
        { type: "css", selector: "h2.a-size-medium" },
        { type: "css", selector: ".p13n-sc-truncate-desktop-type2" },
        { type: "css", selector: ".acsProductBlockV2__product-title .a-truncate-full" }
      ],
      "price": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "span.a-price", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice },
        { type: "css", selector: ".a-color-price", validate: validatePrice },
        { type: "css", selector: "._cDEzb_p13n-sc-price_3mJ9Z", validate: validatePrice }
      ],
      "mrp": [
        { type: "css", selector: "span.a-price.a-text-price .a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price span.a-price-whole", validate: validateOriginalPrice },
        { type: "css", selector: ".a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: "span.a-price.a-text-price", validate: validateOriginalPrice },
        { type: "css", selector: ".a-price.a-text-price", validate: validateOriginalPrice }
      ],
      "discount": [
        { type: "css", selector: "span.a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini.a-color-secondary", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='% off']", validate: validateDiscountPercentage },
        { type: "css", selector: "span[aria-label*='off']", validate: validateDiscountPercentage },
        { type: "css", selector: ".a-size-mini", validate: validateDiscountPercentage }
      ],
      "offerPrice": [
        { type: "css", selector: "span.a-price .a-price-whole", validate: validatePrice },
        { type: "css", selector: "span.a-price .a-offscreen", validate: validatePrice },
        { type: "css", selector: "span.a-price", validate: validatePrice },
        { type: "css", selector: ".a-price-whole", validate: validatePrice },
        { type: "css", selector: ".a-color-price", validate: validatePrice },
        { type: "css", selector: "._cDEzb_p13n-sc-price_3mJ9Z", validate: validatePrice }
      ],
      "rating": [
        { type: "css", selector: "i.a-icon-star span.a-icon-alt", attribute: "aria-label" },
        { type: "css", selector: "span[aria-label*='out of 5 stars']", attribute: "aria-label" },
        { type: "css", selector: ".a-icon-row i .a-icon-alt" },
        { type: "css", selector: ".a-icon-alt" },
        { type: "css", selector: "i.a-icon-star-small span.a-icon-alt", attribute: "textContent" }
      ],
      "ratingsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "reviewsCount": [
        { type: "css", selector: "span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-icon-row a span.a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".a-size-small", validate: validateRatingsCount },
        { type: "css", selector: ".acsProductBlockV2__rating__review-count", validate: validateRatingsCount }
      ],
      "productUrl": [
        { type: "css", selector: "a.a-link-normal[href*='/dp/']", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal.aok-block[href]", attribute: "href", validate: extractProductUrl },
        { type: "css", selector: "a.a-link-normal", attribute: "href", validate: extractProductUrl }
      ],
      "photo": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "images": [
        { type: "css", selector: "img.s-image", attribute: "src" },
        { type: "css", selector: "img.p13n-sc-dynamic-image", attribute: "src" },
        { type: "css", selector: ".acsProductBlockV2__product_image img", attribute: "src" },
        { type: "css", selector: "img", attribute: "src" }
      ],
      "asin": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      "productCode": [
        { type: "css", selector: "div[data-asin]", attribute: "data-asin", validate: extractAsin },
        { type: "css", selector: "[data-csa-c-item-id]", attribute: "data-csa-c-item-id", validate: extractAsin }
      ],
      
      // Additional fields
      "category": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "color": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "materialCare": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "seller": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "sizeFit": { type: "css", selector: "span.a-size-small.a-color-secondary" },
      "isOutOfStock": { type: "css", selector: "span.a-size-medium.a-color-price" },
      "isDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "isOffer": { type: "css", selector: "span.s-coupon-unclipped" },
      "isDisplay": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "deal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "limitedTimeDeal": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "coupon": { type: "css", selector: "span.s-coupon-unclipped" },
      "couponAmount": { type: "css", selector: "span.s-highlighted-text-padding" },
      "extraOffers": { type: "css", selector: "span.s-coupon-unclipped" },
      "promoInfo": { type: "css", selector: "span.s-coupon-unclipped" },
      "delivery": { type: "css", selector: "span[aria-label*='delivery']" },
      "deliveryInfo": { type: "css", selector: "span[aria-label*='delivery']" },
      "boughtInPastMonth": { type: "css", selector: "div.a-row.a-size-base span.a-size-base.a-color-secondary", validate: validateBoughtInPastMonth },
      "timer": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "dealProgress": { type: "css", selector: "span.a-badge-text[data-a-badge-color='sx-cloud']" },
      "offers": { type: "css", selector: "span.s-coupon-unclipped" },
      "storeType": { type: "static", value: "Amazon" }
    }
  }
};
