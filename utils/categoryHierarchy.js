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
    } else if (textToAnalyze.match(/\b(phone|phones|smartphone|smartphones|laptop|laptops|earphone|earphones|headphone|headphones|watch|watches|electronics|tv|camera|cameras|speaker|speakers)\b/)) {
        mainCategory = 'Electronics';
    } else if (textToAnalyze.match(/\b(kitchen|home|furniture|decor|bed|sofa|dining|appliance|appliances)\b/)) {
        mainCategory = 'Home & Kitchen';
    } else if (textToAnalyze.match(/beauty|makeup|skin|hair|perfume|bath|body/)) {
        mainCategory = 'Beauty & Personal Care';
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
            subcategory = 'Ethnic Wear';
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
        else if (textToAnalyze.match(/earphone|headphone|earbud/)) subcategory = 'Audio';
        else if (textToAnalyze.match(/watch|smartwatch/)) subcategory = 'Wearables';
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
