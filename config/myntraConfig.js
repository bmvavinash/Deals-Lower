const { validatePrice, validateDiscount, validateText } = require("../utils/commonUtils");

module.exports = {
    productText: [
        { type: "id", selector: "pdp-title", validator: validateText },
        { type: "className", selector: "pdp-name", validator: validateText },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[2]/div[1]/h1', validator: validateText },
    ],
    price: [
        { type: "id", selector: "pdp-price", validator: validatePrice },
        { type: "className", selector: "pdp-price", validator: validatePrice },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/p/span/strong', validator: validatePrice },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[2]/div[1]/div/p[1]/span/strong', validator: validatePrice },
    ],
    mrp: [
        { type: "id", selector: "pdp-mrp", validator: validatePrice },
        { type: "className", selector: "pdp-mrp-verbiage-amt", validator: validatePrice },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[1]/p/div/div[2]/span', validator: validatePrice },
    ],
    discount: [
        { type: "id", selector: "pdp-discount", validator: validateDiscount },
        { type: "className", selector: "pdp-discount", validator: validateDiscount },
        { type: "xpath", selector: '//*[@id="mountRoot"]/div/div[1]/main/div[2]/div[2]/div[1]/p/span', validator: validateDiscount },
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
