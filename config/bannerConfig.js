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
        'https://www.amazon.in/gp/goldbox',
        'https://affiliate-program.amazon.in/home'
      ],
      selectors: {
        // Main promotional banner selectors (from your HTML examples)
        carousel: 'div._Y29ud_acsUxWidgetDesktop_veWWI, div[data-card-metrics-id*="deals-events"], div[class*="bxcGridImage"], div.ac-carousel, ol.a-carousel',
        bannerLink: 'a[href*="/events/"], a[href*="/gp/goldbox"], a[href*="/deals"], a[target="_blank"]',
        bannerImage: 'img[src*="media-amazon.com"], img[src*="images-eu.ssl-images-amazon.com"], img[alt*="central header"], img[border="0"], img[align="center"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for different page structures
        alternativeCarousel: 'div[class*="bxcGridImage"], div[class*="bxcGridContent"], div[class*="celWidget"]',
        alternativeBannerLink: 'a[href*="amazon.in"], a[href*="amazon.com"]',
        alternativeBannerImage: 'img[src*="amazon.com"], img[src*="media-amazon.com"]',
        // Specific selectors for affiliate page (from your HTML)
        affiliateCarousel: 'li.a-carousel-card, ol.a-carousel li[aria-roledescription="slide"], div.ac-carousel li[aria-roledescription="slide"]',
        affiliateBannerLink: 'a[target="_blank"], a[href*="amazon.in"], a[href*="amazon.com"]',
        affiliateBannerImage: 'img[border="0"], img[src*="media-amazon.com"], img[align="center"]',
        // Promotional element selectors
        promoElements: 'div[class*="promo"], div[class*="hero"], div[class*="featured"], section[class*="banner"], div[class*="bxcGridImage"]'
      },
      validation: {
        minImageWidth: 600,
        minImageHeight: 300,
        allowedDomains: ['media-amazon.com', 'amazon.com', 'images-eu.ssl-images-amazon.com'],
        excludedKeywords: [
          'associate', 'commission', 'affiliate', 'whatsapp', 'telegram',
          'product', 'item', 'goods', 'merchandise', 'inventory',
          'add to cart', 'buy now', 'shop now', 'view details',
          'price', 'discount', 'offer', 'deal', 'reviews', 'ratings',
          'samsung', 'mi', 'tv', 'mobile', 'phone' // Exclude specific product brands
        ],
        // Banner-specific validation
        bannerKeywords: [
          'central header', 'great indian festival', 'early deals', 'live now',
          'festival', 'sale', 'banner', 'promo', 'event', 'deal'
        ]
      }
    },

    flipkart: {
      name: 'Flipkart',
      baseUrl: 'https://www.flipkart.com',
      bannerUrls: [
        'https://www.flipkart.com',
        'https://www.flipkart.com/offers',
        'https://www.flipkart.com/sale'
      ],
      selectors: {
        // Main banner selectors from your HTML
        carousel: 'div._8S67Ib, div[class*="_8S67Ib"], div[class*="_3bzdSa"]',
        bannerLink: 'a[href*="/"], a[href*="flipkart.com"]',
        bannerImage: 'img[src*="rukminim2.flixcart.com"], img[src*="fk-p-flap"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for Flipkart
        alternativeCarousel: 'div[class*="_1AtVbE"], div[class*="banner"], div[class*="carousel"]',
        alternativeBannerLink: 'a[href*="flipkart.com"]',
        alternativeBannerImage: 'img[src*="static-assets-web.flixcart.com"], img[src*="rukminim"]',
        // Promotional element selectors
        promoElements: 'div[class*="promo"], div[class*="banner"], div[class*="offer"], div[class*="_8S67Ib"]'
      },
      validation: {
        minImageWidth: 400,
        minImageHeight: 200,
        allowedDomains: ['rukminim', 'flipkart.com', 'static-assets-web.flixcart.com'],
        excludedKeywords: [
          'associate', 'commission', 'affiliate', 'whatsapp', 'telegram',
          'product', 'item', 'goods', 'merchandise', 'inventory',
          'add to cart', 'buy now', 'shop now', 'view details',
          'price', 'discount', 'offer', 'deal', 'reviews', 'ratings'
        ],
        bannerKeywords: [
          'banner', 'hero', 'main', 'primary', 'featured',
          'promotional', 'promotion', 'campaign', 'sale',
          'festival', 'seasonal', 'holiday', 'celebration'
        ]
      }
    },

    myntra: {
      name: 'Myntra',
      baseUrl: 'https://www.myntra.com',
      bannerUrls: [
        'https://www.myntra.com',
        'https://www.myntra.com/sale',
        'https://www.myntra.com/offers'
      ],
      selectors: {
        // Main banner selectors for Myntra
        carousel: 'div.carousel-slide, div[class*="carousel"], div[class*="banner"], div[class*="hero"]',
        bannerLink: 'a[href*="/"], a[href*="myntra.com"]',
        bannerImage: 'img[src*="assets.myntassets.com"], img[src*="myntra.com"], img[class*="banner"], img[class*="hero"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for different page structures
        alternativeCarousel: 'div[class*="banner"], div[class*="hero"], div[class*="promo"]',
        alternativeBannerLink: 'a[href*="myntra.com"]',
        alternativeBannerImage: 'img[src*="myntra.com"], img[src*="assets.myntassets.com"]',
        // Promotional element selectors
        promoElements: 'div[class*="promo"], div[class*="banner"], div[class*="offer"], div[class*="sale"]'
      },
      validation: {
        minImageWidth: 300,
        minImageHeight: 150,
        allowedDomains: ['assets.myntassets.com', 'myntra.com', 'static.myntassets.com'],
        excludedKeywords: [
          'associate', 'commission', 'affiliate', 'whatsapp', 'telegram',
          'product', 'item', 'goods', 'merchandise', 'inventory',
          'add to cart', 'buy now', 'shop now', 'view details',
          'price', 'discount', 'offer', 'deal', 'reviews', 'ratings'
        ],
        bannerKeywords: [
          'banner', 'hero', 'main', 'primary', 'featured',
          'promotional', 'promotion', 'campaign', 'sale',
          'festival', 'seasonal', 'holiday', 'celebration'
        ]
      }
    },

    ajio: {
      name: 'Ajio',
      baseUrl: 'https://www.ajio.com',
      bannerUrls: [
        'https://www.ajio.com',
        'https://www.ajio.com/sale',
        'https://www.ajio.com/offers'
      ],
      selectors: {
        // Main banner selectors for Ajio
        carousel: 'div.carousel-item, div[class*="carousel"], div[class*="banner"], div[class*="hero"]',
        bannerLink: 'a[href*="/"], a[href*="ajio.com"]',
        bannerImage: 'img[src*="ajio.com"], img[src*="assets.ajio.com"], img[class*="banner"], img[class*="hero"]',
        bannerAlt: 'img[alt]',
        // Alternative selectors for different page structures
        alternativeCarousel: 'div[class*="banner"], div[class*="hero"], div[class*="promo"]',
        alternativeBannerLink: 'a[href*="ajio.com"]',
        alternativeBannerImage: 'img[src*="ajio.com"], img[src*="assets.ajio.com"]',
        // Promotional element selectors
        promoElements: 'div[class*="promo"], div[class*="banner"], div[class*="offer"], div[class*="sale"]'
      },
      validation: {
        minImageWidth: 300,
        minImageHeight: 150,
        allowedDomains: ['ajio.com', 'assets.ajio.com', 'static.ajio.com'],
        excludedKeywords: [
          'associate', 'commission', 'affiliate', 'whatsapp', 'telegram',
          'product', 'item', 'goods', 'merchandise', 'inventory',
          'add to cart', 'buy now', 'shop now', 'view details',
          'price', 'discount', 'offer', 'deal', 'reviews', 'ratings'
        ],
        bannerKeywords: [
          'banner', 'hero', 'main', 'primary', 'featured',
          'promotional', 'promotion', 'campaign', 'sale',
          'festival', 'seasonal', 'holiday', 'celebration'
        ]
      }
    }
  },

  // Banner storage format
  storageFormat: {
    requiredFields: ['id', 'url', 'clickRedirectUrl', 'isActive', 'order', 'creationTimestamp', 'updateTimestamp'],
    optionalFields: ['expirationTimestamp', 'targetDealId', 'platform', 'category', 'title', 'description'],
    idFormat: '{platform}-{category}-{timestamp}',
    defaultOrder: 0
  }
}; 