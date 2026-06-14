/**
 * Utility to determine the strict categorical hierarchy for a product.
 * Returns { hierarchicalCategory: { mainCategory, subcategory, style, gender }, hierarchicalKey }
 */

function determineHierarchy(category, title = '', brand = '') {
    const textToAnalyze = `${Object.values(category || {}).join(' ')} ${title} ${brand}`.toLowerCase();
    
    let mainCategory = 'Others';
    let subcategory = 'Uncategorized';
    let style = 'Standard';
    let gender = 'Unisex';

    // 1. Determine Main Category
    if (textToAnalyze.match(/\b(clothing|apparel|fashion|wear|dress|dresses|shirt|shirts|pant|pants|shoe|shoes|sandal|sandals|kurta|kurtas|gown|gowns|jean|jeans)\b/)) {
        mainCategory = 'Fashion';
    } else if (textToAnalyze.match(/\b(phone|phones|smartphone|smartphones|laptop|laptops|earphone|earphones|headphone|headphones|watch|watches|electronics|tv|camera|cameras|speaker|speakers|air conditioner|air conditioners|ac|cooler|coolers|air cooler|geyser|geysers|heater|heaters|washing machine|refrigerator|monitor|monitors)\b/)) {
        mainCategory = 'Electronics';
    } else if (textToAnalyze.match(/\b(kitchen|home|furniture|decor|bed|sofa|dining|appliance|appliances)\b/)) {
        mainCategory = 'Home & Kitchen';
    } else if (textToAnalyze.match(/beauty|makeup|skin|hair|perfume|bath|body/)) {
        mainCategory = 'Beauty & Personal Care';
    } else if (textToAnalyze.match(/book|books|novel|fiction|stationery|pen|pencil|academic|study/)) {
        mainCategory = 'Books & Stationery';
    } else if (textToAnalyze.match(/sport|sports|fitness|gym|dumbbell|treadmill|cricket|bat|ball|cycle|bicycle/)) {
        mainCategory = 'Sports & Fitness';
    } else if (textToAnalyze.match(/baby|kids|toy|toys|game|puzzle|diaper/)) {
        mainCategory = 'Baby & Kids';
    } else if (textToAnalyze.match(/grocery|food|snacks|beverages/)) {
        mainCategory = 'Grocery';
    }

    // 2. Determine Gender (mostly for Fashion)
    if (mainCategory === 'Fashion' || mainCategory === 'Beauty & Personal Care') {
        if (textToAnalyze.match(/\b(women|woman|girls|girl|ladies|female)\b/)) {
            gender = 'Women';
        } else if (textToAnalyze.match(/\b(men|man|boys|boy|male)\b/)) {
            gender = 'Men';
        } else if (textToAnalyze.match(/\b(kids|baby|toddler|children)\b/)) {
            gender = 'Kids';
        }
    }

    // 3. Determine Subcategory & Style
    if (mainCategory === 'Fashion') {
        if (textToAnalyze.match(/\b(lehenga|chaniya choli)\b/)) {
            subcategory = 'Ethnic Wear';
            style = 'Lehenga';
            gender = 'Women';
        } else if (textToAnalyze.match(/\b(dress|dresses|gown|gowns)\b/)) {
            subcategory = 'Dresses';
            if (textToAnalyze.includes('gown')) style = 'Gowns';
            else if (textToAnalyze.match(/maxi|midi|mini|a-line|bodycon/)) {
                const match = textToAnalyze.match(/maxi|midi|mini|a-line|bodycon/)[0];
                style = match.charAt(0).toUpperCase() + match.slice(1);
            } else style = 'Casual';
            gender = 'Women';
        } else if (textToAnalyze.match(/\b(kurta|kurti|suit set|ethnic)\b/)) {
            subcategory = 'Kurtas'; // Changed from 'Ethnic Wear' to match frontend
            if (textToAnalyze.includes('kurti')) style = 'Kurtis';
            else if (textToAnalyze.includes('kurta')) style = 'Kurtas';
            else style = 'Suit Sets';
        } else if (textToAnalyze.match(/\b(shirt|shirts)\b/)) {
            subcategory = 'Shirts';
            style = textToAnalyze.includes('formal') ? 'Formal' : 'Casual';
        } else if (textToAnalyze.match(/\b(t-shirt|tshirt|tee)\b/)) {
            subcategory = 'T-Shirts';
            style = textToAnalyze.includes('polo') ? 'Polo' : 'Crew Neck';
        } else if (textToAnalyze.match(/\b(pant|pants|trouser|trousers)\b/)) {
            subcategory = 'Pants';
            style = textToAnalyze.includes('formal') ? 'Formal' : 'Casual';
        } else if (textToAnalyze.match(/\b(jean|jeans|denim)\b/)) {
            subcategory = 'Jeans';
            style = textToAnalyze.match(/skinny|slim|straight|baggy|wide/)?.[0] || 'Standard';
            style = style.charAt(0).toUpperCase() + style.slice(1);
        } else if (textToAnalyze.match(/\b(sock|socks)\b/)) {
            subcategory = 'Accessories';
            style = 'Socks';
        } else if (textToAnalyze.match(/\b(underwear|briefs|trunks|panties|bra|bras|lingerie)\b/)) {
            subcategory = 'Innerwear';
            style = textToAnalyze.match(/\b(bra|bras|lingerie|panties)\b/) ? 'Women Innerwear' : 'Men Innerwear';
        } else if (textToAnalyze.match(/\b(shoe|shoes|sneaker|sneakers)\b/)) {
            subcategory = 'Shoes';
            style = textToAnalyze.includes('sneaker') ? 'Sneakers' : 'Standard';
        } else if (textToAnalyze.match(/\b(sandal|sandals|flip flop)\b/)) {
            subcategory = 'Sandals';
            style = textToAnalyze.includes('flip flop') ? 'Flip Flops' : 'Standard';
        }
    } else if (mainCategory === 'Electronics') {
        if (textToAnalyze.match(/phone|smartphone|mobile/)) subcategory = 'Mobiles';
        else if (textToAnalyze.match(/laptop|macbook/)) subcategory = 'Laptops';
        else if (textToAnalyze.match(/earphone|headphone|earbud|speaker|audio/)) subcategory = 'Audio';
        else if (textToAnalyze.match(/watch|smartwatch/)) subcategory = 'Wearables';
        else if (textToAnalyze.match(/tv|television/)) subcategory = 'Televisions';
        else if (textToAnalyze.match(/monitor/)) subcategory = 'Monitors';
        else if (textToAnalyze.match(/air conditioner|\bac\b/)) { subcategory = 'Air Conditioners'; style = 'Split AC'; }
        else if (textToAnalyze.match(/cooler|air cooler/)) { subcategory = 'Air Coolers'; style = 'Desert Cooler'; }
        else if (textToAnalyze.match(/washing machine/)) { subcategory = 'Washing Machines'; style = 'Front Load'; }
        else if (textToAnalyze.match(/geyser|water heater/)) { subcategory = 'Geysers'; style = 'Water Heater'; }
        else if (textToAnalyze.match(/refrigerator|fridge/)) { subcategory = 'Refrigerators'; style = 'Single Door'; }
        else if (textToAnalyze.match(/camera/)) { subcategory = 'Cameras'; style = 'Digital'; }
    } else if (mainCategory === 'Home & Kitchen') {
        if (textToAnalyze.match(/mixer|grinder|blender|oven|microwave|toaster|kettle|appliance/)) subcategory = 'Kitchen Appliances';
        else if (textToAnalyze.match(/pan|pot|kadai|tawa|cooker|cookware/)) subcategory = 'Cookware';
        else if (textToAnalyze.match(/bed|sofa|chair|table|desk|wardrobe|furniture/)) subcategory = 'Furniture';
        else if (textToAnalyze.match(/decor|lamp|clock|vase|painting|curtain/)) subcategory = 'Home Decor';
    } else if (mainCategory === 'Beauty & Personal Care') {
        if (textToAnalyze.match(/cream|lotion|serum|face|skin|moisturizer/)) subcategory = 'Skincare';
        else if (textToAnalyze.match(/shampoo|conditioner|oil|hair/)) subcategory = 'Haircare';
        else if (textToAnalyze.match(/lipstick|foundation|mascara|eyeliner|makeup/)) subcategory = 'Makeup';
        else if (textToAnalyze.match(/perfume|deo|deodorant|cologne|fragrance/)) subcategory = 'Fragrances';
        else if (textToAnalyze.match(/soap|wash|bath|body/)) subcategory = 'Bath & Body';
    } else if (mainCategory === 'Books & Stationery') {
        if (textToAnalyze.match(/novel|fiction|story/)) subcategory = 'Fiction';
        else if (textToAnalyze.match(/biography|history|non-fiction|non fiction/)) subcategory = 'Non-Fiction';
        else if (textToAnalyze.match(/textbook|academic|study|exam/)) subcategory = 'Academic';
        else if (textToAnalyze.match(/pen|pencil|notebook|paper|stationery/)) subcategory = 'Stationery';
    } else if (mainCategory === 'Sports & Fitness') {
        if (textToAnalyze.match(/dumbbell|mat|treadmill|cycle|equipment|bat|ball|racket/)) subcategory = 'Equipment';
        else if (textToAnalyze.match(/jersey|tracksuit|shorts|clothing/)) subcategory = 'Clothing';
        else if (textToAnalyze.match(/shoe|cleat|footwear/)) subcategory = 'Footwear';
        else if (textToAnalyze.match(/bag|bottle|glove|accessories/)) subcategory = 'Accessories';
    } else if (mainCategory === 'Baby & Kids') {
        if (textToAnalyze.match(/toy|game|puzzle/)) subcategory = 'Toys';
        else if (textToAnalyze.match(/shirt|dress|clothing|romper/)) subcategory = 'Clothing';
        else if (textToAnalyze.match(/shoe|sandal|boot|footwear/)) subcategory = 'Footwear';
        else if (textToAnalyze.match(/diaper|wipe|lotion|care/)) subcategory = 'Baby Care';
    }

    const hierarchicalCategory = { mainCategory, subcategory, style, gender };
    
    // Construct strict hierarchical string for UI grouping
    let hierarchicalKey = `${mainCategory}_${subcategory}`;
    if (mainCategory === 'Fashion') {
        hierarchicalKey = `${mainCategory}_${gender}_${subcategory}_${style}`;
    }

    return {
        hierarchicalCategory,
        hierarchicalKey
    };
}

module.exports = {
    determineHierarchy
};
