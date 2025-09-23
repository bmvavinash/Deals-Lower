/**
 * Hierarchical Category System
 * 
 * This file defines the 3-level category hierarchy:
 * Level 1: Main Category (e.g., Electronics, Fashion, Home)
 * Level 2: Subcategory (e.g., Phones, Headsets, Laptops)
 * Level 3: Product Style (e.g., Earbuds, Neckbands, Wireless, Wired)
 * 
 * @deprecated Use comprehensiveCategoryHierarchy.js for the complete 10-category system
 */

const CATEGORY_HIERARCHY = {
  electronics: {
    name: "Electronics",
    subcategories: {
      phones: {
        name: "Phones",
        styles: {
          smartphones: "Smartphones",
          feature_phones: "Feature Phones",
          refurbished: "Refurbished",
          accessories: "Phone Accessories"
        }
      },
      headsets: {
        name: "Headsets & Audio",
        styles: {
          earbuds: "Earbuds",
          neckbands: "Neckbands",
          wireless: "Wireless",
          wired: "Wired",
          bluetooth: "Bluetooth",
          gaming: "Gaming Headsets",
          noise_cancelling: "Noise Cancelling",
          sports: "Sports Headphones"
        }
      },
      laptops: {
        name: "Laptops & Computers",
        styles: {
          gaming: "Gaming Laptops",
          business: "Business Laptops",
          ultrabook: "Ultrabooks",
          chromebook: "Chromebooks",
          desktop: "Desktop Computers",
          accessories: "Computer Accessories"
        }
      },
      smartwatches: {
        name: "Smartwatches & Wearables",
        styles: {
          fitness: "Fitness Trackers",
          smartwatch: "Smartwatches",
          bands: "Watch Bands",
          charging: "Charging Accessories"
        }
      },
      home_appliances: {
        name: "Home Appliances",
        styles: {
          kitchen: "Kitchen Appliances",
          cleaning: "Cleaning Appliances",
          cooling: "Cooling & Heating",
          small_appliances: "Small Appliances"
        }
      }
    }
  },
  fashion: {
    name: "Fashion",
    subcategories: {
      mens_clothing: {
        name: "Men's Clothing",
        styles: {
          shirts: "Shirts",
          tshirts: "T-Shirts",
          jeans: "Jeans",
          trousers: "Trousers",
          shorts: "Shorts",
          jackets: "Jackets",
          suits: "Suits",
          ethnic: "Ethnic Wear"
        }
      },
      womens_clothing: {
        name: "Women's Clothing",
        styles: {
          dresses: "Dresses",
          tops: "Tops & T-Shirts",
          jeans: "Jeans",
          trousers: "Trousers",
          skirts: "Skirts",
          jackets: "Jackets",
          ethnic: "Ethnic Wear",
          western: "Western Wear"
        }
      },
      shoes: {
        name: "Shoes & Footwear",
        styles: {
          sneakers: "Sneakers",
          formal: "Formal Shoes",
          casual: "Casual Shoes",
          sports: "Sports Shoes",
          sandals: "Sandals",
          boots: "Boots",
          heels: "Heels"
        }
      },
      accessories: {
        name: "Accessories",
        styles: {
          bags: "Bags & Handbags",
          watches: "Watches",
          jewelry: "Jewelry",
          sunglasses: "Sunglasses",
          belts: "Belts",
          wallets: "Wallets"
        }
      }
    }
  },
  home: {
    name: "Home & Living",
    subcategories: {
      furniture: {
        name: "Furniture",
        styles: {
          living_room: "Living Room",
          bedroom: "Bedroom",
          dining: "Dining Room",
          office: "Office Furniture",
          outdoor: "Outdoor Furniture",
          storage: "Storage Solutions"
        }
      },
      decor: {
        name: "Home Decor",
        styles: {
          wall_art: "Wall Art",
          lighting: "Lighting",
          rugs: "Rugs & Carpets",
          curtains: "Curtains & Blinds",
          plants: "Plants & Planters",
          mirrors: "Mirrors"
        }
      },
      kitchen_dining: {
        name: "Kitchen & Dining",
        styles: {
          cookware: "Cookware",
          dinnerware: "Dinnerware",
          storage: "Kitchen Storage",
          appliances: "Kitchen Appliances",
          utensils: "Utensils"
        }
      }
    }
  },
  beauty: {
    name: "Beauty & Personal Care",
    subcategories: {
      skincare: {
        name: "Skincare",
        styles: {
          face: "Face Care",
          body: "Body Care",
          suncare: "Sun Care",
          anti_aging: "Anti-Aging",
          acne: "Acne Treatment",
          moisturizers: "Moisturizers"
        }
      },
      makeup: {
        name: "Makeup",
        styles: {
          foundation: "Foundation",
          lipstick: "Lipstick",
          eyeshadow: "Eyeshadow",
          mascara: "Mascara",
          blush: "Blush",
          nail_polish: "Nail Polish"
        }
      },
      hair_care: {
        name: "Hair Care",
        styles: {
          shampoo: "Shampoo",
          conditioner: "Conditioner",
          styling: "Hair Styling",
          treatment: "Hair Treatment",
          tools: "Hair Tools"
        }
      }
    }
  },
  sports: {
    name: "Sports & Fitness",
    subcategories: {
      fitness_equipment: {
        name: "Fitness Equipment",
        styles: {
          cardio: "Cardio Equipment",
          strength: "Strength Training",
          yoga: "Yoga & Pilates",
          outdoor: "Outdoor Fitness",
          accessories: "Fitness Accessories"
        }
      },
      sports_gear: {
        name: "Sports Gear",
        styles: {
          cricket: "Cricket",
          football: "Football",
          basketball: "Basketball",
          tennis: "Tennis",
          badminton: "Badminton",
          swimming: "Swimming"
        }
      }
    }
  }
};

/**
 * Get category hierarchy by key
 * @param {string} categoryKey - The category key (e.g., "electronics", "fashion")
 * @returns {Object|null} Category hierarchy object or null if not found
 */
function getCategoryHierarchy(categoryKey) {
  return CATEGORY_HIERARCHY[categoryKey] || null;
}

/**
 * Get subcategory by main category and subcategory key
 * @param {string} mainCategory - Main category key
 * @param {string} subcategoryKey - Subcategory key
 * @returns {Object|null} Subcategory object or null if not found
 */
function getSubcategory(mainCategory, subcategoryKey) {
  const category = getCategoryHierarchy(mainCategory);
  return category?.subcategories?.[subcategoryKey] || null;
}

/**
 * Get product styles by main category and subcategory
 * @param {string} mainCategory - Main category key
 * @param {string} subcategoryKey - Subcategory key
 * @returns {Object|null} Styles object or null if not found
 */
function getProductStyles(mainCategory, subcategoryKey) {
  const subcategory = getSubcategory(mainCategory, subcategoryKey);
  return subcategory?.styles || null;
}

/**
 * Find the best matching category hierarchy from extracted category data
 * @param {Object} categoryData - Extracted category data from product
 * @returns {Object} Matched hierarchy with mainCategory, subcategory, and style
 */
function findMatchingHierarchy(categoryData) {
  const { mainCategory, c1, c2, c3, c4, c5 } = categoryData || {};
  
  // Try to match main category first
  const mainCategoryKey = findMainCategoryKey(mainCategory || c1 || '');
  if (!mainCategoryKey) {
    return { mainCategory: '', subcategory: '', style: '' };
  }
  
  const category = getCategoryHierarchy(mainCategoryKey);
  if (!category) {
    return { mainCategory: mainCategoryKey, subcategory: '', style: '' };
  }
  
  // Try to match subcategory
  const subcategoryKey = findSubcategoryKey(mainCategoryKey, c2 || c3 || c4 || '');
  if (!subcategoryKey) {
    return { mainCategory: mainCategoryKey, subcategory: '', style: '' };
  }
  
  // Try to match style
  const styleKey = findStyleKey(mainCategoryKey, subcategoryKey, c3 || c4 || c5 || '');
  
  return {
    mainCategory: mainCategoryKey,
    subcategory: subcategoryKey,
    style: styleKey || ''
  };
}

/**
 * Find main category key from category text
 * @param {string} categoryText - Category text to match
 * @returns {string|null} Main category key or null
 */
function findMainCategoryKey(categoryText) {
  if (!categoryText) return null;
  
  const text = categoryText.toLowerCase();
  
  // Direct matches
  for (const [key, category] of Object.entries(CATEGORY_HIERARCHY)) {
    if (text.includes(category.name.toLowerCase()) || text.includes(key)) {
      return key;
    }
  }
  
  // Fuzzy matching for common terms
  const fuzzyMatches = {
    'mobile': 'electronics',
    'phone': 'electronics',
    'laptop': 'electronics',
    'computer': 'electronics',
    'headphone': 'electronics',
    'audio': 'electronics',
    'watch': 'electronics',
    'clothing': 'fashion',
    'apparel': 'fashion',
    'shirt': 'fashion',
    'dress': 'fashion',
    'shoe': 'fashion',
    'furniture': 'home',
    'kitchen': 'home',
    'beauty': 'beauty',
    'cosmetic': 'beauty',
    'skincare': 'beauty',
    'makeup': 'beauty',
    'sport': 'sports',
    'fitness': 'sports',
    'gym': 'sports'
  };
  
  for (const [term, category] of Object.entries(fuzzyMatches)) {
    if (text.includes(term)) {
      return category;
    }
  }
  
  return null;
}

/**
 * Find subcategory key from category text
 * @param {string} mainCategory - Main category key
 * @param {string} categoryText - Category text to match
 * @returns {string|null} Subcategory key or null
 */
function findSubcategoryKey(mainCategory, categoryText) {
  if (!categoryText || !mainCategory) return null;
  
  const text = categoryText.toLowerCase();
  const category = getCategoryHierarchy(mainCategory);
  if (!category) return null;
  
  // Direct matches
  for (const [key, subcategory] of Object.entries(category.subcategories)) {
    if (text.includes(subcategory.name.toLowerCase()) || text.includes(key)) {
      return key;
    }
  }
  
  // Fuzzy matching for common terms
  const fuzzyMatches = {
    'headphone': 'headsets',
    'earphone': 'headsets',
    'audio': 'headsets',
    'laptop': 'laptops',
    'computer': 'laptops',
    'phone': 'phones',
    'mobile': 'phones',
    'watch': 'smartwatches',
    'wearable': 'smartwatches',
    'shirt': 'mens_clothing',
    'tshirt': 'mens_clothing',
    'dress': 'womens_clothing',
    'top': 'womens_clothing',
    'shoe': 'shoes',
    'footwear': 'shoes',
    'bag': 'accessories',
    'handbag': 'accessories',
    'furniture': 'furniture',
    'decor': 'decor',
    'kitchen': 'kitchen_dining'
  };
  
  for (const [term, subcategory] of Object.entries(fuzzyMatches)) {
    if (text.includes(term)) {
      return subcategory;
    }
  }
  
  return null;
}

/**
 * Find style key from category text
 * @param {string} mainCategory - Main category key
 * @param {string} subcategory - Subcategory key
 * @param {string} categoryText - Category text to match
 * @returns {string|null} Style key or null
 */
function findStyleKey(mainCategory, subcategory, categoryText) {
  if (!categoryText || !mainCategory || !subcategory) return null;
  
  const text = categoryText.toLowerCase();
  const styles = getProductStyles(mainCategory, subcategory);
  if (!styles) return null;
  
  // Direct matches
  for (const [key, styleName] of Object.entries(styles)) {
    if (text.includes(styleName.toLowerCase()) || text.includes(key)) {
      return key;
    }
  }
  
  // Fuzzy matching for common terms
  const fuzzyMatches = {
    'wireless': 'wireless',
    'bluetooth': 'bluetooth',
    'wired': 'wired',
    'earbud': 'earbuds',
    'neckband': 'neckbands',
    'gaming': 'gaming',
    'sport': 'sports',
    'noise': 'noise_cancelling',
    'gaming': 'gaming',
    'business': 'business',
    'ultrabook': 'ultrabook',
    'fitness': 'fitness',
    'smartwatch': 'smartwatch',
    'kitchen': 'kitchen',
    'cleaning': 'cleaning',
    'cooling': 'cooling',
    'living': 'living_room',
    'bedroom': 'bedroom',
    'dining': 'dining',
    'office': 'office',
    'outdoor': 'outdoor',
    'wall': 'wall_art',
    'light': 'lighting',
    'rug': 'rugs',
    'curtain': 'curtains',
    'plant': 'plants',
    'mirror': 'mirrors',
    'cookware': 'cookware',
    'dinnerware': 'dinnerware',
    'face': 'face',
    'body': 'body',
    'sun': 'suncare',
    'anti': 'anti_aging',
    'acne': 'acne',
    'moisturizer': 'moisturizers',
    'foundation': 'foundation',
    'lipstick': 'lipstick',
    'eyeshadow': 'eyeshadow',
    'mascara': 'mascara',
    'blush': 'blush',
    'nail': 'nail_polish',
    'shampoo': 'shampoo',
    'conditioner': 'conditioner',
    'cardio': 'cardio',
    'strength': 'strength',
    'yoga': 'yoga',
    'cricket': 'cricket',
    'football': 'football',
    'basketball': 'basketball',
    'tennis': 'tennis',
    'badminton': 'badminton',
    'swimming': 'swimming'
  };
  
  for (const [term, style] of Object.entries(fuzzyMatches)) {
    if (text.includes(term)) {
      return style;
    }
  }
  
  return null;
}

/**
 * Generate hierarchical category key
 * @param {string} mainCategory - Main category key
 * @param {string} subcategory - Subcategory key
 * @param {string} style - Style key
 * @returns {string} Hierarchical category key
 */
function generateHierarchicalKey(mainCategory, subcategory, style) {
  const parts = [mainCategory];
  if (subcategory) parts.push(subcategory);
  if (style) parts.push(style);
  return parts.join('_');
}

/**
 * Parse hierarchical category key
 * @param {string} hierarchicalKey - Hierarchical category key
 * @returns {Object} Parsed hierarchy parts
 */
function parseHierarchicalKey(hierarchicalKey) {
  const parts = hierarchicalKey.split('_');
  return {
    mainCategory: parts[0] || '',
    subcategory: parts[1] || '',
    style: parts[2] || ''
  };
}

/**
 * Get all available categories in a flat structure
 * @returns {Array} Array of category objects with hierarchy info
 */
function getAllCategories() {
  const categories = [];
  
  for (const [mainKey, mainCategory] of Object.entries(CATEGORY_HIERARCHY)) {
    categories.push({
      level: 1,
      key: mainKey,
      name: mainCategory.name,
      parent: null
    });
    
    for (const [subKey, subcategory] of Object.entries(mainCategory.subcategories)) {
      categories.push({
        level: 2,
        key: subKey,
        name: subcategory.name,
        parent: mainKey
      });
      
      for (const [styleKey, styleName] of Object.entries(subcategory.styles)) {
        categories.push({
          level: 3,
          key: styleKey,
          name: styleName,
          parent: subKey
        });
      }
    }
  }
  
  return categories;
}

module.exports = {
  CATEGORY_HIERARCHY,
  getCategoryHierarchy,
  getSubcategory,
  getProductStyles,
  findMatchingHierarchy,
  findMainCategoryKey,
  findSubcategoryKey,
  findStyleKey,
  generateHierarchicalKey,
  parseHierarchicalKey,
  getAllCategories
};

