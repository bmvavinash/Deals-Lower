const { validatePrice, validateDiscount, validateText, validateMRP, validateRatingsCount, validateBrand } = require("../utils/commonUtils");

module.exports = {
    brand: [
        { type: "css", selector: ".pdp-title", validator: validateBrand },
    ],
    title: [
        { type: "css", selector: ".pdp-name", validator: validateText },
    ],
    productText: [
        { type: "css", selector: ".pdp-title", validator: validateText },
        { type: "css", selector: ".pdp-name", validator: validateText },
    ],
    price: [
        { type: "css", selector: ".pdp-price strong", validator: validatePrice },
    ],
    mrp: [
        { type: "css", selector: ".pdp-mrp-verbiage .pdp-mrp-verbiage-amt", validator: validateMRP },
        { type: "css", selector: ".pdp-mrp s", validator: validateMRP },
    ],
    discount: [
        { type: "css", selector: ".pdp-discount", validator: validateDiscount },
        { type: "css", selector: ".pdp-mrp-verbiage .pdp-mrp-verbiage-amt", validator: validateDiscount },
    ],
    rating: [
        { type: "css", selector: ".index-overallRatingContainer .index-overallRating > div:first-child" },
        { type: "css", selector: ".index-overallRating > div:first-child" },
    ],
    ratingsCount: [
        { type: "css", selector: ".index-overallRatingContainer .index-ratingsCount", validator: validateRatingsCount },
        { type: "css", selector: ".index-ratingsCount", validator: validateRatingsCount },
    ],
    images: [
        {
            type: "css-background-image",
            selector: ".image-grid-image",
            attribute: "style",
            multiple: true
        }
    ],
    offers: [
        // Best Offer block
        {
            type: "css-offers",
            selector: ".pdp-offers-offer", // the whole offer block
            labelSelector: ".pdp-offers-offerTitle b",
            contentSelector: ".pdp-offers-offerDesc .pdp-offers-labelMarkup",
            couponSelector: ".pdp-offers-boldText",
            classifyType: true
        },
        // Extra Offers block
        {
            type: "css-offers",
            selector: ".pdp-offers-offerLikeBestPrice", // each extra offer block
            labelSelector: ".pdp-offers-offerTitle b",
            contentSelector: ".pdp-offers-offerDesc .pdp-offers-labelMarkup",
            classifyType: true
        }
    ],
    
    category: {
        c1: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[1]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
        c2: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[2]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
        c3: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[3]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
        c4: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[4]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
        c5: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[5]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
        c6: [
            { type: "id", selector: "breadcrumbs-link" },
            { type: "xpath", selector: '//*[@class="breadcrumbs-container"]/a[6]' },
            { type: "className", selector: "breadcrumbs-link" },
        ],
    },
    description: [
        { type: "css", selector: ".pdp-product-description-content" },
        { type: "css", selector: ".product-description" }
    ],
    photo: [
        { type: "css", selector: "img.image-grid-image", attribute: "src" },
        { type: "css", selector: ".image-grid-imageContainer img", attribute: "src" },
        { type: "css", selector: ".image-grid-col img", attribute: "src" },
        { type: "css", selector: ".image-grid-image", attribute: "style" },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/div[1]/div/div[1]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][1]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][2]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][3]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][4]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][5]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][6]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][7]', attribute: "style" },
        { type: "xpath", selector: '//*[@class="image-grid-image"][8]', attribute: "style" }
    ],
    sizeFit: [
        { type: "css", selector: ".pdp-sizeFitDescContent" },
    ],
    materialCare: [
        { type: "css", selector: ".pdp-sizeFitDescContent" },
    ],
    specifications: [
        {
            type: "css-table",
            selector: ".index-tableContainer .index-row",
            keySelector: ".index-rowKey",
            valueSelector: ".index-rowValue",
        }
    ],
    productCode: [
        { type: "css", selector: ".supplier-styleId" },
    ],
    seller: [
        { type: "css", selector: ".supplier-productSellerName" },
    ],
    reviewsCount: [
        { type: "css", selector: ".index-overallRatingContainer .index-ratingsCount" },
    ],
    color: [
        { type: "css", selector: ".pdp-colorInfo" },
        { type: "css", selector: ".pdp-colorName" },
    ],
    stockStatus: [
        { type: "css", selector: ".size-buttons-out-of-stock" },
        { type: "css", selector: ".pdp-add-to-bag.pdp-out-of-stock" },
        { type: "css", selector: ".pdp-action-container .pdp-out-of-stock" },
    ],
    sizes: [
        { type: "css", selector: ".size-buttons-size-button", multiple: true },
        { type: "css", selector: ".size-variant-item", multiple: true },
    ],
    extraOffers: [
        { type: "css", selector: ".pdp-offers-extraOffer" },
    ],
    coupon: [
        { type: "css", selector: ".coupon-badge" },
        { type: "css", selector: ".pdp-offers-boldText" },
    ],
    timer: [
        { type: "css", selector: ".countdown-timer" },
        { type: "css", selector: ".deal-timer" },
    ],
    // category and description configs can be added as needed
};
