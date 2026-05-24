const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
  title: [
    { type: 'css', selector: 'h1._6EBuvT .VU-ZEz', validator: validateText },
    { type: 'css', selector: 'h1._6EBuvT', validator: validateText },
    { type: 'css', selector: 'h1', validator: validateText }, // Added fallback for new UI
  ],
  brand: [
    { type: 'css', selector: 'h1._6EBuvT .mEh187', validator: validateText },
    { type: 'css', selector: 'h1', validator: validateText }, // Added fallback for new UI
  ],
  productText: [
    { type: 'css', selector: 'h1._6EBuvT .VU-ZEz', validator: validateText },
    { type: 'css', selector: 'h1._6EBuvT', validator: validateText },
    { type: 'css', selector: 'h1', validator: validateText }, // Added fallback for new UI
  ],
  price: [
    { type: 'css', selector: '.hl05eU .Nx9bqj.CxhGGd', validator: validatePrice },
    { type: 'css', selector: '.Nx9bqj.CxhGGd', validator: validatePrice },
    { type: 'css', selector: '.Nx9bqj', validator: validatePrice },
    { type: 'xpath', selector: '(//div[contains(text(), "₹") and string-length(text()) < 15])[1]', validator: validatePrice },
  ],
  mrp: [
    { type: 'css', selector: '.hl05eU .yRaY8j.A6+E6v', validator: validatePrice },
    { type: 'css', selector: '.yRaY8j', validator: validatePrice },
    { type: 'xpath', selector: '(//*[contains(@style, "line-through")])[1]', validator: validatePrice },
  ],
  discount: [
    { type: 'css', selector: '.hl05eU .UkUFwK.WW8yVX span', validator: validateDiscount },
    { type: 'css', selector: '.UkUFwK.WW8yVX span', validator: validateDiscount },
    { type: 'css', selector: '.UkUFwK span', validator: validateDiscount },
    { type: 'css', selector: '.WW8yVX span', validator: validateDiscount },
    { type: 'css', selector: '[class*="UkUFwK"] span', validator: validateDiscount },
    { type: 'css', selector: '[class*="WW8yVX"] span', validator: validateDiscount },
    { type: 'css', selector: '.hl05eU span:contains("%")', validator: validateDiscount },
    { type: 'xpath', selector: '(//div[(contains(text(), "% off") or contains(text(), "% Off")) and string-length(text()) < 15])[1]', validator: validateDiscount },
  ],
  image: [
    { type: 'css', selector: '.C7fEHH img', attribute: 'src' },
    { type: 'xpath', selector: '(//img[contains(@src, "rukminim2.flixcart.com/image")])[1]', attribute: 'src' },
  ],
  images: [
    { type: 'css', selector: 'ul.ZqtVYK img._0DkuPH', attribute: 'src', multiple: true },
    { type: 'css', selector: '.C7fEHH img', attribute: 'src', multiple: true },
  ],
  rating: [
    { type: 'css', selector: '.XQDdHH' },
  ],
  ratingsCount: [
    { type: 'css', selector: '.Wphh3N span' },
  ],
  reviewsCount: [
    { type: 'css', selector: '.Wphh3N span' },
  ],
  color: [
    { type: 'css', selector: '._3Oikkn._3_ezix._2KarxS._31hAvz' },
    { type: 'css', selector: '.imgSwatch[title]' },
  ],
  sizes: [
    { type: 'css', selector: '._3Oikkn._3_ezix._2KarxS._31hAvz', multiple: true },
    { type: 'css', selector: '.size-buttons-size-button', multiple: true },
  ],
  flipkartAssure: [
    { type: 'css', selector: '.LctmNn', attribute: 'src' },
  ],
  extraOffers: [
    { type: 'css', selector: '._2lX4N0 span' },
  ],
  offers: [
    {
      type: 'css-offers',
      selector: 'li.kF1Ml8.col',
      labelSelector: 'span.ynXjOy',
      contentSelector: 'span',
      classifyType: true
    }
  ],
  description: [
    { type: 'css', selector: '.pdp-product-description-content' },
    { type: 'css', selector: '.product-detail .product-description' }
  ],
  photo: [
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/div/img', attribute: 'src' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/img', attribute: 'src' },
      { type: 'xpath', selector: '(//img[contains(@src, "rukminim2.flixcart.com/image")])[1]', attribute: 'src' },
  ],
  sizeFit: [
    { type: 'css', selector: '.pdp-sizeFitDescContent' },
  ],
  materialCare: [
    { type: 'css', selector: '.pdp-sizeFitDescContent' },
  ],
  category: [
      { type: 'xpath', selector: '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li/span/a' },
  ],
  specifications: [
    {
      type: 'css-table',
      selector: '.index-tableContainer .index-row',
      keySelector: '.index-rowKey',
      valueSelector: '.index-rowValue',
    }
  ],
  productCode: [
    { type: 'css', selector: '.supplier-styleId' },
  ],
  seller: [
    { type: 'css', selector: '.supplier-productSellerName' },
  ],
  promoInfo: [
    { type: 'css', selector: '._2lX4N0' },
    { type: 'css', selector: '.promo-badge' },
  ],
  coupon: [
    { type: 'css', selector: '.coupon-badge' },
    { type: 'css', selector: '.coupon-text' },
  ],
  timer: [
    { type: 'css', selector: '.mSzn2o .E2lCdq span:not(.DWia7o)' }, 
  ],
};
