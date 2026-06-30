const { getStaticCategoryMapping } = require('./utils/staticCategoryMapping.js');
console.log(getStaticCategoryMapping({
    title: 'Watches',
    brand: '',
    categoryPath: [],
    hierarchicalCategory: {}
}));
console.log(getStaticCategoryMapping({
    title: 'Apple 2024 iPad Pro',
    brand: 'Apple',
    categoryPath: [],
    hierarchicalCategory: {}
}));
console.log(getStaticCategoryMapping({
    title: 'Unisex Graphic Backpack',
    brand: '',
    categoryPath: [],
    hierarchicalCategory: {}
}));
