/**
 * Comprehensive Category System - 10 Main Categories
 * 
 * This file defines the complete category hierarchy based on the 10 main categories:
 * 1. Electronics
 * 2. Fashion
 * 3. Home & Kitchen
 * 4. Sports & Fitness
 * 5. Beauty & Personal Care
 * 6. Automotive
 * 7. Baby & Kids
 * 8. Grocery
 * 9. Tools & Hardware
 * 10. Music & Entertainment
 * 11. Pet Supplies (Additional category for completeness)
 */

const COMPREHENSIVE_CATEGORY_HIERARCHY = {
  electronics: {
    name: "Electronics",
    subcategories: {
      mobile_phones: {
        name: "Mobile Phones",
        styles: {
          smartphones: "Smartphones",
          feature_phones: "Feature Phones",
          refurbished: "Refurbished Phones",
          accessories: "Phone Accessories"
        }
      },
      laptops_computers: {
        name: "Laptops & Computers",
        styles: {
          gaming_laptops: "Gaming Laptops",
          business_laptops: "Business Laptops",
          ultrabooks: "Ultrabooks",
          chromebooks: "Chromebooks",
          desktops: "Desktop Computers",
          accessories: "Computer Accessories"
        }
      },
      audio_video: {
        name: "Audio & Video",
        styles: {
          headphones: "Headphones",
          speakers: "Speakers",
          earbuds: "Earbuds",
          neckbands: "Neckbands",
          bluetooth: "Bluetooth Audio",
          gaming_audio: "Gaming Audio",
          home_theater: "Home Theater",
          smart_tv: "Smart TV"
        }
      },
      wearables: {
        name: "Wearables",
        styles: {
          smartwatches: "Smartwatches",
          fitness_trackers: "Fitness Trackers",
          bands: "Watch Bands",
          charging: "Charging Accessories"
        }
      },
      cameras: {
        name: "Cameras & Photography",
        styles: {
          dslr: "DSLR Cameras",
          mirrorless: "Mirrorless Cameras",
          action_cameras: "Action Cameras",
          accessories: "Camera Accessories"
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
  home_kitchen: {
    name: "Home & Kitchen",
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
      kitchen_appliances: {
        name: "Kitchen Appliances",
        styles: {
          cooking: "Cooking Appliances",
          cleaning: "Cleaning Appliances",
          refrigeration: "Refrigeration",
          small_appliances: "Small Appliances"
        }
      },
      home_decor: {
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
      cookware_dining: {
        name: "Cookware & Dining",
        styles: {
          cookware: "Cookware",
          dinnerware: "Dinnerware",
          storage: "Kitchen Storage",
          utensils: "Utensils"
        }
      }
    }
  },
  sports_fitness: {
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
      },
      outdoor_recreation: {
        name: "Outdoor Recreation",
        styles: {
          camping: "Camping & Hiking",
          cycling: "Cycling",
          fishing: "Fishing",
          hunting: "Hunting"
        }
      }
    }
  },
  beauty_personal_care: {
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
      },
      personal_care: {
        name: "Personal Care",
        styles: {
          oral_care: "Oral Care",
          shaving: "Shaving & Hair Removal",
          hygiene: "Personal Hygiene",
          grooming: "Grooming Tools"
        }
      }
    }
  },
  automotive: {
    name: "Automotive",
    subcategories: {
      car_care: {
        name: "Car Care",
        styles: {
          cleaning: "Cleaning Products",
          maintenance: "Maintenance",
          protection: "Protection",
          accessories: "Car Accessories"
        }
      },
      car_parts: {
        name: "Car Parts",
        styles: {
          engine: "Engine Parts",
          brakes: "Brake Parts",
          suspension: "Suspension",
          electrical: "Electrical Parts"
        }
      },
      car_electronics: {
        name: "Car Electronics",
        styles: {
          audio: "Car Audio",
          navigation: "Navigation",
          cameras: "Dash Cams",
          lighting: "Car Lighting"
        }
      },
      motorcycle: {
        name: "Motorcycle & Powersports",
        styles: {
          parts: "Motorcycle Parts",
          accessories: "Motorcycle Accessories",
          gear: "Riding Gear",
          maintenance: "Maintenance"
        }
      }
    }
  },
  baby_kids: {
    name: "Baby & Kids",
    subcategories: {
      baby_clothing: {
        name: "Baby Clothing",
        styles: {
          newborn: "Newborn (0-3 months)",
          infant: "Infant (3-12 months)",
          toddler: "Toddler (1-3 years)",
          accessories: "Baby Accessories"
        }
      },
      kids_clothing: {
        name: "Kids Clothing",
        styles: {
          boys: "Boys Clothing",
          girls: "Girls Clothing",
          unisex: "Unisex Clothing",
          seasonal: "Seasonal Wear"
        }
      },
      toys_games: {
        name: "Toys & Games",
        styles: {
          educational: "Educational Toys",
          action_figures: "Action Figures",
          board_games: "Board Games",
          outdoor: "Outdoor Toys"
        }
      },
      baby_care: {
        name: "Baby Care",
        styles: {
          feeding: "Feeding",
          diapering: "Diapering",
          safety: "Safety",
          nursery: "Nursery"
        }
      }
    }
  },
  grocery: {
    name: "Grocery",
    subcategories: {
      food_beverages: {
        name: "Food & Beverages",
        styles: {
          snacks: "Snacks",
          beverages: "Beverages",
          breakfast: "Breakfast Foods",
          pantry: "Pantry Staples"
        }
      },
      fresh_produce: {
        name: "Fresh Produce",
        styles: {
          fruits: "Fruits",
          vegetables: "Vegetables",
          organic: "Organic Produce",
          seasonal: "Seasonal Items"
        }
      },
      dairy_eggs: {
        name: "Dairy & Eggs",
        styles: {
          milk: "Milk & Dairy",
          cheese: "Cheese",
          eggs: "Eggs",
          yogurt: "Yogurt"
        }
      },
      frozen_foods: {
        name: "Frozen Foods",
        styles: {
          ready_meals: "Ready Meals",
          ice_cream: "Ice Cream",
          frozen_vegetables: "Frozen Vegetables",
          frozen_meat: "Frozen Meat"
        }
      }
    }
  },
  tools_hardware: {
    name: "Tools & Hardware",
    subcategories: {
      hand_tools: {
        name: "Hand Tools",
        styles: {
          wrenches: "Wrenches",
          screwdrivers: "Screwdrivers",
          pliers: "Pliers",
          hammers: "Hammers"
        }
      },
      power_tools: {
        name: "Power Tools",
        styles: {
          drills: "Drills",
          saws: "Saws",
          sanders: "Sanders",
          grinders: "Grinders"
        }
      },
      hardware: {
        name: "Hardware",
        styles: {
          fasteners: "Fasteners",
          hinges: "Hinges",
          locks: "Locks",
          handles: "Handles"
        }
      },
      safety: {
        name: "Safety Equipment",
        styles: {
          protective_gear: "Protective Gear",
          safety_glasses: "Safety Glasses",
          gloves: "Gloves",
          helmets: "Helmets"
        }
      }
    }
  },
  music_entertainment: {
    name: "Music & Entertainment",
    subcategories: {
      musical_instruments: {
        name: "Musical Instruments",
        styles: {
          guitars: "Guitars",
          keyboards: "Keyboards",
          drums: "Drums",
          wind_instruments: "Wind Instruments"
        }
      },
      audio_equipment: {
        name: "Audio Equipment",
        styles: {
          speakers: "Speakers",
          amplifiers: "Amplifiers",
          mixers: "Mixers",
          microphones: "Microphones"
        }
      },
      gaming: {
        name: "Gaming",
        styles: {
          consoles: "Gaming Consoles",
          games: "Video Games",
          accessories: "Gaming Accessories",
          pc_gaming: "PC Gaming"
        }
      },
      books_media: {
        name: "Books & Media",
        styles: {
          books: "Books",
          movies: "Movies & TV",
          music: "Music",
          magazines: "Magazines"
        }
      }
    }
  },
  books_stationery: {
    name: "Books & Stationery",
    subcategories: {
      books: {
        name: "Books",
        styles: {
          fiction: "Fiction",
          non_fiction: "Non-Fiction",
          textbooks: "Textbooks",
          children_books: "Children's Books",
          comics: "Comics & Graphic Novels",
          magazines: "Magazines",
          ebooks: "E-Books"
        }
      },
      stationery: {
        name: "Stationery",
        styles: {
          pens_pencils: "Pens & Pencils",
          notebooks: "Notebooks & Diaries",
          office_supplies: "Office Supplies",
          art_supplies: "Art Supplies",
          school_supplies: "School Supplies",
          writing_accessories: "Writing Accessories"
        }
      },
      educational: {
        name: "Educational Materials",
        styles: {
          study_guides: "Study Guides",
          reference_books: "Reference Books",
          exam_prep: "Exam Preparation",
          language_learning: "Language Learning",
          skill_development: "Skill Development"
        }
      },
      media: {
        name: "Media & Entertainment",
        styles: {
          movies: "Movies & TV",
          music: "Music",
          games: "Games",
          software: "Software",
          digital_content: "Digital Content"
        }
      }
    }
  },
  pet_supplies: {
    name: "Pet Supplies",
    subcategories: {
      dog_supplies: {
        name: "Dog Supplies",
        styles: {
          food: "Dog Food",
          toys: "Dog Toys",
          accessories: "Dog Accessories",
          grooming: "Dog Grooming"
        }
      },
      cat_supplies: {
        name: "Cat Supplies",
        styles: {
          food: "Cat Food",
          toys: "Cat Toys",
          accessories: "Cat Accessories",
          litter: "Cat Litter"
        }
      },
      other_pets: {
        name: "Other Pets",
        styles: {
          fish: "Fish & Aquarium",
          birds: "Bird Supplies",
          small_animals: "Small Animal Supplies",
          reptiles: "Reptile Supplies"
        }
      },
      pet_health: {
        name: "Pet Health",
        styles: {
          supplements: "Pet Supplements",
          medications: "Pet Medications",
          first_aid: "Pet First Aid",
          grooming: "Pet Grooming"
        }
      }
    }
  }
};

/**
 * Platform-specific category mappings
 */
const PLATFORM_CATEGORY_MAPPINGS = {
  amazon: {
    electronics: {
      main_node: "976419031",
      subcategories: {
        mobile_phones: "1389401031",
        laptops_computers: "976392031",
        audio_video: "976419031",
        wearables: "976419031",
        cameras: "976419031"
      }
    },
    fashion: {
      main_node: "1968024031", // Men's Fashion
      subcategories: {
        mens_clothing: "1968024031",
        womens_clothing: "1968253031",
        shoes: "1984443031",
        accessories: "1968024031"
      }
    },
    home_kitchen: {
      main_node: "976442031",
      subcategories: {
        furniture: "976442031",
        kitchen_appliances: "976442031",
        home_decor: "976442031",
        cookware_dining: "976442031"
      }
    },
    sports_fitness: {
      main_node: "1984443031",
      subcategories: {
        fitness_equipment: "1984443031",
        sports_gear: "1984443031",
        outdoor_recreation: "1984443031"
      }
    },
    beauty_personal_care: {
      main_node: "1355016031",
      subcategories: {
        skincare: "1355016031",
        makeup: "1355016031",
        hair_care: "1355016031",
        personal_care: "1355016031"
      }
    },
    automotive: {
      main_node: "1571272031",
      subcategories: {
        car_care: "1571272031",
        car_parts: "1571272031",
        car_electronics: "1571272031",
        motorcycle: "1571272031"
      }
    },
    baby_kids: {
      main_node: "1350380031",
      subcategories: {
        baby_clothing: "1350380031",
        kids_clothing: "1350380031",
        toys_games: "1350380031",
        baby_care: "1350380031"
      }
    },
    grocery: {
      main_node: "4859480031",
      subcategories: {
        food_beverages: "4859480031",
        fresh_produce: "4859480031",
        dairy_eggs: "4859480031",
        frozen_foods: "4859480031"
      }
    },
    tools_hardware: {
      main_node: "976392031",
      subcategories: {
        hand_tools: "976392031",
        power_tools: "976392031",
        hardware: "976392031",
        safety: "976392031"
      }
    },
    music_entertainment: {
      main_node: "976419031",
      subcategories: {
        musical_instruments: "976419031",
        audio_equipment: "976419031",
        gaming: "976419031",
        books_media: "976389031"
      }
    },
    books_stationery: {
      main_node: "976389031",
      subcategories: {
        books: "976389031",
        stationery: "976389031",
        educational: "976389031",
        media: "976389031"
      }
    },
    pet_supplies: {
      main_node: "4772060031",
      subcategories: {
        dog_supplies: "4772060031",
        cat_supplies: "4772060031",
        other_pets: "4772060031",
        pet_health: "4772060031"
      }
    }
  },
  flipkart: {
    electronics: {
      main_url: "https://www.flipkart.com/electronics/pr",
      subcategories: {
        mobile_phones: "https://www.flipkart.com/mobiles/pr",
        laptops_computers: "https://www.flipkart.com/laptops/pr",
        audio_video: "https://www.flipkart.com/audio-video/pr",
        wearables: "https://www.flipkart.com/wearable-smart-devices/pr",
        cameras: "https://www.flipkart.com/cameras/pr"
      }
    },
    fashion: {
      main_url: "https://www.flipkart.com/clothing-and-accessories/pr",
      subcategories: {
        mens_clothing: "https://www.flipkart.com/mens-clothing/pr",
        womens_clothing: "https://www.flipkart.com/womens-clothing/pr",
        shoes: "https://www.flipkart.com/shoes/pr",
        accessories: "https://www.flipkart.com/accessories/pr"
      }
    },
    home_kitchen: {
      main_url: "https://www.flipkart.com/home-kitchen/pr",
      subcategories: {
        furniture: "https://www.flipkart.com/furniture/pr",
        kitchen_appliances: "https://www.flipkart.com/home-kitchen/pr",
        home_decor: "https://www.flipkart.com/home-decor/pr",
        cookware_dining: "https://www.flipkart.com/cookware/pr"
      }
    },
    sports_fitness: {
      main_url: "https://www.flipkart.com/sports-fitness/pr",
      subcategories: {
        fitness_equipment: "https://www.flipkart.com/fitness/pr",
        sports_gear: "https://www.flipkart.com/sports/pr",
        outdoor_recreation: "https://www.flipkart.com/outdoor/pr"
      }
    },
    beauty_personal_care: {
      main_url: "https://www.flipkart.com/beauty-health/pr",
      subcategories: {
        skincare: "https://www.flipkart.com/beauty/pr",
        makeup: "https://www.flipkart.com/beauty/pr",
        hair_care: "https://www.flipkart.com/beauty/pr",
        personal_care: "https://www.flipkart.com/beauty/pr"
      }
    },
    automotive: {
      main_url: "https://www.flipkart.com/automotive/pr",
      subcategories: {
        car_care: "https://www.flipkart.com/automotive/pr",
        car_parts: "https://www.flipkart.com/automotive/pr",
        car_electronics: "https://www.flipkart.com/automotive/pr",
        motorcycle: "https://www.flipkart.com/automotive/pr"
      }
    },
    baby_kids: {
      main_url: "https://www.flipkart.com/baby-kids/pr",
      subcategories: {
        baby_clothing: "https://www.flipkart.com/baby-kids/pr",
        kids_clothing: "https://www.flipkart.com/baby-kids/pr",
        toys_games: "https://www.flipkart.com/toys/pr",
        baby_care: "https://www.flipkart.com/baby-kids/pr"
      }
    },
    grocery: {
      main_url: "https://www.flipkart.com/grocery/pr",
      subcategories: {
        food_beverages: "https://www.flipkart.com/grocery/pr",
        fresh_produce: "https://www.flipkart.com/grocery/pr",
        dairy_eggs: "https://www.flipkart.com/grocery/pr",
        frozen_foods: "https://www.flipkart.com/grocery/pr"
      }
    },
    tools_hardware: {
      main_url: "https://www.flipkart.com/tools-hardware/pr",
      subcategories: {
        hand_tools: "https://www.flipkart.com/tools/pr",
        power_tools: "https://www.flipkart.com/tools/pr",
        hardware: "https://www.flipkart.com/hardware/pr",
        safety: "https://www.flipkart.com/safety/pr"
      }
    },
    music_entertainment: {
      main_url: "https://www.flipkart.com/books-music-games/pr",
      subcategories: {
        musical_instruments: "https://www.flipkart.com/musical-instruments/pr",
        audio_equipment: "https://www.flipkart.com/audio-video/pr",
        gaming: "https://www.flipkart.com/gaming/pr",
        books_media: "https://www.flipkart.com/books/pr"
      }
    },
    books_stationery: {
      main_url: "https://www.flipkart.com/books/pr",
      subcategories: {
        books: "https://www.flipkart.com/books/pr",
        stationery: "https://www.flipkart.com/stationery/pr",
        educational: "https://www.flipkart.com/books/pr",
        media: "https://www.flipkart.com/books-music-games/pr"
      }
    },
    pet_supplies: {
      main_url: "https://www.flipkart.com/pet-supplies/pr",
      subcategories: {
        dog_supplies: "https://www.flipkart.com/pet-supplies/pr",
        cat_supplies: "https://www.flipkart.com/pet-supplies/pr",
        other_pets: "https://www.flipkart.com/pet-supplies/pr",
        pet_health: "https://www.flipkart.com/pet-supplies/pr"
      }
    }
  },
  ajio: {
    fashion: {
      main_url: "https://www.ajio.com/shop/men",
      subcategories: {
        mens_clothing: "https://www.ajio.com/shop/men",
        womens_clothing: "https://www.ajio.com/shop/women",
        shoes: "https://www.ajio.com/shop/shoes",
        accessories: "https://www.ajio.com/shop/accessories"
      }
    },
    beauty_personal_care: {
      main_url: "https://www.ajio.com/shop/beauty",
      subcategories: {
        skincare: "https://www.ajio.com/shop/beauty",
        makeup: "https://www.ajio.com/shop/beauty",
        hair_care: "https://www.ajio.com/shop/beauty",
        personal_care: "https://www.ajio.com/shop/beauty"
      }
    },
    books_stationery: {
      main_url: "https://www.ajio.com/shop/books",
      subcategories: {
        books: "https://www.ajio.com/shop/books",
        stationery: "https://www.ajio.com/shop/stationery",
        educational: "https://www.ajio.com/shop/books",
        media: "https://www.ajio.com/shop/books"
      }
    }
  },
  myntra: {
    fashion: {
      main_url: "https://www.myntra.com/men",
      subcategories: {
        mens_clothing: "https://www.myntra.com/men",
        womens_clothing: "https://www.myntra.com/women",
        shoes: "https://www.myntra.com/shoes",
        accessories: "https://www.myntra.com/accessories"
      }
    },
    beauty_personal_care: {
      main_url: "https://www.myntra.com/beauty",
      subcategories: {
        skincare: "https://www.myntra.com/beauty",
        makeup: "https://www.myntra.com/beauty",
        hair_care: "https://www.myntra.com/beauty",
        personal_care: "https://www.myntra.com/beauty"
      }
    },
    books_stationery: {
      main_url: "https://www.myntra.com/books",
      subcategories: {
        books: "https://www.myntra.com/books",
        stationery: "https://www.myntra.com/stationery",
        educational: "https://www.myntra.com/books",
        media: "https://www.myntra.com/books"
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
  return COMPREHENSIVE_CATEGORY_HIERARCHY[categoryKey] || null;
}

/**
 * Get platform-specific category mapping
 * @param {string} platform - Platform name (amazon, flipkart, ajio, myntra)
 * @param {string} categoryKey - Category key
 * @returns {Object|null} Platform category mapping or null if not found
 */
function getPlatformCategoryMapping(platform, categoryKey) {
  return PLATFORM_CATEGORY_MAPPINGS[platform]?.[categoryKey] || null;
}

/**
 * Get all category URLs for a platform
 * @param {string} platform - Platform name
 * @returns {Array} Array of category URLs
 */
function getPlatformCategoryUrls(platform) {
  const urls = [];
  const mappings = PLATFORM_CATEGORY_MAPPINGS[platform];
  
  if (!mappings) return urls;
  
  for (const [categoryKey, categoryData] of Object.entries(mappings)) {
    // Add main category URL
    if (categoryData.main_node) {
      urls.push(`https://www.amazon.in/gp/browse.html?node=${categoryData.main_node}`);
    } else if (categoryData.main_url) {
      urls.push(categoryData.main_url);
    }
    
    // Add subcategory URLs
    if (categoryData.subcategories) {
      for (const [subKey, subData] of Object.entries(categoryData.subcategories)) {
        if (typeof subData === 'string') {
          if (subData.startsWith('https://')) {
            urls.push(subData);
          } else {
            urls.push(`https://www.amazon.in/gp/browse.html?node=${subData}`);
          }
        }
      }
    }
  }
  
  return urls;
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
  for (const [key, category] of Object.entries(COMPREHENSIVE_CATEGORY_HIERARCHY)) {
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
    'furniture': 'home_kitchen',
    'kitchen': 'home_kitchen',
    'beauty': 'beauty_personal_care',
    'cosmetic': 'beauty_personal_care',
    'skincare': 'beauty_personal_care',
    'makeup': 'beauty_personal_care',
    'sport': 'sports_fitness',
    'fitness': 'sports_fitness',
    'gym': 'sports_fitness',
    'car': 'automotive',
    'auto': 'automotive',
    'baby': 'baby_kids',
    'kids': 'baby_kids',
    'toy': 'baby_kids',
    'grocery': 'grocery',
    'food': 'grocery',
    'tool': 'tools_hardware',
    'hardware': 'tools_hardware',
    'music': 'music_entertainment',
    'entertainment': 'music_entertainment',
    'game': 'music_entertainment',
    'pet': 'pet_supplies',
    'dog': 'pet_supplies',
    'cat': 'pet_supplies'
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
    'headphone': 'audio_video',
    'earphone': 'audio_video',
    'speaker': 'audio_video',
    'laptop': 'laptops_computers',
    'computer': 'laptops_computers',
    'phone': 'mobile_phones',
    'mobile': 'mobile_phones',
    'watch': 'wearables',
    'wearable': 'wearables',
    'camera': 'cameras',
    'shirt': 'mens_clothing',
    'tshirt': 'mens_clothing',
    'dress': 'womens_clothing',
    'top': 'womens_clothing',
    'shoe': 'shoes',
    'footwear': 'shoes',
    'bag': 'accessories',
    'handbag': 'accessories',
    'furniture': 'furniture',
    'decor': 'home_decor',
    'kitchen': 'kitchen_appliances',
    'cookware': 'cookware_dining',
    'cardio': 'fitness_equipment',
    'strength': 'fitness_equipment',
    'yoga': 'fitness_equipment',
    'cricket': 'sports_gear',
    'football': 'sports_gear',
    'basketball': 'sports_gear',
    'tennis': 'sports_gear',
    'badminton': 'sports_gear',
    'swimming': 'sports_gear',
    'face': 'skincare',
    'body': 'skincare',
    'sun': 'skincare',
    'anti': 'skincare',
    'acne': 'skincare',
    'moisturizer': 'skincare',
    'foundation': 'makeup',
    'lipstick': 'makeup',
    'eyeshadow': 'makeup',
    'mascara': 'makeup',
    'blush': 'makeup',
    'nail': 'makeup',
    'shampoo': 'hair_care',
    'conditioner': 'hair_care',
    'oral': 'personal_care',
    'shaving': 'personal_care',
    'hygiene': 'personal_care',
    'grooming': 'personal_care',
    'cleaning': 'car_care',
    'maintenance': 'car_care',
    'protection': 'car_care',
    'engine': 'car_parts',
    'brake': 'car_parts',
    'suspension': 'car_parts',
    'electrical': 'car_parts',
    'audio': 'car_electronics',
    'navigation': 'car_electronics',
    'camera': 'car_electronics',
    'lighting': 'car_electronics',
    'parts': 'motorcycle',
    'gear': 'motorcycle',
    'newborn': 'baby_clothing',
    'infant': 'baby_clothing',
    'toddler': 'baby_clothing',
    'boys': 'kids_clothing',
    'girls': 'kids_clothing',
    'unisex': 'kids_clothing',
    'educational': 'toys_games',
    'action': 'toys_games',
    'board': 'toys_games',
    'outdoor': 'toys_games',
    'feeding': 'baby_care',
    'diapering': 'baby_care',
    'safety': 'baby_care',
    'nursery': 'baby_care',
    'snack': 'food_beverages',
    'beverage': 'food_beverages',
    'breakfast': 'food_beverages',
    'pantry': 'food_beverages',
    'fruit': 'fresh_produce',
    'vegetable': 'fresh_produce',
    'organic': 'fresh_produce',
    'seasonal': 'fresh_produce',
    'milk': 'dairy_eggs',
    'cheese': 'dairy_eggs',
    'egg': 'dairy_eggs',
    'yogurt': 'dairy_eggs',
    'ready': 'frozen_foods',
    'ice': 'frozen_foods',
    'frozen': 'frozen_foods',
    'wrench': 'hand_tools',
    'screwdriver': 'hand_tools',
    'plier': 'hand_tools',
    'hammer': 'hand_tools',
    'drill': 'power_tools',
    'saw': 'power_tools',
    'sander': 'power_tools',
    'grinder': 'power_tools',
    'fastener': 'hardware',
    'hinge': 'hardware',
    'lock': 'hardware',
    'handle': 'hardware',
    'protective': 'safety',
    'glove': 'safety',
    'helmet': 'safety',
    'guitar': 'musical_instruments',
    'keyboard': 'musical_instruments',
    'drum': 'musical_instruments',
    'wind': 'musical_instruments',
    'amplifier': 'audio_equipment',
    'mixer': 'audio_equipment',
    'microphone': 'audio_equipment',
    'console': 'gaming',
    'game': 'gaming',
    'pc': 'gaming',
    'book': 'books_media',
    'movie': 'books_media',
    'magazine': 'books_media',
    'dog': 'dog_supplies',
    'cat': 'cat_supplies',
    'fish': 'other_pets',
    'bird': 'other_pets',
    'reptile': 'other_pets',
    'supplement': 'pet_health',
    'medication': 'pet_health',
    'first': 'pet_health'
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
  const category = getCategoryHierarchy(mainCategory);
  if (!category || !category.subcategories[subcategory]) return null;
  
  const styles = category.subcategories[subcategory].styles;
  if (!styles) return null;
  
  // Direct matches
  for (const [key, styleName] of Object.entries(styles)) {
    if (text.includes(styleName.toLowerCase()) || text.includes(key)) {
      return key;
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
 * Get all available categories in a flat structure
 * @returns {Array} Array of category objects with hierarchy info
 */
function getAllCategories() {
  const categories = [];
  
  for (const [mainKey, mainCategory] of Object.entries(COMPREHENSIVE_CATEGORY_HIERARCHY)) {
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
  COMPREHENSIVE_CATEGORY_HIERARCHY,
  PLATFORM_CATEGORY_MAPPINGS,
  getCategoryHierarchy,
  getPlatformCategoryMapping,
  getPlatformCategoryUrls,
  findMatchingHierarchy,
  findMainCategoryKey,
  findSubcategoryKey,
  findStyleKey,
  generateHierarchicalKey,
  getAllCategories
};


