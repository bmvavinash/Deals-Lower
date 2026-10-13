/**
 * Banner Categorizer
 * Automatically classifies promotional banners into canonical ecommerce categories and subcategories
 * based on clickRedirectUrl, title, description, and imageUrl.
 */

const CATEGORY_TAXONOMY = {
    'garden': {
        label: 'Garden',
        subcategories: [
            { name: 'Others', patterns: [/\b(?:garden|gardening|lawn|lawn-and-gardening|plants|planters)\b/i] }
        ]
    },
    'fashion': {
        label: 'Fashion',
        subcategories: [
            { name: 'Shoes', patterns: [/\b(?:shoes|footwear|sneaker|sneakers|sandals|boots|slippers|mens-footwear|womens-footwear|campus|puma|adidas|reebok|nike|woodland|bata)\b/i] },
            { name: 'Accessories', patterns: [/\b(?:bag|bags|luggage|wallet|wallets|belt|belts|backpack|suitcase|safari|trolley|duffle|bags-wallets-belts)\b/i] },
            { name: 'Kurtas', patterns: [/\b(?:kurta|kurtas|kurti|ethnic|saree|sarees|lehenga)\b/i] },
            { name: 'Dresses', patterns: [/\b(?:dress|dresses|gown|frock)\b/i] },
            { name: 'T-Shirts', patterns: [/\b(?:t-shirt|t-shirts|tshirt|tshirts|tee)\b/i] },
            { name: 'Shirts', patterns: [/\b(?:shirt|shirts|formal shirt|casual shirt)\b/i] },
            { name: 'Jeans', patterns: [/\b(?:jeans|denim)\b/i] },
            { name: 'Pants', patterns: [/\b(?:pants|trousers|joggers|shorts)\b/i] },
            { name: 'Innerwear', patterns: [/\b(?:innerwear|lingerie|briefs|boxers)\b/i] },
            { name: 'Others', patterns: [/\b(?:fashion|clothing|apparel|wear)\b/i] }
        ]
    },
    'beauty-personal-care': {
        label: 'Beauty & Personal Care',
        subcategories: [
            { name: 'Skincare', patterns: [/\b(?:skincare|skin|face wash|serum|moisturizer|sunscreen|derma|derma co|lotion|face cream|holi ready skin|cleanser|toner)\b/i] },
            { name: 'Bath & Body', patterns: [/\b(?:bath|body|bathing bar|soap|body wash|shower gel|fiama|toothbrush|toothbrushes|toothpaste|electric toothbrush|trimmer|shaver|grooming)\b/i] },
            { name: 'Haircare', patterns: [/\b(?:haircare|hair|shampoo|conditioner|hair oil|hair dryer|straightener)\b/i] },
            { name: 'Makeup', patterns: [/\b(?:makeup|lipstick|kajal|foundation|mascara|beauty sale)\b/i] },
            { name: 'Fragrances', patterns: [/\b(?:perfume|deodorant|fragrance|cologne|body mist)\b/i] },
            { name: 'Others', patterns: [/\b(?:beauty|cosmetics|beauty-and-grooming)\b/i] }
        ]
    },
    'home-kitchen': {
        label: 'Home & Kitchen',
        subcategories: [
            { name: 'Cookware', patterns: [/\b(?:cookware|pot|pan|cup|cups|mug|mugs|opalware|crockery|borosil|larah|dinnerware|cutlery|pressure cooker)\b/i] },
            { name: 'Furniture', patterns: [/\b(?:furniture|sofa|bed|table|chair|step-ladder|step-ladders|step ladders|ladder|storage and organization|home storage)\b/i] },
            { name: 'Kitchen Appliances', patterns: [/\b(?:mixer|grinder|blender|toaster|kettle|air fryer|cooktop)\b/i] },
            { name: 'Home Decor', patterns: [/\b(?:decor|curtain|curtains|cushion|clock|carpet|bedsheet|towel|home-improvement|cleaning essentials)\b/i] },
            { name: 'Others', patterns: [/\b(?:home|kitchen)\b/i] }
        ]
    },
    'electronics': {
        label: 'Electronics',
        subcategories: [
            { name: 'Mobiles', patterns: [/\b(?:mobile|smartphone|phone|5g|4g|iphone|vivo|oppo|xiaomi|redmi|realme|oneplus|iqoo|pixel|motorola|mivi|samsung galaxy|nothing phone|nova 2 pro)\b/i] },
            { name: 'Laptops', patterns: [/\b(?:laptop|notebook|macbook|thinkpad|chromebook|gaming laptop)\b/i] },
            { name: 'Audio', patterns: [/\b(?:audio|soundbar|soundbars|earbuds|headphone|headphones|earphone|speaker|speakers|tws|airpods|neckband|zebronics|boat)\b/i] },
            { name: 'Wearables', patterns: [/\b(?:smartwatch|smart watch|fitness band|fitness tracker|wearable)\b/i] },
            { name: 'Televisions', patterns: [/\b(?:television|smart tv|qled|oled|android tv|google tv)\b/i, /\btv\b/i] },
            { name: 'Geysers', patterns: [/\b(?:geyser|water heater|instant geyser|storage geyser)\b/i] },
            { name: 'Kitchen Appliances', patterns: [/\b(?:refrigerator|fridge|washing machine|air conditioner|air cooler|cooler|microwave oven|chimney|dishwasher)\b/i] },
            { name: 'Cameras', patterns: [/\b(?:camera|dslr|mirrorless|gopro|action cam|dashcam|lens|tripod)\b/i] },
            { name: 'Monitors', patterns: [/\b(?:pc monitor|gaming monitor|curved monitor)\b/i] },
            { name: 'Others', patterns: [/\b(?:electronics|gadget|charger|power bank)\b/i] }
        ]
    },
    'books-stationery': {
        label: 'Books & Stationery',
        subcategories: [
            { name: 'Fiction', patterns: [/\b(?:fiction|novel|thriller|story)\b/i] },
            { name: 'Non-Fiction', patterns: [/\b(?:non-fiction|biography|self help|business)\b/i] },
            { name: 'Academic', patterns: [/\b(?:academic|textbook|exam|engineering|medical)\b/i] },
            { name: 'Stationery', patterns: [/\b(?:stationery|notebook|pen|pencil|diary|calculator|art supplies)\b/i] },
            { name: 'Others', patterns: [/\b(?:book|books)\b/i] }
        ]
    },
    'sports-fitness': {
        label: 'Sports & Fitness',
        subcategories: [
            { name: 'Equipment', patterns: [/\b(?:equipment|dumbbell|treadmill|cycle|bicycle|weights|bench|yoga mat)\b/i] },
            { name: 'Clothing', patterns: [/\b(?:sports wear|gym wear|activewear|tracksuit)\b/i] },
            { name: 'Footwear', patterns: [/\b(?:running shoes|sports shoes|training shoes)\b/i] },
            { name: 'Accessories', patterns: [/\b(?:shaker|gym bag|gloves|sipper)\b/i] },
            { name: 'Others', patterns: [/\b(?:sports|fitness|gym)\b/i] }
        ]
    },
    'baby-kids': {
        label: 'Baby & Kids',
        subcategories: [
            { name: 'Toys', patterns: [/\b(?:toy|toys|doll|lego|action figure|board game|puzzle|remote control)\b/i] },
            { name: 'Clothing', patterns: [/\b(?:kids wear|baby clothing|infant wear)\b/i] },
            { name: 'Footwear', patterns: [/\b(?:kids shoes|baby shoes)\b/i] },
            { name: 'Baby Care', patterns: [/\b(?:diaper|wipes|stroller|pram|baby care|pampers|huggies)\b/i] },
            { name: 'Others', patterns: [/\b(?:kids|baby)\b/i] }
        ]
    },
    'grocery': {
        label: 'Grocery',
        subcategories: [
            { name: 'Snacks', patterns: [/\b(?:snacks|biscuits|cookies|chips|chocolates)\b/i] },
            { name: 'Beverages', patterns: [/\b(?:tea|coffee|juice|soft drinks|health drink)\b/i] },
            { name: 'Cooking Essentials', patterns: [/\b(?:cooking oil|spices|atta|rice|dal|ghee)\b/i] },
            { name: 'Others', patterns: [/\b(?:grocery|supermarket|food)\b/i] }
        ]
    },
    'general': {
        label: 'General',
        subcategories: [
            { name: 'Festival', patterns: [/\b(?:great indian festival|festival|diwali|navratri|dussehra|christmas|eid)\b/i] },
            { name: 'Bank Offers', patterns: [/\b(?:bank offer|bank offers|instant discount|cashback|credit card|debit card|\bemi\b)\b/i] },
            { name: 'Sale', patterns: [/\b(?:super value|hot deals|goldbox|mega sale|flash sale|grand sale|clearance|big sale|deals|sale|\bdeal\b|\boffer\b|% off)\b/i] },
            { name: 'Promotional', patterns: [/\b(?:survey|associates|storefront|hype|msme|promotional|banner)\b/i] },
            { name: 'Others', patterns: [] }
        ]
    }
};

/**
 * Extracts a human-friendly title from a landing URL if the current title is generic.
 */
function extractTitleFromUrl(url) {
    if (!url) return null;
    try {
        const decoded = decodeURIComponent(url);
        
        // Match product slug from Flipkart: /slug-here/p/
        const flipkartMatch = decoded.match(/flipkart\.com\/([^/?#]+)\/p\//);
        if (flipkartMatch && flipkartMatch[1]) {
            return flipkartMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim();
        }

        // Match collection tab from query params: collection-tab-name=...
        const colMatch = decoded.match(/collection-tab-name=([^&#]+)/);
        if (colMatch && colMatch[1]) {
            return decodeURIComponent(colMatch[1])
                .replace(/\+/g, ' ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim();
        }

        // Match category path from Flipkart: /mens-footwear/pr?
        const catPrMatch = decoded.match(/flipkart\.com\/([^/?#]+)\/pr\?/);
        if (catPrMatch && catPrMatch[1]) {
            return catPrMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim();
        }

        // Match sub-path from Flipkart: /lawn-and-gardening/pr?
        const subPrMatch = decoded.match(/\/([^/?#]+)\/pr\?/);
        if (subPrMatch && subPrMatch[1]) {
            return subPrMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .trim();
        }

        // Match Amazon dp slug: /Product-Title-Here/dp/
        const amzDpMatch = decoded.match(/amazon\.in\/([^/?#]+)\/dp\//);
        if (amzDpMatch && amzDpMatch[1]) {
            return amzDpMatch[1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
                .substring(0, 60)
                .trim();
        }
    } catch (_) {}
    return null;
}

/**
 * Classifies a banner into { category, subcategory, title }
 * @param {Object} banner 
 * @returns {{ category: string, subcategory: string, title: string }}
 */
function classifyBanner(banner) {
    const rawRedirect = banner.clickRedirectUrl || '';
    let decodedRedirect = rawRedirect;
    try { decodedRedirect = decodeURIComponent(rawRedirect); } catch (_) {}

    // Cleaned slug from redirect URL path (without query params)
    let urlSlug = '';
    let urlQueryParams = '';
    try {
        const parsed = new URL(decodedRedirect);
        urlSlug = parsed.pathname.replace(/[\/_-]/g, ' ');
        // Extract interesting params like collection-tab-name
        const colTab = parsed.searchParams.get('collection-tab-name');
        if (colTab) urlQueryParams += ' ' + colTab.replace(/[\/_-]/g, ' ');
    } catch (_) {
        urlSlug = decodedRedirect.replace(/[\/_-]/g, ' ');
    }

    const titleText = (banner.title || '').trim();
    const isGenericTitle = !titleText || 
        titleText.toLowerCase() === 'image' || 
        titleText.toLowerCase() === 'banner';

    // Prioritized search: First check title + URL slug + key params
    const primaryText = `${isGenericTitle ? '' : titleText} ${urlSlug} ${urlQueryParams}`.toLowerCase();
    const fullText = `${primaryText} ${decodedRedirect} ${banner.description || ''}`.toLowerCase();

    // Check specific categories first (skip general)
    for (const [catKey, catData] of Object.entries(CATEGORY_TAXONOMY)) {
        if (catKey === 'general') continue;

        for (const sub of catData.subcategories) {
            for (const pattern of sub.patterns) {
                // Test on primary text first
                if (pattern.test(primaryText)) {
                    return finalizeResult(catKey, sub.name, banner, decodedRedirect);
                }
            }
        }
    }

    // Secondary test on fullText for specific categories
    for (const [catKey, catData] of Object.entries(CATEGORY_TAXONOMY)) {
        if (catKey === 'general') continue;

        for (const sub of catData.subcategories) {
            for (const pattern of sub.patterns) {
                if (pattern.test(fullText)) {
                    return finalizeResult(catKey, sub.name, banner, decodedRedirect);
                }
            }
        }
    }

    // Fallback to General category
    const generalCat = CATEGORY_TAXONOMY['general'];
    for (const sub of generalCat.subcategories) {
        for (const pattern of sub.patterns) {
            if (pattern.test(fullText)) {
                return finalizeResult('general', sub.name, banner, decodedRedirect);
            }
        }
    }

    return finalizeResult('general', 'Promotional', banner, decodedRedirect);
}

function finalizeResult(category, subcategory, banner, decodedRedirect) {
    let title = banner.title;
    const isGeneric = !title || 
        title.trim().toLowerCase() === 'image' || 
        title.trim().toLowerCase() === 'banner';

    if (isGeneric) {
        const extracted = extractTitleFromUrl(decodedRedirect);
        if (extracted) {
            title = extracted;
        } else {
            const label = CATEGORY_TAXONOMY[category]?.label || 'Featured';
            title = `${label} - ${subcategory}`;
        }
    }

    return {
        category,
        subcategory,
        title
    };
}

module.exports = {
    CATEGORY_TAXONOMY,
    classifyBanner,
    extractTitleFromUrl
};
