const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  productText: [
    { type: 'id', selector: 'productTitle', attribute: 'aria-label' },
    { type: 'className', selector: 'prod-name', attribute: 'aria-label' },
    { type: 'xpath', selector: '//*[@class="prod-name"]', attribute: 'aria-label' },
  ],
  brand: [
    { type: 'id', selector: 'brandTitle', attribute: 'aria-label' },
    { type: 'className', selector: 'brand-name', attribute: 'aria-label' },
    { type: 'xpath', selector: '//*[@class="brand-name"]', attribute: 'aria-label' },
  ],
  ratings: [
    { type: 'className', selector: 'rating-popup _3c5q0', attribute: 'textContent' },
    { type: 'xpath', selector: '//*[@class="rating-popup"]//*[@class="_3c5q0"]', attribute: 'textContent' },
  ],
  price: [
    { type: 'id', selector: 'specialPrice', validator: validatePrice },
    { type: 'className', selector: 'prod-sp', validator: validatePrice },
    { type: 'xpath', selector: '//*[@class="prod-sp"]', validator: validatePrice },
  ],
  mrp: [
    { type: 'id', selector: 'originalPrice', validator: validatePrice },
    { type: 'className', selector: 'prod-cp', validator: validatePrice },
    { type: 'xpath', selector: '//*[@class="prod-cp"]', validator: validatePrice },
  ],
  discount: [
    { type: 'id', selector: 'discountPercent', validator: validateDiscount },
    { type: 'className', selector: 'prod-discnt', validator: validateDiscount },
    { type: 'xpath', selector: '//*[@class="prod-discnt"]', validator: validateDiscount },
  ],
  coupon: [
    { type: 'id', selector: 'couponBlock', attribute: 'aria-label' },
    { type: 'className', selector: 'pdp-promo-block promo-desc', attribute: 'aria-label' },
    { type: 'xpath', selector: '//*[@class="pdp-promo-block"]//*[@class="promo-desc"]', attribute: 'aria-label' },
  ],
  photo: [
    { type: 'id', selector: 'selectedImage', attribute: 'src' },
    { type: 'className', selector: 'swatch-image-selected', attribute: 'src' },
    { type: 'xpath', selector: '//*[@class="swatch-image-selected"]', attribute: 'src' },
  ],

  description: {
    d1: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(1)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[1]' }
    ],
    d2: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(2)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[2]' }
    ],
    d3: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(3)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[3]' }
    ],
    d4: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(4)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[4]' }
    ],
    d5: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(5)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[5]' }
    ],
    d6: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(6)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[6]' }
    ],
    d7: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(7)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[7]' }
    ],
    d8: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(8)' },
        { type: "xpath", selector: '//*[@class="prod-list"]/li[8]' }
    ],
    d9: [
        { type: "className", selector: '.prod-list .detail-list:nth-child(9) span' },  // Product Code
        { type: "xpath", selector: '//*[@class="prod-list"]/li[9]/span' }
    ],
    d10: [
        { type: "className", selector: '.prod-list .mandatory-list:nth-child(10) .title' }, // MRP
        { type: "xpath", selector: '//*[@class="prod-list"]/li[10]//div[@class="title"]' }
    ]
},

category: {
    c1: [
      {
        type: "xpath",
        selector: '//ul[@class="breadcrumb-sec"]/li[1]/a',
      },
    ],
    c2: [
      {
        type: "xpath",
        selector: '//ul[@class="breadcrumb-sec"]/li[2]/a',
      },
    ],
    c3: [
      {
        type: "xpath",
        selector: '//ul[@class="breadcrumb-sec"]/li[3]/a',
      },
    ],
    c4: [
      {
        type: "xpath",
        selector: '//ul[@class="breadcrumb-sec"]/li[4]/a',
      },
    ],
    c5: [
      {
        type: "xpath",
        selector: '//ul[@class="breadcrumb-sec"]/li[5]/a',
      },
    ],
  }
  


  // Additional fields and selectors can be added here
};
