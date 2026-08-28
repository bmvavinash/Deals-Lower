const { validatePrice, validateDiscount, validateRatingsCount } = require("../utils/commonUtils");

module.exports = {
  searchPage: {
    baseSelector: "div.item.rilrtl-products-list__item", // Updated base selector for search page
    selectors: {
      // Standardized field names matching database structure
      "brand": {
        type: "css",
        selector: ".brand strong", // Extracts the product brand
      },
      "title": {
        type: "css",
        selector: ".nameCls", // Extracts the product name
      },
      "shortText": {
        type: "css",
        selector: ".nameCls", // Extracts the product name
      },
      "urltext": {
        type: "css",
        selector: ".nameCls", // Extracts the product name
      },
      "price": {
        type: "css",
        selector: ".price strong",
        validate: validatePrice, // Validates extracted price
      },
      "mrp": {
        type: "css",
        selector: ".orginal-price",
        validate: validatePrice, // Validates original price
      },
      "discount": {
        type: "css",
        selector: ".discount",
        validate: validateDiscount, // Validates discount percentage
      },
      "rating": {
        type: "css",
        selector: "._3I65V", // Extracts the rating value
        validate: validateRatingsCount,
      },
      "ratingsCount": {
        type: "css",
        selector: "._1gIWf p:last-child, ._2mae- p:last-child", // Extracts the total count of ratings
        validate: validateRatingsCount,
      },
      "reviewsCount": {
        type: "css",
        selector: "._1gIWf p:last-child, ._2mae- p:last-child", // Extracts the total count of ratings
        validate: validateRatingsCount,
      },
      "photo": {
        type: "css",
        selector: ".imgHolder img",
        attribute: "src", // Extracts the image source
      },
      "images": {
        type: "css",
        selector: ".imgHolder img",
        attribute: "src", // Extracts the image source
      },
      "productUrl": {
        type: "css",
        selector: ".rilrtl-products-list__link",
        attribute: "href", // Extracts the product link
      },
      "offerPrice": {
        type: "css",
        selector: ".offer-pricess-new", // Extracts the offer price
      },
      "exclusiveBadge": {
        type: "css",
        selector: ".exclusive-new", // Extracts exclusive badges like "BESTSELLER"
      },
      "productCategory": {
        type: "css",
        selector: "a[href*='/men/'], a[href*='/women/'], a[href*='/kids/']",
        attribute: "href"
      },
      "quickViewButton": {
        type: "css",
        selector: ".popUp", // Extracts quick view button text
      },
      // Store type
      "storeType": { type: "static", value: "Ajio" },
      // Product code (extract from URL)
      "productCode": {
        type: "css",
        selector: ".rilrtl-products-list__link",
        attribute: "href"
      },
      
      // Additional fields for database structure
      "asin": {
        type: "css",
        selector: ".rilrtl-products-list__link",
        attribute: "href"
      },
      "category": {
        type: "css",
        selector: "a[href*='/men/'], a[href*='/women/'], a[href*='/kids/']",
        attribute: "href"
      },
      "color": {
        type: "css",
        selector: ".nameCls"
      },
      "materialCare": {
        type: "css",
        selector: ".nameCls"
      },
      "seller": {
        type: "css",
        selector: ".brand strong"
      },
      "sizeFit": {
        type: "css",
        selector: ".nameCls"
      },
      "isDeal": { type: "css", selector: ".promo-desc, .deal-badge" },
      "isOffer": { type: "css", selector: ".promo-desc, .deal-badge" },
      "isDisplay": {
        type: "css",
        selector: ".exclusive-new"
      },
      "isOutOfStock": {
        type: "css",
        selector: ".exclusive-new"
      },
      "deal": { type: "css", selector: ".promo-desc, .deal-badge" },
      "limitedTimeDeal": { type: "css", selector: ".promo-desc, .deal-badge" },
      "coupon": {
        type: "css",
        selector: ".discount"
      },
      "couponAmount": {
        type: "css",
        selector: ".discount"
      },
      "extraOffers": {
        type: "css",
        selector: ".discount"
      },
      "promoInfo": {
        type: "css",
        selector: ".discount"
      },
      "delivery": {
        type: "css",
        selector: ".exclusive-new"
      },
      "deliveryInfo": {
        type: "css",
        selector: ".exclusive-new"
      },
      "boughtInPastMonth": {
        type: "css",
        selector: ".exclusive-new"
      },
      "timer": { type: "css", selector: ".promo-desc, .deal-badge" },
      "dealProgress": { type: "css", selector: ".promo-desc, .deal-badge" },
      "offers": {
        type: "css",
        selector: ".discount"
      }
    },
  },
};
