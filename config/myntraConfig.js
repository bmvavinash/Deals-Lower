const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
    productText: [
        { type: "id", selector: "pdp-title", validate: validateText },
        { type: "className", selector: "pdp-name", validate: validateText },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[2]/div[1]/h1', validate: validateText },
    ],
    price: [
        { type: "id", selector: "pdp-price", validate: validatePrice },
        { type: "className", selector: "pdp-price", validate: validatePrice },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/p/span/strong', validate: validatePrice },
    ],
    mrp: [
        { type: "id", selector: "pdp-mrp", validate: validatePrice },
        { type: "className", selector: "pdp-mrp-verbiage-amt", validate: validatePrice },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/p/div/div[2]/span', validate: validatePrice },
    ],
    discount: [
        { type: "id", selector: "pdp-discount", validate: validateDiscount },
        { type: "className", selector: "pdp-discount", validate: validateDiscount },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[2]/div[1]/p/span', validate: validateDiscount },
    ],
    ratings: [
        { type: "id", selector: "index-overallRating" },
        { type: "className", selector: "index-overallRating" },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/div/div[1]/div[1]/div' },
    ],
    photo: [
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
    description: {
        d1: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[1]' }],
        d2: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[2]' }],
        d3: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[3]' }],
        d4: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[4]' }],
        d5: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[5]' }],
        d6: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[6]' }],
        d7: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[7]' }],
        d8: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[8]' }],
        d9: [{ type: "xpath", selector: '//*[@class="pdp-product-description-content"]/text()[9]' }]
    }
    
};
