const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  "searchPage": {
    "selectors": {
      "brand": { type: "css", selector: "h1.product-brand" },
      "name": { type: "css", selector: "h1.product-title" },
      "discountedPrice": { type: "css", selector: "span.product-price__final", validate: validatePrice },
      "originalPrice": { type: "css", selector: "span.product-price__strike", validate: validatePrice },
      "discountPercentage": { type: "css", selector: "span.product-price__discount", validate: validateDiscount },
      "rating": { type: "css", selector: "span.product-rating__rating" },
      "ratingsCount": { type: "css", selector: "span.product-rating__total" },
      "productUrl": { type: "css", selector: "a.product-link" },
      "stockStatus": { type: "css", selector: "div.out-of-stock-message" },
      "deal": { type: "css", selector: "div.hot-deal-label" }
    }
  }
};
