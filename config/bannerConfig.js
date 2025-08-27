const { validateBannerUrl, validateBannerContent } = require("../utils/commonUtils");

module.exports = {
  // Global banner extraction settings
  global: {
    validateImages: true, // Flag to enable/disable image validation
    maxBannersPerPlatform: 15, // Maximum banners to extract per platform (reduced for better layout)
    extractionInterval: 3600000, // 1 hour in milliseconds
    // Banner dimension requirements
    bannerDimensions: {
      minWidth: 300,
      minHeight: 150,
      maxWidth: 1200,
      maxHeight: 400,
      preferredAspectRatio: 2.5, // width/height ratio
      maxAspectRatio: 4.0,
      minAspectRatio: 1.5
    },
    // Categories for banner classification
    bannerCategories: {
      hero: { priority: 1, keywords: ['hero', 'main', 'primary', 'featured'] },
      promotional: { priority: 2, keywords: ['sale', 'offer', 'deal', 'discount'] },
      seasonal: { priority: 3, keywords: ['seasonal', 'festival', 'holiday'] },
      category: { priority: 4, keywords: ['category', 'brand', 'product'] }
    },
    affiliateKeywords: [
      'commission', 'fee', 'affiliate', 'associate', 'earn', 'revenue',
      'commission rate', 'earning', 'partner', 'referral', 'cashback'
    ],
    percentagePatterns: [
      /\d+%\s*(?:commission|fee|earning)/i,
      /commission\s*\d+%/i,
      /fee\s*\d+%/i
    ],
    // Keywords to exclude product carousels
    productCarouselKeywords: [
      'product', 'item', 'goods', 'merchandise', 'inventory',
      'add to cart', 'buy now', 'shop now', 'view details',
      'price', 'discount', 'offer', 'deal'
    ]
  },

  // Platform-specific configurations
  platforms: {
    amazon: {
      name: 'Amazon',
      baseUrl: 'https://www.amazon.in',
      affiliateUrl: 'https://affiliate-program.amazon.in/home',
      bannerUrls: [
        'https://www.amazon.in',
        'https://www.amazon.in/deals',
        'https://www.amazon.in/events/greatfreedomsale'
      ],
      selectors: {
        carousel: 'li.a-carousel-card',
        bannerLink: 'a[href*="/"]',
        bannerImage: 'img[src*="media-amazon.com"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for different page structures
        alternativeCarousel: 'div.a-carousel-card',
        alternativeBannerLink: 'a[href*="amazon.in"]',
        alternativeBannerImage: 'img[src*="amazon.com"]'
      },
      validation: {
        minImageWidth: 200,
        minImageHeight: 100,
        allowedDomains: ['media-amazon.com', 'amazon.com'],
        excludedKeywords: ['associate', 'commission', 'affiliate']
      }
    },

    flipkart: {
      name: 'Flipkart',
      baseUrl: 'https://www.flipkart.com',
      bannerUrls: [
        'https://www.flipkart.com',
        'https://www.flipkart.com/offers'
      ],
      selectors: {
        carousel: 'div._1AtVbE',
        bannerLink: 'a[href*="/"]',
        bannerImage: 'img[src*="rukminim"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for Flipkart
        alternativeCarousel: 'div[class*="_1AtVbE"]',
        alternativeBannerLink: 'a[href*="flipkart.com"]',
        alternativeBannerImage: 'img[src*="static-assets-web.flixcart.com"]'
      },
      validation: {
        minImageWidth: 200,
        minImageHeight: 100,
        allowedDomains: ['rukminim', 'flipkart.com', 'static-assets-web.flixcart.com'],
        excludedKeywords: ['associate', 'commission', 'affiliate']
      }
    },

    // Temporarily disabled due to access restrictions
    // myntra: {
    //   name: 'Myntra',
    //   baseUrl: 'https://www.myntra.com',
    //   bannerUrls: [
    //     'https://www.myntra.com',
    //     'https://www.myntra.com/sale'
    //   ],
    //   selectors: {
    //     carousel: 'div.carousel-slide',
    //     bannerLink: 'a[href*="/"]',
    //     bannerImage: 'img[src*="assets.myntassets.com"]',
    //     bannerAlt: 'img[alt]'
    //   },
    //   validation: {
    //     minImageWidth: 200,
    //     minImageHeight: 100,
    //     allowedDomains: ['assets.myntassets.com', 'myntra.com'],
    //     excludedKeywords: ['associate', 'commission', 'affiliate']
    //   }
    // },

    // Temporarily disabled due to access restrictions
    // ajio: {
    //   name: 'Ajio',
    //   baseUrl: 'https://www.ajio.com',
    //   bannerUrls: [
    //     'https://www.ajio.com',
    //     'https://www.ajio.com/sale'
    //   ],
    //   selectors: {
    //     carousel: 'div.carousel-item',
    //     bannerLink: 'a[href*="/"]',
    //     bannerImage: 'img[src*="ajio.com"]',
    //     bannerAlt: 'img[alt]'
    //   },
    //   validation: {
    //     minImageWidth: 200,
    //     minImageHeight: 100,
    //     allowedDomains: ['ajio.com'],
    //     excludedKeywords: ['associate', 'commission', 'affiliate']
    //   }
    // }
  },

  // Banner storage format
  storageFormat: {
    requiredFields: ['id', 'url', 'clickRedirectUrl', 'isActive', 'order', 'creationTimestamp', 'updateTimestamp'],
    optionalFields: ['expirationTimestamp', 'targetDealId', 'platform', 'category', 'title', 'description'],
    idFormat: '{platform}-{category}-{timestamp}',
    defaultOrder: 0
  }
}; 