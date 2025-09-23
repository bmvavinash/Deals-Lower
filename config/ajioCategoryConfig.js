/**
 * Ajio Category Configuration
 * Comprehensive category URLs for Fashion and Beauty categories
 */

const AJIO_CATEGORY_URLS = {
  fashion: {
    main: "https://www.ajio.com/shop/men",
    subcategories: {
      mens_clothing: "https://www.ajio.com/shop/men",
      womens_clothing: "https://www.ajio.com/shop/women",
      kids_clothing: "https://www.ajio.com/shop/kids",
      shoes: "https://www.ajio.com/shop/shoes",
      accessories: "https://www.ajio.com/shop/accessories",
      bags: "https://www.ajio.com/shop/bags",
      watches: "https://www.ajio.com/shop/watches",
      jewelry: "https://www.ajio.com/shop/jewelry"
    },
    search_queries: [
      "mens clothing",
      "womens clothing",
      "kids clothing",
      "shoes",
      "accessories",
      "bags",
      "watches",
      "jewelry",
      "ethnic wear",
      "western wear",
      "casual wear",
      "formal wear"
    ]
  },
  beauty_personal_care: {
    main: "https://www.ajio.com/shop/beauty",
    subcategories: {
      skincare: "https://www.ajio.com/shop/beauty",
      makeup: "https://www.ajio.com/shop/beauty",
      hair_care: "https://www.ajio.com/shop/beauty",
      personal_care: "https://www.ajio.com/shop/beauty",
      fragrances: "https://www.ajio.com/shop/beauty",
      mens_grooming: "https://www.ajio.com/shop/beauty"
    },
    search_queries: [
      "skincare",
      "makeup",
      "hair care",
      "personal care",
      "fragrances",
      "mens grooming",
      "face care",
      "body care",
      "lipstick",
      "foundation",
      "shampoo",
      "conditioner"
    ]
  },
  books_stationery: {
    main: "https://www.ajio.com/shop/books",
    subcategories: {
      books: "https://www.ajio.com/shop/books",
      stationery: "https://www.ajio.com/shop/stationery",
      educational: "https://www.ajio.com/shop/books",
      media: "https://www.ajio.com/shop/books"
    },
    search_queries: [
      "books",
      "stationery",
      "educational materials",
      "textbooks",
      "magazines",
      "office supplies",
      "art supplies",
      "school supplies",
      "fiction books",
      "non fiction books",
      "children books",
      "comics",
      "ebooks"
    ]
  }
};

/**
 * Get all category URLs for Ajio
 * @returns {Array} Array of all category URLs
 */
function getAllAjioCategoryUrls() {
  const urls = [];
  
  for (const [categoryKey, categoryData] of Object.entries(AJIO_CATEGORY_URLS)) {
    // Add main category URL
    urls.push(categoryData.main);
    
    // Add subcategory URLs
    for (const [subKey, subUrl] of Object.entries(categoryData.subcategories)) {
      urls.push(subUrl);
    }
    
    // Add search query URLs
    for (const query of categoryData.search_queries) {
      urls.push(`https://www.ajio.com/search?text=${encodeURIComponent(query)}`);
    }
  }
  
  return urls;
}

/**
 * Get category URLs for a specific category
 * @param {string} categoryKey - Category key
 * @returns {Array} Array of category URLs
 */
function getAjioCategoryUrls(categoryKey) {
  const categoryData = AJIO_CATEGORY_URLS[categoryKey];
  if (!categoryData) return [];
  
  const urls = [categoryData.main];
  
  // Add subcategory URLs
  for (const subUrl of Object.values(categoryData.subcategories)) {
    urls.push(subUrl);
  }
  
  // Add search query URLs
  for (const query of categoryData.search_queries) {
    urls.push(`https://www.ajio.com/search?text=${encodeURIComponent(query)}`);
  }
  
  return urls;
}

module.exports = {
  AJIO_CATEGORY_URLS,
  getAllAjioCategoryUrls,
  getAjioCategoryUrls
};


