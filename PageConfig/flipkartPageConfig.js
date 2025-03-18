const { validatePrice, validateDiscount } = require("../utils/commonUtils");

module.exports = {
  searchPage: {
      baseSelector: null, // Not applicable for Flipkart as we use row/col XPath
      selectors: {
          productUrl: {
              type: 'xpath',
              selector: (row, col) => `//*[@id="container"]/div/div[3]/div/div[2]/div[${row}]/div/div[${col}]/div/a`,
          },
          productPrice: {
              type: 'xpath',
              selector: (row, col) => `//*[@id="container"]/div/div[3]/div/div[2]/div[${row}]/div/div[${col}]/div/div/a[2]/div/div[1]`,
              validate: validatePrice
          },
          discount: {
              type: 'xpath',
              selector: (row, col) => `//*[@id="container"]/div/div[3]/div/div[2]/div[${row}]/div/div[${col}]/div/div/a[2]/div[1]/div[3]/span`,
              validate: validateDiscount
          },
          originalPrice: {
              type: 'xpath',
              selector: (row, col) => `//*[@id="container"]/div/div[3]/div/div[2]/div[${row}]/div/div[${col}]/div/div/a[2]/div/div[2]`,
              validate: validatePrice
          },
          flipkartAssure: {
              type: 'xpath',
              selector: (row, col) => `//*[@id="container"]/div/div[3]/div/div[2]/div[${row}]/div/div[${col}]/div/div/div[2]/img`,
          },
      },
      rowColConfig: {
          startRow: 2,
          maxRows: 10,
          maxCols: 4,
      },
  },
};
