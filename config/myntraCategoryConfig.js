/**
 * Myntra Category Configuration
 * Comprehensive category URLs for Fashion and Beauty categories
 */

const MYNTRA_CATEGORY_URLS = {
  fashion: {
    main: "https://www.myntra.com/men",
    subcategories: {
      mens_clothing: "https://www.myntra.com/men",
      womens_clothing: "https://www.myntra.com/women",
      kids_clothing: "https://www.myntra.com/kids",
      shoes: "https://www.myntra.com/shoes",
      accessories: "https://www.myntra.com/accessories",
      bags: "https://www.myntra.com/bags",
      watches: "https://www.myntra.com/watches",
      jewelry: "https://www.myntra.com/jewelry"
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
      "formal wear",
      "party wear",
      "sports wear"
    ]
  },
  beauty_personal_care: {
    main: "https://www.myntra.com/beauty",
    subcategories: {
      skincare: "https://www.myntra.com/beauty",
      makeup: "https://www.myntra.com/beauty",
      hair_care: "https://www.myntra.com/beauty",
      personal_care: "https://www.myntra.com/beauty",
      fragrances: "https://www.myntra.com/beauty",
      mens_grooming: "https://www.myntra.com/beauty"
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
      "conditioner",
      "perfume",
      "deodorant"
    ]
  },
  books_stationery: {
    main: "https://www.myntra.com/books",
    subcategories: {
      books: "https://www.myntra.com/books",
      stationery: "https://www.myntra.com/stationery",
      educational: "https://www.myntra.com/books",
      media: "https://www.myntra.com/books"
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
 * Get all category URLs for Myntra
 * @returns {Array} Array of all category URLs
 */
function getAllMyntraCategoryUrls() {
  const urls = [];
  
  for (const [categoryKey, categoryData] of Object.entries(MYNTRA_CATEGORY_URLS)) {
    // Add main category URL
    urls.push(categoryData.main);
    
    // Add subcategory URLs
    for (const [subKey, subUrl] of Object.entries(categoryData.subcategories)) {
      urls.push(subUrl);
    }
    
    // Add search query URLs
    for (const query of categoryData.search_queries) {
      urls.push(`https://www.myntra.com/${encodeURIComponent(query.replace(/\s+/g, '-'))}`);
    }
  }
  
  return urls;
}

/**
 * Get category URLs for a specific category
 * @param {string} categoryKey - Category key
 * @returns {Array} Array of category URLs
 */
function getMyntraCategoryUrls(categoryKey) {
  const categoryData = MYNTRA_CATEGORY_URLS[categoryKey];
  if (!categoryData) return [];
  
  const urls = [categoryData.main];
  
  // Add subcategory URLs
  for (const subUrl of Object.values(categoryData.subcategories)) {
    urls.push(subUrl);
  }
  
  // Add search query URLs
  for (const query of categoryData.search_queries) {
    urls.push(`https://www.myntra.com/${encodeURIComponent(query.replace(/\s+/g, '-'))}`);
  }
  
  return urls;
}

module.exports = {
  MYNTRA_CATEGORY_URLS,
  getAllMyntraCategoryUrls,
  getMyntraCategoryUrls
};


