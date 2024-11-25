const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  "searchPage": {
    "baseSelector": "li.product-base",
    "selectors": {
      "brand": { type: "css", selector: "h3.product-brand" },
      "name": { type: "css", selector: "h4.product-product" },
      "discountedPrice": { type: "css", selector: "span.product-discountedPrice" , validate: validatePrice},
      "originalPrice": { type: "css", selector: "span.product-strike", validate: validatePrice },
      "discountPercentage": { type: "css", selector: "span.product-discountPercentage", validate: validateDiscount },
      "rating": { type: "css", selector: "div.product-ratingsContainer > span:first-child" },
      "ratingsCount": { type: "css", selector: "div.product-ratingsCount" },
      "productUrl": { type: "css", selector: "a" } // Type as 'css' for links
    }
  }
};
