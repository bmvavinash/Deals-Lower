const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  searchPage: {
    baseSelector: "div.rilrtl-products-list__item", // Base container for product items
    selectors: {
      brand: {
        type: "css",
        selector: ".brand strong", // Extracts the product brand
      },
      name: {
        type: "css",
        selector: ".nameCls", // Extracts the product name
      },
      discountedPrice: {
        type: "css",
        selector: ".price strong",
        validate: validatePrice, // Validates extracted price
      },
      originalPrice: {
        type: "css",
        selector: ".orginal-price",
        validate: validatePrice, // Validates original price
      },
      discountPercentage: {
        type: "css",
        selector: ".discount",
        validate: validateDiscount, // Validates discount percentage
      },
      rating: {
        type: "css",
        selector: "._3I65V", // Extracts the rating value
      },
      ratingsCount: {
        type: "css",
        selector: "._1gIWf p:last-child", // Extracts the total count of ratings
      },
      imageUrl: {
        type: "css",
        selector: ".imgHolder img",
        attribute: "src", // Extracts the image source
      },
      productUrl: {
        type: "css",
        selector: ".rilrtl-products-list__link",
        attribute: "href", // Extracts the product link
      },
      offerPrice: {
        type: "css",
        selector: ".offer-pricess-new", // Extracts the offer price
      },
    },
  },
};
