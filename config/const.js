const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require("../utils/commonUtils");

// constants.js
const PRODUCT_STATUS = {
    PRODUCT_ALREADY_EXISTS: 'Product Already Exists',
    PRODUCT_POSTED_TODAY: 'Product Posted Today',
    PRODUCT_UPDATED_TODAY: 'Today"s Product updated successfully ',
    PRODUCT_UPDATED_SUCCESSFULLY: 'Product updated successfully',
    PRODUCT_CREATED: 'New Product Created',
    PRODUCT_ERROR: 'Invalid Product Details',
    PRODUCT_EXCLUDED: 'Product Excluded from Associates Program',
};

const SEARCH_STATUS = {
    SEARCH_ALREADY_EXISTS: 'Search Already Exists',
    SEARCH_POSTED_TODAY: 'Search Posted Today',
    SEARCH_UPDATED_TODAY: 'Today"s Search updated successfully ',
    SEARCH_UPDATED_SUCCESSFULLY: 'Search updated successfully',
    SEARCH_CREATED: 'New Search Created',
    SEARCH_NOT_APPLICABLE: 'Other User Search Details',
    SEARCH_ERROR: 'Invalid Search Details',
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
    searchStatus: SEARCH_STATUS,
    ASIN_LENGTH,
    storeMap
};

// Other constants can be added as needed
