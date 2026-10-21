const fs = require('fs');
let content = fs.readFileSync('server/api/routes/banners.js', 'utf8');

// I will insert `router.get('/with-deals', ...)` before `router.get('/', ...)`

const withDealsCode = `
router.get('/with-deals', async (req, res, next) => {
  try {
    const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
    
    // Get active banners
    const bannerDbInstance = bannerSource === 'test-banners' ? testBannerDB : bannerDB;
    const result = bannerDbInstance.getActiveBanners ? 
      await bannerDbInstance.getActiveBanners() : 
      await bannerDbInstance.getActiveTestBanners();

    if (result.status !== 200) {
      return res.status(result.status).json(result);
    }

    // Get all deals
    const dealsResult = await productDealsDB.getAllProductDeals();
    const allDeals = dealsResult.status === 200 && dealsResult.data ? dealsResult.data : {};
    
    // Process banners and attach deals
    const enrichedBanners = Object.entries(result.data || {}).map(([id, banner]) => {
      let carouselDeals = [];
      const config = banner.carouselConfig;
      
      if (config && config.type && config.type !== 'none' && config.value) {
        const valLower = config.value.toLowerCase();
        carouselDeals = Object.entries(allDeals)
          .map(([dealId, deal]) => ({ ...deal, id: dealId }))
          .filter(deal => {
            if (config.type === 'category' && deal.category) {
              return deal.category.toLowerCase().includes(valLower);
            }
            if (config.type === 'platform' && deal.storeType) {
              return deal.storeType.toLowerCase() === valLower;
            }
            if (config.type === 'search' && deal.title) {
              return deal.title.toLowerCase().includes(valLower);
            }
            return false;
          })
          .slice(0, 10); // Limit to 10 deals for the carousel
      }
      
      return {
        ...banner,
        id,
        carouselDeals
      };
    });

    return res.json({
      success: true,
      data: enrichedBanners
    });
  } catch (error) {
    logger.error('Error fetching banners with deals', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});
`;

content = content.replace(
  "router.get('/', async (req, res, next) => {",
  withDealsCode + "\n\nrouter.get('/', async (req, res, next) => {"
);

fs.writeFileSync('server/api/routes/banners.js', content);
console.log('patched banners.js with-deals route');
