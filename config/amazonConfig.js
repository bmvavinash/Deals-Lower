const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
  brand: [
    { type: "id", selector: "bylineInfo", validator: validateText },
    { type: "css", selector: "#bylineInfo", validator: validateText },
    { type: "css", selector: ".contributorNameID", validator: validateText },
  ],
  title: [
    { type: "id", selector: "productTitle", validator: validateText },
    { type: "css", selector: "#productTitle", validator: validateText },
  ],
  productText: [
    { type: "id", selector: "productTitle" },
    { type: "xpath", selector: '//*[@id="productDescription"]/p' },
    // Add more xpaths as needed
  ],
  price: [
    {
      type: "css",
      selector: ".a-price.priceToPay",
      validator: validatePrice,
      attribute: "value",
    },
    {
      type: "id",
      selector: "priceValue",
      validator: validatePrice,
      attribute: "value",
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[1]/span[2]/span[2]',
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePrice_desktop"]/div/table/tbody/tr[1]/td[2]/span[1]/span[2]',
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePrice_desktop"]/div/table/tbody/tr[2]/td[2]/span[1]/span[2]',
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePrice_desktop"]/div/table/tbody/tr[2]/td[2]/span[1]/span[1]',
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        "/html/body/div[2]/div[3]/div[5]/div[4]/div[4]/div[10]/div/div[1]/div[2]/div/table/tbody/tr[2]/td[2]/span[1]/span[1]",
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[2]/span[2]/span[2]',
      validator: validatePrice,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[3]/span[2]/span[2]',
      validator: validatePrice,
    },
    { type: "className", selector: "a-price-whole", validator: validatePrice },
    { type: "id", selector: "price", validator: validatePrice },
    // Add more xpaths as needed
  ],
  discount: [
    {
      type: "css",
      selector:
        '.savingPriceOverride.savingsPercentage',
      validator: validateDiscount,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[1]',
      validator: validateDiscount,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[2]',
      validator: validateDiscount,
    },
    {
      type: "xpath",
      selector:
        "/html/body/div[2]/div[3]/div[5]/div[1]/div[1]/div[2]/div[2]/div/div/div[1]/div[3]/div[3]/div[1]/span[1]",
      validator: validateDiscount,
    },
    {
      type: "xpath",
      selector:
        '//*[@id="main"]/footer/div[1]/div/span[2]/div/div[2]/div[1]/div/div[1]',
      validator: validateDiscount,
    },
    // Add more xpaths as needed
  ],
  mrp: [
    {
      type: "css",
      selector: ".a-price.a-text-price[data-a-strike=\"true\"] .a-offscreen",
      attribute: "innerText",
      validator: validatePrice,
    },
    {
      type: "css",
      selector: ".a-text-price .a-offscreen",
      attribute: "innerText",
      validator: validatePrice,
    },
    // Add more selectors as needed
  ],
  rating: [
    { type: "css", selector: ".a-icon-alt" },
    { type: "css", selector: ".a-star-rating-text" },
    { type: "css", selector: ".a-icon-star-small" },
  ],
  ratingsCount: [
    { type: "css", selector: "#acrCustomerReviewText" },
    { type: "css", selector: ".a-size-base.s-underline-text" },
  ],
  reviewsCount: [
    { type: "css", selector: "#acrCustomerReviewText" },
    { type: "css", selector: ".a-size-base.s-underline-text" },
  ],
  color: [
    { type: "css", selector: "#variation_color_name .selection" },
    { type: "css", selector: ".imgSwatch[title]" },
  ],
  sizes: [
    { type: "css", selector: "#variation_size_name .selection", multiple: true },
    { type: "css", selector: ".a-button-text", multiple: true },
  ],
  sizeFit: [
    { type: "css", selector: "#feature-bullets li" },
    { type: "css", selector: ".a-expander-content" },
  ],
  materialCare: [
    { type: "css", selector: "#feature-bullets li" },
    { type: "css", selector: ".a-expander-content" },
  ],
  seller: [
    { type: "css", selector: "#merchant-info" },
    { type: "css", selector: ".tabular-buybox-text" },
  ],
  productCode: [
    { type: "css", selector: "#productDetails_detailBullets_sections1 tr" },
    { type: "css", selector: ".prodDetTable tr" },
  ],
  promoInfo: [
    { type: "css", selector: ".a-box-group .a-box" },
    { type: "css", selector: ".a-section.a-spacing-none" },
  ],
  photo: [
    { type: "id", selector: "landingImage", attribute: "src" },
    { type: "id", selector: "productImageUrl", attribute: "value" },
    // Add more xpaths as needed
  ],
  images: [
    {
      type: "css",
      selector: "#altImages img",
      attribute: "src",
      multiple: true
    }
  ],
  productTable: [
    {
      type: "css-table",
      selector: ".a-expander-content table tr",
      keySelector: "td.a-span3 .a-text-bold",
      valueSelector: "td.a-span9 .po-break-word"
    }
  ],
  description: [
    {
      type: "css-list",
      selector: "#feature-bullets ul.a-unordered-list.a-vertical.a-spacing-mini li .a-list-item"
    },
    {
      type: "css-list",
      selector: "#feature-bullets .a-list-item"
    }
  ],
  offers: [
    {
      type: "css-bankoffers",
      selector: ".offers-items",
      offerTypeSelector: "h6",
      offerContentSelectorFull: ".offers-items-content .a-truncate.a-size-base",
      offerContentSelectorCut: ".offers-items-content .a-truncate-cut",
      classifyEmi: true
    },
    {
      type: "css-bankoffers",
      selector: ".a-carousel-card .offers-items",
      offerTypeSelector: "h6",
      offerContentSelectorFull: ".offers-items-content .a-truncate.a-size-base",
      offerContentSelectorCut: ".offers-items-content .a-truncate-cut",
      classifyEmi: true
    },
    {
      type: "css-bankoffers",
      selector: ".a-section.a-spacing-none .a-size-base",
      offerTypeSelector: "h6",
      offerContentSelectorFull: ".a-section.a-spacing-none .a-size-base",
      offerContentSelectorCut: ".a-section.a-spacing-none .a-size-base",
      classifyEmi: false
    }
  ],
  asin: [
    {
      type: "xpath",
      selector:
        '//*[@id="productDetails_detailBullets_sections1"]/tbody/tr[1]/td',
    },
    // Add more xpaths as needed
  ],
  timer: [
    {
      type: "id",
      selector:
        'deals_countdown_timer_from_minutes_without_seconds_screen_reader_label', // Only Minutes ending
    },
    {
      type: "id",
      selector:
        'detailpage-dealBadge-countdown-timer', // Minutes and Seconds 
    },
    // Add more xpaths as needed
  ],
  category: {
    c1: [
      {
        type: "xpath",
        selector:
          '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li[1]/span/a',
      },
    ],
    c2: [
      {
        type: "xpath",
        selector:
          '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li[3]/span/a',
      },
    ],
    c3: [
      {
        type: "xpath",
        selector:
          '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li[5]/span/a',
      },
    ],
    c4: [
      {
        type: "xpath",
        selector:
          '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li[7]/span/a',
      },
    ],
    c5: [
      {
        type: "xpath",
        selector: '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li/span/a',
      },
    ],
    mainCategory: [{ type: "id", selector: "nav-search-label-id", validator: validateText }],

    // Add more xpaths as needed
  },
  coupon: [
    { type: 'css', selector: '.newCouponBadge' },
    { type: 'css', selector: '[id^="couponText"]' },
    { type: 'css', selector: '.couponLabelText' },
    // Add more selectors as needed
  ],
  // Placeholder for future attributes
  description: {
    d1: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[1]/span' }],
    d2: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[2]/span' }],
    d3: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[3]/span' }],
    d4: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[4]/span' }],
    d5: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[5]/span' }],
    d6: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[6]/span' }],
    d7: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[7]/span' }],
    d8: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[8]/span' }],
    d9: [{ type: "xpath", selector: '//*[@id="feature-bullets"]/ul/li[9]/span' }],
  },
};
