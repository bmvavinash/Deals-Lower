/**
 * Flipkart Category Configuration
 * Comprehensive category URLs for all 10 main categories
 */

const FLIPKART_CATEGORY_URLS = {
  electronics: {
    main: "https://www.flipkart.com/electronics/pr",
    subcategories: {
      mobile_phones: "https://www.flipkart.com/mobiles/pr",
      laptops_computers: "https://www.flipkart.com/laptops/pr",
      audio_video: "https://www.flipkart.com/audio-video/pr",
      wearables: "https://www.flipkart.com/wearable-smart-devices/pr",
      cameras: "https://www.flipkart.com/cameras/pr",
      gaming: "https://www.flipkart.com/gaming/pr",
      home_appliances: "https://www.flipkart.com/home-kitchen/pr"
    },
    search_queries: [
      "mobile phones",
      "laptops",
      "headphones",
      "smartwatches",
      "cameras",
      "gaming",
      "home appliances"
    ]
  },
  fashion: {
    main: "https://www.flipkart.com/clothing-and-accessories/pr",
    subcategories: {
      mens_clothing: "https://www.flipkart.com/mens-clothing/pr",
      womens_clothing: "https://www.flipkart.com/womens-clothing/pr",
      kids_clothing: "https://www.flipkart.com/kids-clothing/pr",
      shoes: "https://www.flipkart.com/shoes/pr",
      accessories: "https://www.flipkart.com/accessories/pr",
      bags: "https://www.flipkart.com/bags-wallets-belts/pr",
      watches: "https://www.flipkart.com/watches/pr",
      jewelry: "https://www.flipkart.com/jewellery/pr"
    },
    search_queries: [
      "mens clothing",
      "womens clothing",
      "kids clothing",
      "shoes",
      "accessories",
      "bags",
      "watches",
      "jewelry"
    ]
  },
  home_kitchen: {
    main: "https://www.flipkart.com/home-kitchen/pr",
    subcategories: {
      furniture: "https://www.flipkart.com/furniture/pr",
      home_decor: "https://www.flipkart.com/home-decor/pr",
      kitchen_appliances: "https://www.flipkart.com/home-kitchen/pr",
      cookware: "https://www.flipkart.com/cookware/pr",
      home_improvement: "https://www.flipkart.com/home-improvement/pr",
      lighting: "https://www.flipkart.com/lighting/pr",
      storage: "https://www.flipkart.com/storage/pr"
    },
    search_queries: [
      "furniture",
      "home decor",
      "kitchen appliances",
      "cookware",
      "home improvement",
      "lighting",
      "storage"
    ]
  },
  sports_fitness: {
    main: "https://www.flipkart.com/sports-fitness/pr",
    subcategories: {
      fitness_equipment: "https://www.flipkart.com/fitness/pr",
      sports_gear: "https://www.flipkart.com/sports/pr",
      outdoor_recreation: "https://www.flipkart.com/outdoor/pr",
      cycling: "https://www.flipkart.com/cycling/pr",
      camping: "https://www.flipkart.com/camping/pr",
      swimming: "https://www.flipkart.com/swimming/pr"
    },
    search_queries: [
      "fitness equipment",
      "sports gear",
      "outdoor recreation",
      "cycling",
      "camping",
      "swimming"
    ]
  },
  beauty_personal_care: {
    main: "https://www.flipkart.com/beauty-health/pr",
    subcategories: {
      skincare: "https://www.flipkart.com/beauty/pr",
      makeup: "https://www.flipkart.com/beauty/pr",
      hair_care: "https://www.flipkart.com/beauty/pr",
      personal_care: "https://www.flipkart.com/beauty/pr",
      fragrances: "https://www.flipkart.com/beauty/pr",
      mens_grooming: "https://www.flipkart.com/beauty/pr",
      health_care: "https://www.flipkart.com/health-care/pr"
    },
    search_queries: [
      "skincare",
      "makeup",
      "hair care",
      "personal care",
      "fragrances",
      "mens grooming",
      "health care"
    ]
  },
  automotive: {
    main: "https://www.flipkart.com/automotive/pr",
    subcategories: {
      car_care: "https://www.flipkart.com/automotive/pr",
      car_parts: "https://www.flipkart.com/automotive/pr",
      car_electronics: "https://www.flipkart.com/automotive/pr",
      motorcycle: "https://www.flipkart.com/automotive/pr",
      car_accessories: "https://www.flipkart.com/automotive/pr",
      tools_equipment: "https://www.flipkart.com/automotive/pr"
    },
    search_queries: [
      "car care",
      "car parts",
      "car electronics",
      "motorcycle",
      "car accessories",
      "tools equipment"
    ]
  },
  baby_kids: {
    main: "https://www.flipkart.com/baby-kids/pr",
    subcategories: {
      baby_clothing: "https://www.flipkart.com/baby-kids/pr",
      kids_clothing: "https://www.flipkart.com/baby-kids/pr",
      toys_games: "https://www.flipkart.com/toys/pr",
      baby_care: "https://www.flipkart.com/baby-kids/pr",
      feeding: "https://www.flipkart.com/baby-kids/pr",
      safety: "https://www.flipkart.com/baby-kids/pr",
      nursery: "https://www.flipkart.com/baby-kids/pr"
    },
    search_queries: [
      "baby clothing",
      "kids clothing",
      "toys games",
      "baby care",
      "feeding",
      "safety",
      "nursery"
    ]
  },
  grocery: {
    main: "https://www.flipkart.com/grocery/pr",
    subcategories: {
      food_beverages: "https://www.flipkart.com/grocery/pr",
      fresh_produce: "https://www.flipkart.com/grocery/pr",
      dairy_eggs: "https://www.flipkart.com/grocery/pr",
      frozen_foods: "https://www.flipkart.com/grocery/pr",
      snacks: "https://www.flipkart.com/grocery/pr",
      beverages: "https://www.flipkart.com/grocery/pr",
      pantry_staples: "https://www.flipkart.com/grocery/pr"
    },
    search_queries: [
      "food beverages",
      "fresh produce",
      "dairy eggs",
      "frozen foods",
      "snacks",
      "beverages",
      "pantry staples"
    ]
  },
  tools_hardware: {
    main: "https://www.flipkart.com/tools-hardware/pr",
    subcategories: {
      hand_tools: "https://www.flipkart.com/tools/pr",
      power_tools: "https://www.flipkart.com/tools/pr",
      hardware: "https://www.flipkart.com/hardware/pr",
      safety: "https://www.flipkart.com/safety/pr",
      measuring_tools: "https://www.flipkart.com/tools/pr",
      electrical_tools: "https://www.flipkart.com/tools/pr"
    },
    search_queries: [
      "hand tools",
      "power tools",
      "hardware",
      "safety equipment",
      "measuring tools",
      "electrical tools"
    ]
  },
  music_entertainment: {
    main: "https://www.flipkart.com/books-music-games/pr",
    subcategories: {
      musical_instruments: "https://www.flipkart.com/musical-instruments/pr",
      audio_equipment: "https://www.flipkart.com/audio-video/pr",
      gaming: "https://www.flipkart.com/gaming/pr",
      books: "https://www.flipkart.com/books/pr",
      movies_tv: "https://www.flipkart.com/movies-tv/pr",
      magazines: "https://www.flipkart.com/books/pr"
    },
    search_queries: [
      "musical instruments",
      "audio equipment",
      "gaming",
      "books",
      "movies tv",
      "magazines"
    ]
  },
  books_stationery: {
    main: "https://www.flipkart.com/books/pr",
    subcategories: {
      books: "https://www.flipkart.com/books/pr",
      stationery: "https://www.flipkart.com/stationery/pr",
      educational: "https://www.flipkart.com/books/pr",
      media: "https://www.flipkart.com/books-music-games/pr",
      textbooks: "https://www.flipkart.com/books/pr",
      magazines: "https://www.flipkart.com/books/pr",
      office_supplies: "https://www.flipkart.com/stationery/pr"
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
  },
  pet_supplies: {
    main: "https://www.flipkart.com/pet-supplies/pr",
    subcategories: {
      dog_supplies: "https://www.flipkart.com/pet-supplies/pr",
      cat_supplies: "https://www.flipkart.com/pet-supplies/pr",
      other_pets: "https://www.flipkart.com/pet-supplies/pr",
      pet_health: "https://www.flipkart.com/pet-supplies/pr",
      pet_food: "https://www.flipkart.com/pet-supplies/pr",
      pet_toys: "https://www.flipkart.com/pet-supplies/pr"
    },
    search_queries: [
      "dog supplies",
      "cat supplies",
      "other pets",
      "pet health",
      "pet food",
      "pet toys"
    ]
  }
};

/**
 * Get all category URLs for Flipkart
 * @returns {Array} Array of all category URLs
 */
function getAllFlipkartCategoryUrls() {
  const urls = [];
  
  for (const [categoryKey, categoryData] of Object.entries(FLIPKART_CATEGORY_URLS)) {
    // Add main category URL
    urls.push(categoryData.main);
    
    // Add subcategory URLs
    for (const [subKey, subUrl] of Object.entries(categoryData.subcategories)) {
      urls.push(subUrl);
    }
    
    // Add search query URLs
    for (const query of categoryData.search_queries) {
      urls.push(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`);
    }
  }
  
  return urls;
}

/**
 * Get category URLs for a specific category
 * @param {string} categoryKey - Category key
 * @returns {Array} Array of category URLs
 */
function getFlipkartCategoryUrls(categoryKey) {
  const categoryData = FLIPKART_CATEGORY_URLS[categoryKey];
  if (!categoryData) return [];
  
  const urls = [categoryData.main];
  
  // Add subcategory URLs
  for (const subUrl of Object.values(categoryData.subcategories)) {
    urls.push(subUrl);
  }
  
  // Add search query URLs
  for (const query of categoryData.search_queries) {
    urls.push(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`);
  }
  
  return urls;
}

module.exports = {
  FLIPKART_CATEGORY_URLS,
  getAllFlipkartCategoryUrls,
  getFlipkartCategoryUrls
};


