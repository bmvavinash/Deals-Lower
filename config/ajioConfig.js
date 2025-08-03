const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
    brand: [
        { type: "css", selector: ".brand-name", validator: validateText },
    ],
    title: [
        { type: "css", selector: ".prod-name", validator: validateText },
    ],
    productText: [
        { type: "css", selector: ".brand-name", validator: validateText },
        { type: "css", selector: ".prod-name", validator: validateText },
    ],
    price: [
        { type: "css", selector: ".prod-sp", validator: validatePrice },
    ],
    mrp: [
        { type: "css", selector: ".prod-cp", validator: validatePrice },
    ],
    discount: [
        { type: "css", selector: ".prod-discnt", validator: validateDiscount },
    ],
    rating: [
        { type: "css", selector: ".rating-popup ._1jiCk span._3c5q0" },
        { type: "css", selector: "._3KsA3 span._1P7MF" },
    ],
    ratingsCount: [
        { type: "css", selector: ".rating-popup .rating-label-star-count span._38RNg" },
        { type: "css", selector: "._3KsA3 ._3AxgC" },
    ],
    images: [
        { type: "css", selector: ".product-image-gallery img.img-alignment", attribute: "src", multiple: true },
        { type: "css", selector: ".product-image-gallery img", attribute: "src", multiple: true },
    ],
    photo: [
        { type: 'className', selector: 'rilrtl-lazy-img', attribute: 'src' },
        { type: 'id', selector: 'selectedImage', attribute: 'src' },
        { type: 'className', selector: 'swatch-image-selected', attribute: 'src' },
        { type: 'xpath', selector: '//*[@class="swatch-image-selected"]', attribute: 'src' },
      ],
    offers: [
        {
            type: "css-offers",
            selector: ".pdp-promo-block, .promo-blck, .pdp-offers-offer, .pdp-offers-extraOffer",
            labelSelector: ".promo-title, .pdp-offers-offerTitle, .pdp-offers-offerLikeBestPrice b",
            contentSelector: ".promo-desc, .promo-desc-block, .pdp-offers-offerDesc, .pdp-offers-extraOfferDesc, .pdp-offers-labelMarkup",
            classifyType: true
        }
    ],
    description: [
        { type: "css", selector: ".prod-desc .prod-list" },
        { type: "css", selector: ".prod-desc .prod-list-item" }
    ],
    color: [
        { type: "css", selector: ".prod-color", validator: validateText },
    ],
    sizes: [
        { type: "css", selector: ".size-variant-block .circle.size-variant-item.size-instock span", multiple: true },
    ],
    specifications: [
        {
            type: "css-table",
            selector: ".pdpTabContainer .pdpTabSub",
            keySelector: ".tabName",
            valueSelector: ".detail-list",
        }
    ],
    promoInfo: [
        { type: "css", selector: ".promo-title-blck .promo-title" },
        { type: "css", selector: ".promo-desc-block .promo-desc" },
    ],
    reviewsCount: [
        { type: "css", selector: ".rating-popup .rating-label-star-count span._38RNg" },
        { type: "css", selector: "._3KsA3 ._3AxgC" },
    ],

    extraOffers: [
        { type: "css", selector: ".pdp-promo-block" },
        { type: "css", selector: ".promo-blck" },
    ],
    sizeFit: [
        { type: "css", selector: ".size-fit-guide" },
        { type: "css", selector: ".fit-guide" },
    ],
    materialCare: [
        { type: "css", selector: ".material-care" },
        { type: "css", selector: ".care-instructions" },
    ],
    seller: [
        { type: "css", selector: ".seller-info" },
        { type: "css", selector: ".brand-seller" },
    ],
    productCode: [
        { type: "css", selector: ".style-id" },
        { type: "css", selector: ".product-code" },
    ],
    timer: [
        { type: "css", selector: ".countdown-timer" },
        { type: "css", selector: ".deal-timer" },
    ],
    // Add more fields as needed
};
