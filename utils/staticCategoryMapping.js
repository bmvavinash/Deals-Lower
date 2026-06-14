const HARDCODED_CATEGORIES = {
    'Electronics': [
        'Air Conditioners',
        'Geysers',
        'Air Coolers',
        'Refrigerators',
        'Washing Machines',
        'Mobiles',
        'Laptops',
        'Audio',
        'Wearables',
        'Televisions',
        'Cameras',
        'Monitors',
        'Others'
    ],
    'Fashion': [
        'Dresses',
        'Kurtas',
        'T-Shirts',
        'Shirts',
        'Jeans',
        'Pants',
        'Shoes',
        'Sandals',
        'Accessories',
        'Innerwear'
        ,'Others'
    ],
    'Home & Kitchen': [
        'Kitchen Appliances',
        'Cookware',
        'Furniture',
        'Home Decor'
        ,'Others'
    ],
    'Beauty & Personal Care': [
        'Skincare',
        'Haircare',
        'Makeup',
        'Fragrances',
        'Bath & Body'
        ,'Others'
    ],
    'Books & Stationery': [
        'Fiction',
        'Non-Fiction',
        'Academic',
        'Stationery'
        ,'Others'
    ],
    'Sports & Fitness': [
        'Equipment',
        'Clothing',
        'Footwear',
        'Accessories'
        ,'Others'
    ],
    'Baby & Kids': [
        'Toys',
        'Clothing',
        'Footwear',
        'Baby Care'
        ,'Others'
    ]
};

// Map keywords to static categories
const KEYWORD_MAP = {
    // Electronics
    'ac': 'Air Conditioners', 'air conditioner': 'Air Conditioners', 'split ac': 'Air Conditioners', 'window ac': 'Air Conditioners',
    'geyser': 'Geysers', 'water heater': 'Geysers',
    'cooler': 'Air Coolers', 'air cooler': 'Air Coolers',
    'fridge': 'Refrigerators', 'refrigerator': 'Refrigerators',
    'washing machine': 'Washing Machines', 'washer': 'Washing Machines',
    'mobile': 'Mobiles', 'smartphone': 'Mobiles', 'phone': 'Mobiles', 'iphone': 'Mobiles',
    'laptop': 'Laptops', 'macbook': 'Laptops', 'notebook': 'Laptops', 'monitor': 'Monitors', 'desktop': 'Laptops', 'tablet': 'Laptops', 'ipad': 'Laptops', 'tab': 'Laptops',
    'tv': 'Televisions', 'television': 'Televisions', 'smart tv': 'Televisions', 'qled': 'Televisions', 'oled': 'Televisions',
    'headphone': 'Audio', 'earphone': 'Audio', 'speaker': 'Audio', 'soundbar': 'Audio', 'earbuds': 'Audio', 'earbud': 'Audio', 'earpod': 'Audio', 'airpod': 'Audio', 'tws': 'Audio', 'neckband': 'Audio', 'buds': 'Audio',
    'watch': 'Wearables', 'smartwatch': 'Wearables', 'fitness band': 'Wearables',
    'camera': 'Cameras', 'dslr': 'Cameras',

    // Fashion
    'shoe': 'Shoes', 'sneaker': 'Shoes', 'boot': 'Shoes', 'loafer': 'Shoes',
    'sandal': 'Sandals', 'flip flop': 'Sandals', 'slipper': 'Sandals',
    'dress': 'Dresses', 'gown': 'Dresses',
    'kurta': 'Kurtas', 'kurti': 'Kurtas',
    't-shirt': 'T-Shirts', 'tshirt': 'T-Shirts', 'polo': 'T-Shirts',
    'shirt': 'Shirts',
    'jean': 'Jeans', 'denim': 'Jeans',
    'pant': 'Pants', 'trouser': 'Pants', 'track pant': 'Pants',
    'sandal': 'Sandals', 'flip flop': 'Sandals', 'slipper': 'Sandals',
    'accessory': 'Accessories', 'belt': 'Accessories', 'wallet': 'Accessories', 'sunglass': 'Accessories', 'backpack': 'Accessories', 'bag': 'Accessories', 'luggage': 'Accessories',
    'bra': 'Innerwear', 'panty': 'Innerwear', 'underwear': 'Innerwear', 'brief': 'Innerwear', 'boxer': 'Innerwear',

    // Home & Kitchen
    'mixer': 'Kitchen Appliances', 'grinder': 'Kitchen Appliances', 'blender': 'Kitchen Appliances', 'microwave': 'Kitchen Appliances', 'oven': 'Kitchen Appliances', 'toaster': 'Kitchen Appliances', 'kettle': 'Kitchen Appliances', 'chimney': 'Kitchen Appliances', 'water purifier': 'Kitchen Appliances', 'cleaner': 'Kitchen Appliances', 'sweeper': 'Kitchen Appliances', 'mop': 'Kitchen Appliances', 'robot': 'Kitchen Appliances',
    'cookware': 'Cookware', 'pan': 'Cookware', 'pot': 'Cookware', 'kadai': 'Cookware', 'tawa': 'Cookware', 'pressure cooker': 'Cookware', 'utensil': 'Cookware',
    'sofa': 'Furniture', 'bed': 'Furniture', 'chair': 'Furniture', 'table': 'Furniture', 'wardrobe': 'Furniture', 'desk': 'Furniture',
    'decor': 'Home Decor', 'lamp': 'Home Decor', 'clock': 'Home Decor', 'vase': 'Home Decor', 'painting': 'Home Decor',

    // Beauty
    'cream': 'Skincare', 'lotion': 'Skincare', 'serum': 'Skincare', 'moisturizer': 'Skincare', 'face wash': 'Skincare',
    'shampoo': 'Haircare', 'conditioner': 'Haircare', 'hair oil': 'Haircare', 'hair color': 'Haircare',
    'lipstick': 'Makeup', 'foundation': 'Makeup', 'mascara': 'Makeup', 'kajal': 'Makeup', 'eyeliner': 'Makeup',
    'perfume': 'Fragrances', 'deo': 'Fragrances', 'body wash': 'Bath & Body', 'soap': 'Bath & Body',

    // Books
    'fiction': 'Fiction', 'novel': 'Fiction', 'story': 'Fiction',
    'non-fiction': 'Non-Fiction', 'biography': 'Non-Fiction',
    'academic': 'Academic', 'textbook': 'Academic', 'exam': 'Academic',
    'pen': 'Stationery', 'notebook': 'Stationery', 'diary': 'Stationery', 'pencil': 'Stationery',

    // Sports
    'dumbbell': 'Equipment', 'treadmill': 'Equipment', 'bat': 'Equipment', 'racket': 'Equipment',
    'tracksuit': 'Clothing', 'jersey': 'Clothing', 'sports bra': 'Clothing',
    'sports shoe': 'Footwear', 'cleats': 'Footwear',
    'gym bag': 'Accessories', 'sipper': 'Accessories', 'bottle': 'Accessories',

    // Baby & Kids
    'toy': 'Toys', 'game': 'Toys', 'puzzle': 'Toys', 'doll': 'Toys',
    'diaper': 'Baby Care', 'wipes': 'Baby Care', 'stroller': 'Baby Care', 'lotion': 'Baby Care', 'powder': 'Baby Care',
    'romper': 'Clothing', 'onesie': 'Clothing'
};

/**
 * Maps dynamic product data to a strict static category hierarchy
 */
function getStaticCategoryMapping(product) {
    const title = (product.title || product.name || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    const hCategory = product.hierarchicalCategory || {};
    const sub = (hCategory.subcategory || '').toLowerCase();
    const main = (hCategory.mainCategory || '').toLowerCase();
    const cats = (product.categoryPath || []).map(c => (c || '').toLowerCase());
    const urltext = (product.urltext || '').toLowerCase();
    const pUrl = (product.productUrl || '').split('?')[0].replace(/-/g, ' ').toLowerCase();
    
    let textToAnalyze = `${title} ${brand} ${sub} ${main} ${cats.join(' ')} ${urltext} ${pUrl} `;

    let matchedSubcategory = null;
    let matchedMainCategory = null;

    // 1. Search for keywords in the analyzed text
    // Additionally match 'vacuum cleaner' specifically so it goes to Home Appliances if we want, or default
    if (textToAnalyze.includes('vacuum cleaner') || textToAnalyze.includes('vacuum')) {
        matchedSubcategory = 'Kitchen Appliances'; // Or 'Furniture', but better generic
        matchedMainCategory = 'Home & Kitchen';
    } else {
        for (const [keyword, staticSub] of Object.entries(KEYWORD_MAP)) {
            // Use regex for exact word boundary match to prevent "vac" matching "ac", support plurals
            // Escape special chars in keyword if any (though ours are mostly alphanumeric)
            const regex = new RegExp(`\\b${keyword}(?:s|es)?\\b`, 'i');
            if (regex.test(textToAnalyze)) {
                matchedSubcategory = staticSub;
                break;
            }
        }
    }

    // 2. If no keyword matched, try exact or partial match on category names
    if (!matchedSubcategory) {
        for (const [mainCat, subCats] of Object.entries(HARDCODED_CATEGORIES)) {
            for (const subCat of subCats) {
                if (textToAnalyze.includes(subCat.toLowerCase())) {
                    matchedSubcategory = subCat;
                    matchedMainCategory = mainCat;
                    break;
                }
            }
            if (matchedSubcategory) break;
        }
    }

    // 3. Find the Main Category for the matched Subcategory
    if (matchedSubcategory && !matchedMainCategory) {
        for (const [mainCat, subCats] of Object.entries(HARDCODED_CATEGORIES)) {
            if (subCats.includes(matchedSubcategory)) {
                matchedMainCategory = mainCat;
                break;
            }
        }
    }

    // 4. Fallback if completely unmatched
    if (!matchedMainCategory || !matchedSubcategory) {
        // Try mapping the dynamic mainCategory directly
        if (main.includes('electronic')) matchedMainCategory = 'Electronics';
        else if (main.includes('fashion') || main.includes('clothing') || main.includes('shoe')) matchedMainCategory = 'Fashion';
        else if (main.includes('home') || main.includes('kitchen')) matchedMainCategory = 'Home & Kitchen';
        else if (main.includes('beauty')) matchedMainCategory = 'Beauty & Personal Care';
        else if (main.includes('book')) matchedMainCategory = 'Books & Stationery';
        else if (main.includes('sport')) matchedMainCategory = 'Sports & Fitness';
        else matchedMainCategory = 'Electronics'; // Default fallback

        // Pick a default subcategory for the main category
        matchedSubcategory = 'Others'; 
    }

    // Also define staticStyle (could just be brand, or left empty if not needed, we'll use brand for style if none is apparent)
    let staticStyle = '';
    if (hCategory.style) staticStyle = hCategory.style;
    else if (product.brand) staticStyle = product.brand;

    // Extract type and capacity for Geysers
    let extractedType = '';
    let extractedCapacity = '';
    if (matchedSubcategory === 'Geysers') {
        if (textToAnalyze.includes('storage')) extractedType = 'Storage';
        else if (textToAnalyze.includes('instant')) extractedType = 'Instant';

        // Match patterns like "15 L", "15L", "15 Litre", "15Litre", "25 L", etc.
        const capacityMatch = textToAnalyze.match(/(\d+(?:\.\d+)?)\s*(?:l|litre|litres|liter|liters)\b/i);
        if (capacityMatch) {
            extractedCapacity = capacityMatch[1] + 'L';
        }
    }

    return {
        staticCategory: matchedMainCategory,
        staticSubcategory: matchedSubcategory,
        staticStyle: staticStyle,
        type: extractedType,
        capacity: extractedCapacity
    };
}

module.exports = {
    HARDCODED_CATEGORIES,
    KEYWORD_MAP,
    getStaticCategoryMapping
};
