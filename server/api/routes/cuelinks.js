const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { 
  cleanMerchantUrl, 
  convertToCuelinks, 
  generateAffiliateLinks 
} = require('../../../services/cuelinksService');

const logger = getModuleLogger('cuelinks-api');

/**
 * GET /api/cuelinks/status
 * Health & configuration check for Cuelinks API
 */
router.get('/status', (req, res) => {
  const apiKey = (process.env.CUELINKS_API_KEY || process.env.REACT_APP_CUELINKS_API_KEY || '').trim();
  const isConfigured = Boolean(apiKey && apiKey !== 'YOUR_CUELINKS_API_KEY_HERE');

  return res.json({
    success: true,
    configured: isConfigured,
    keyConfigured: isConfigured,
    mode: 'Cuelinks v3 REST API',
    endpoint: 'https://developers.cuelinks.com/pub_api/v3/links/convert'
  });
});

/**
 * GET /api/cuelinks/convert
 * Quick query-param based affiliate conversion
 * e.g. GET /api/cuelinks/convert?url=https://www.flipkart.com/...&subid=website
 */
router.get('/convert', async (req, res) => {
  try {
    const rawUrl = (req.query.url || req.query.link || '').trim();
    const platform = (req.query.platform || '').trim();
    const subid = (req.query.subid || 'api_get').trim();
    const productCode = (req.query.productCode || req.query.code || '').trim();
    const existingExtrape = (req.query.existingExtrape || req.query.extrape || '').trim();

    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: url'
      });
    }

    const cleanUrl = cleanMerchantUrl(rawUrl);
    const result = await generateAffiliateLinks(cleanUrl, platform, productCode, existingExtrape);

    return res.json({
      success: true,
      originalUrl: rawUrl,
      cleanUrl: cleanUrl,
      affiliateUrl: result.avinashbmv,
      isCuelinks: result.isCuelinks,
      platform: platform || 'auto',
      subid: subid
    });
  } catch (error) {
    logger.error('Error in GET /api/cuelinks/convert', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cuelinks/redirect
 * Instant 302 HTTP redirect to converted Cuelinks link (or direct URL fallback)
 * e.g. GET /api/cuelinks/redirect?url=https://www.flipkart.com/...
 */
router.get('/redirect', async (req, res) => {
  try {
    const rawUrl = (req.query.url || req.query.link || '').trim();
    const subid = (req.query.subid || 'redirect').trim();

    if (!rawUrl) {
      return res.status(400).send('Missing required parameter: url');
    }

    const cleanUrl = cleanMerchantUrl(rawUrl);
    const cuelinksUrl = await convertToCuelinks(cleanUrl, subid);

    // Redirect to converted Cuelinks URL, or fallback directly to clean merchant URL
    const destination = cuelinksUrl || cleanUrl;
    return res.redirect(302, destination);
  } catch (error) {
    logger.error('Error in GET /api/cuelinks/redirect', { error: error.message });
    const fallback = req.query.url || '/';
    return res.redirect(302, fallback);
  }
});

/**
 * POST /api/cuelinks/convert
 * Single or batch affiliate link generation
 * 
 * Body options:
 * Single: { "url": "https://...", "platform": "flipkart", "subid": "web" }
 * Batch:  { "urls": ["https://...", "https://..."], "subid": "batch" }
 */
router.post('/convert', async (req, res) => {
  try {
    const { url, urls, platform, subid = 'api_post', productCode, existingExtrape } = req.body;

    // Batch processing
    if (Array.isArray(urls)) {
      if (urls.length === 0) {
        return res.status(400).json({ success: false, error: 'urls array cannot be empty' });
      }

      const results = await Promise.all(
        urls.map(async (rawItem) => {
          const itemUrl = typeof rawItem === 'string' ? rawItem : rawItem?.url;
          const itemPlatform = typeof rawItem === 'object' ? rawItem?.platform : platform;
          const itemCode = typeof rawItem === 'object' ? rawItem?.productCode : '';
          const itemExtrape = typeof rawItem === 'object' ? rawItem?.existingExtrape : '';

          if (!itemUrl || typeof itemUrl !== 'string') {
            return { originalUrl: itemUrl, success: false, error: 'Invalid URL' };
          }

          const clean = cleanMerchantUrl(itemUrl);
          const aff = await generateAffiliateLinks(clean, itemPlatform, itemCode, itemExtrape);

          return {
            originalUrl: itemUrl,
            cleanUrl: clean,
            affiliateUrl: aff.avinashbmv,
            isCuelinks: aff.isCuelinks,
            platform: itemPlatform || 'auto'
          };
        })
      );

      return res.json({
        success: true,
        count: results.length,
        results
      });
    }

    // Single URL processing
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: url (or urls array)'
      });
    }

    const clean = cleanMerchantUrl(url);
    const result = await generateAffiliateLinks(clean, platform, productCode, existingExtrape);

    return res.json({
      success: true,
      originalUrl: url,
      cleanUrl: clean,
      affiliateUrl: result.avinashbmv,
      isCuelinks: result.isCuelinks,
      platform: platform || 'auto',
      subid
    });
  } catch (error) {
    logger.error('Error in POST /api/cuelinks/convert', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
