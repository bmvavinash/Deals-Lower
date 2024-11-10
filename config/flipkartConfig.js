const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  price: [
    { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[2]/div[1]/div/div[1]', validator: validatePrice },
    { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[3]/div[1]/div/div[1]', validator: validatePrice },
    { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[3]/div/div[2]/div[1]/div/div[1]', validator: validatePrice },
    { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[3]/div/div[3]/div[1]/div/div[1]', validator: validatePrice },
    { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[4]/div[1]/div/div[1]', validator: validatePrice },
    
      // Add more xpaths as needed
  ],
  discount: [
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[5]/div[1]/div/div[3]/span', validator: validateDiscount },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[2]/div[1]/div/div[3]/span', validator: validateDiscount },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[3]/div[1]/div/div[3]/span', validator: validateDiscount },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[3]/div/div[2]/div[1]/div/div[3]/span', validator: validateDiscount },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[3]/div/div[3]/div[1]/div/div[3]/span', validator: validateDiscount },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[4]/div[1]/div/div[3]/span', validator: validateDiscount },
      // Add more xpaths as needed
  ],
  photo: [
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/div/img', attribute: 'src' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/img', attribute: 'src' },
      // Add more xpaths as needed
  ],
//   asin: [
//       { type: 'xpath', selector: '//*[@id="productDetails_detailBullets_sections1"]/tbody/tr[1]/td' },
//       // Add more xpaths as needed
//   ],
  productText: [
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[3]/div/div[1]/h1/span[2]' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[2]/div/div[1]/h1/span' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[1]/div/div/div[1]/div[5]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[1]/div/div/div[1]/div[4]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[1]/div/div/div[1]/div[3]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[2]/div[1]/div/div/div[1]/div[2]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div/div[2]/div[1]/div/div/div[1]/div[6]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div/div[2]/div[1]/div/div/div[1]/div[5]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div/div[2]/div[1]/div/div/div[1]/div[4]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div/div[2]/div[1]/div/div/div[1]/div[3]/a' },
      { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div/div[2]/div[1]/div/div/div[1]/div[2]/a' },
      // Add more xpaths as needed
  ],
  category: [
      { type: 'xpath', selector: '//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li/span/a' },
      // Add more xpaths as needed
  ],
  // Placeholder for future attributes
  // brand: [
  //     // Add xpaths for brand as needed
  // ],
  // Add more attributes here
};
