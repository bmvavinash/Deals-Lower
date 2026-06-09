const { getStaticCategoryMapping } = require('./utils/staticCategoryMapping.js');

const p1 = { 
    title: 'Bajaj New Shakti Neo 15L Metal Body 4 Star Water Heater', 
    brand: 'Bajaj', 
    hierarchicalCategory: { mainCategory: 'Home & Kitchen', subcategory: 'Home Appliances' } 
};
console.log('p1 mapping:', getStaticCategoryMapping(p1));

const p2 = {
    title: 'Prestige Popular Aluminium Pressure Cooker, 3 Litres, Silver',
    brand: 'Prestige',
    hierarchicalCategory: { mainCategory: 'Home & Kitchen', subcategory: 'Kitchen' }
};
console.log('p2 mapping:', getStaticCategoryMapping(p2));

const p3 = {
    title: 'Samsung 198 L 4 Star Inverter Direct-Cool Single Door Refrigerator',
    brand: 'Samsung',
    hierarchicalCategory: { mainCategory: 'Electronics', subcategory: 'Refrigerators' }
};
console.log('p3 mapping:', getStaticCategoryMapping(p3));
