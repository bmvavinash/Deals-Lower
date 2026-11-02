// config/masterCategorySeeds.js
/**
 * Master Category & A-to-Z Search Catalog
 * 
 * Consolidates all subcategories from Affiliate (HARDCODED_CATEGORIES) and
 * all 213+ popular A-to-Z search keywords into a unified, prioritized registry.
 * 
 * Each category contains:
 * - coreQueries: 2 evergreen flagship queries refreshed every run (e.g. smartphones, laptops).
 * - rotatingQueries: comprehensive pool of all subcategories and A-to-Z search keywords.
 * - supportedStores: list of platforms relevant to this category.
 */

const MASTER_CATEGORY_CATALOG = {
  'electronics': {
    name: 'Electronics',
    coreQueries: ['smartphones', 'laptops'],
    rotatingQueries: [
      // Major Subcategories & Appliances
      'air conditioner',
      'refrigerator',
      'washing machine',
      'geyser',
      'air cooler',
      // Audio & Entertainment
      'television',
      'smart tv',
      'headphones',
      'earbuds',
      'bluetooth speaker',
      'soundbar',
      'home theater',
      // Wearables & Gadgets
      'smartwatch',
      'fitness tracker',
      'tablet',
      'ipad',
      // Computing & Gaming
      'gaming laptop',
      'desktop pc',
      'computer monitor',
      'keyboard mouse combo',
      'external hard drive',
      'graphics card',
      'router',
      // Photography & Accessories
      'dslr camera',
      'action camera',
      'power bank',
      'webcam',
      'projector',
      'echo dot'
    ],
    supportedStores: ['amazon', 'flipkart']
  },

  'fashion': {
    name: 'Fashion',
    coreQueries: ['men shirts', 'women dresses'],
    rotatingQueries: [
      // Subcategories & Popular Clothing
      'kurtas',
      'kurti',
      't-shirts',
      'jeans',
      'trousers',
      'saree',
      'activewear',
      'jackets',
      'winter wear',
      'hoodie',
      'joggers',
      'jumpsuit',
      'leggings',
      'track pants',
      // Footwear
      'running shoes',
      'casual shoes',
      'formal shoes',
      'sneakers',
      'sandals',
      'boots',
      'flip flops',
      // Bags & Accessories
      'backpack',
      'handbag',
      'luggage',
      'wallet',
      'analog watch',
      'belts'
    ],
    supportedStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },

  'home-kitchen': {
    name: 'Home & Kitchen',
    coreQueries: ['kitchen appliances', 'cookware'],
    rotatingQueries: [
      // Major Appliances
      'air fryer',
      'microwave oven',
      'refrigerator',
      'water purifier',
      'mixer grinder',
      'blender',
      'juicer',
      'electric kettle',
      'gas stove',
      'induction cooktop',
      'coffee maker',
      // Home & Cleaning
      'vacuum cleaner',
      'ceiling fan',
      'room heater',
      'steam iron',
      // Furniture & Decor
      'dining table',
      'mattress',
      'bed sheets',
      'blankets',
      'pillow',
      'wardrobe',
      'living room furniture',
      'curtains'
    ],
    supportedStores: ['amazon', 'flipkart']
  },

  'beauty-personal-care': {
    name: 'Beauty & Personal Care',
    coreQueries: ['skincare', 'makeup'],
    rotatingQueries: [
      'haircare',
      'shampoo',
      'hair dryer',
      'hair straightener',
      'perfume',
      'deodorant',
      'face wash',
      'sunscreen',
      'lipstick',
      'makeup kit',
      'body wash',
      'body lotion',
      'hair oil',
      'trimmers',
      'nail polish',
      'epilator'
    ],
    supportedStores: ['amazon', 'flipkart', 'myntra']
  },

  'sports-fitness': {
    name: 'Sports & Fitness',
    coreQueries: ['fitness equipment', 'sports shoes'],
    rotatingQueries: [
      'dumbbells',
      'yoga mat',
      'treadmill',
      'exercise bike',
      'protein powder',
      'running shoes',
      'jump rope',
      'badminton racket',
      'activewear',
      'cycling accessories',
      'weight scale',
      'camping tent'
    ],
    supportedStores: ['amazon', 'flipkart', 'myntra']
  },

  'baby-kids': {
    name: 'Baby & Kids',
    coreQueries: ['baby products', 'kids toys'],
    rotatingQueries: [
      'baby clothes',
      'kids wear',
      'diapers',
      'baby stroller',
      'baby car seat',
      'board games',
      'jigsaw puzzle',
      'baby skin care',
      'educational toys',
      'kids shoes'
    ],
    supportedStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },

  'grocery': {
    name: 'Grocery & Gourmet Foods',
    coreQueries: ['groceries', 'dry fruits'],
    rotatingQueries: [
      'almonds',
      'cashews',
      'cooking oil',
      'olive oil',
      'oats',
      'peanut butter',
      'tea',
      'coffee beans',
      'quinoa',
      'chocolates',
      'snacks',
      'rice'
    ],
    supportedStores: ['amazon', 'flipkart']
  },

  'automotive': {
    name: 'Automotive',
    coreQueries: ['car accessories', 'helmet'],
    rotatingQueries: [
      'car dash cam',
      'car vacuum cleaner',
      'bike accessories',
      'car seat covers',
      'riding gloves',
      'car tire inflator',
      'car cleaning kit',
      'mobile holder for car',
      'car perfume'
    ],
    supportedStores: ['amazon', 'flipkart']
  },

  'books-stationery': {
    name: 'Books & Stationery',
    coreQueries: ['bestseller books', 'notebooks'],
    rotatingQueries: [
      'fiction books',
      'non-fiction books',
      'self help books',
      'kindle paperwhite',
      'office stationery',
      'pens',
      'drawing pencils',
      'calculators',
      'whiteboard'
    ],
    supportedStores: ['amazon', 'flipkart']
  },

  'deals-trending': {
    name: 'Deals & Trending',
    coreQueries: ['lightning deals', 'best sellers'],
    rotatingQueries: [
      'todays deals',
      'trending offers',
      'clearance sale',
      'hot deals',
      'electronics sale',
      'fashion offers'
    ],
    supportedStores: ['amazon', 'flipkart', 'myntra']
  }
};

/**
 * Builds a search URL for a given keyword on a given platform
 */
function buildPlatformSearchUrl(store, query) {
  const q = encodeURIComponent(query.trim());
  const slug = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

  switch (store.toLowerCase()) {
    case 'amazon':
      return `https://www.amazon.in/s?k=${q}`;
    case 'flipkart':
      return `https://www.flipkart.com/search?q=${q}`;
    case 'myntra':
      return `https://www.myntra.com/${slug}`;
    case 'ajio':
      return `https://www.ajio.com/search/?text=${q}`;
    default:
      return `https://www.amazon.in/s?k=${q}`;
  }
}

module.exports = {
  MASTER_CATEGORY_CATALOG,
  buildPlatformSearchUrl
};
