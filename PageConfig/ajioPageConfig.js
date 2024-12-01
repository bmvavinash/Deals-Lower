const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  "searchPage": {
    "baseSelector": "div.product-list", // Base container for product items
    "selectors": {
      "brand": { type: "css", selector: "h1.product-brand" }, // Selector for product brand
      "name": { type: "css", selector: "h1.product-title" }, // Selector for product title
      "discountedPrice": { 
        type: "css", 
        selector: "span.product-price__final", 
        validate: validatePrice // Validates extracted price
      },
      "originalPrice": { 
        type: "css", 
        selector: "span.product-price__strike", 
        validate: validatePrice // Validates original price
      },
      "discountPercentage": { 
        type: "css", 
        selector: "span.product-price__discount", 
        validate: validateDiscount // Validates discount percentage
      },
      "rating": { 
        type: "css", 
        selector: "span.product-rating__rating" 
      }, // Extracts the rating value
      "ratingsCount": { 
        type: "css", 
        selector: "span.product-rating__total" 
      }, // Extracts the total count of ratings
      "productUrl": { 
        type: "css", 
        selector: "a.product-link" 
      }, // Selector for product link
      "stockStatus": { 
        type: "css", 
        selector: "div.out-of-stock-message" 
      }, // Selector for stock status
      "deal": { 
        type: "css", 
        selector: "div.hot-deal-label" 
      } // Selector for deal labels or tags
    }
  }
};
