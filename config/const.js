const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require("../utils/commonUtils");

// constants.js
const PRODUCT_STATUS = {
    PRODUCT_ALREADY_EXISTS: 'Product Already Exists',
    PRODUCT_POSTED_TODAY: 'Product Posted Today',
    PRODUCT_UPDATED_SUCCESSFULLY: 'Product updated successfully',
    PRODUCT_CREATED: 'New Product Created',
    PRODUCT_ERROR: 'Invalid Product Details',
};

const storeMap = {
    amazon: { getCode: getAsin, storeType: "Amazon" },
    flipkart: { getCode: getFlipkartProductId, storeType: "Flipkart" },
    ajio: { getCode: getAjioCode, storeType: "Ajio" },
    myntra: { getCode: getMyntraCode, storeType: "Myntra" }
};


const ASIN_LENGTH = 10;
module.exports = {
    productStatus: PRODUCT_STATUS,
    ASIN_LENGTH,
    storeMap
};

// Other constants can be added as needed
