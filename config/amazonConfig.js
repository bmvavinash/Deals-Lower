const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
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
  photo: [
    { type: "id", selector: "landingImage", attribute: "src" },
    { type: "id", selector: "productImageUrl", attribute: "value" },
    // Add more xpaths as needed
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
  productText: [
    { type: "id", selector: "productTitle" },
    { type: "xpath", selector: '//*[@id="productDescription"]/p' },
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
