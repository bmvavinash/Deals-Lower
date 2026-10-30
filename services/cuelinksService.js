/**
 * services/cuelinksService.js
 * Cuelinks API integration & affiliate URL generator
 * Logic modeled after lowerdeal.com (Affiliate repo)
 */

const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('cuelinks-service');

/**
 * Cleans malformed or wrapped merchant URLs
 * @param {string} url 
 * @returns {string}
 */
function cleanMerchantUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.replace(/^@+/, '').trim();

  // Unwrap INRDeals wrapper if already present
  const inrdealsPattern = /^https?:\/\/(?:www\.)?inrdeals\.com\/(?:[a-zA-Z0-9_-]+\/)?(.*)$/i;
  const match = cleaned.match(inrdealsPattern);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return cleanMerchantUrl(decoded);
      }
    } catch {
      // ignore
    }
  }

  // Unwrap legacy linksredirect wrappers if nested
  const linksredirectPattern = /^https?:\/\/linksredirect\.com\/.*[?&]url=([^&]+)/i;
  const lrMatch = cleaned.match(linksredirectPattern);
  if (lrMatch) {
    try {
      const decoded = decodeURIComponent(lrMatch[1]);
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        return cleanMerchantUrl(decoded);
      }
    } catch {
      // ignore
    }
  }

  return cleaned;
}

/**
 * Generates the standardized Cuelinks deeplink wrapper for non-Amazon links
 * Format: https://linksredirect.com/?cid=<CUELINKS_CID>&source=linkkit&url=<encodeURIComponent(productUrl)>
 * @param {string} productUrl - Clean merchant product page URL (preserves query params like ?pid=)
 * @returns {string}
 */
function buildCuelinksDeeplink(productUrl) {
  if (!productUrl || typeof productUrl !== 'string') return '';
  const cid = (process.env.CUELINKS_CID || process.env.REACT_APP_CUELINKS_CID || '214534').trim();
  const cleanUrl = cleanMerchantUrl(productUrl);
  return `https://linksredirect.com/?cid=${cid}&source=linkkit&url=${encodeURIComponent(cleanUrl)}`;
}

/**
 * Converts a merchant URL into a Cuelinks shortened affiliate link via REST API
 * @param {string} originalUrl - Target merchant URL
 * @param {string} [subId='server_api'] - SubID for conversion tracking
 * @returns {Promise<string|null>} - Short Cuelinks URL or null on failure
 */
async function convertToCuelinks(originalUrl, subId = 'server_api') {
  if (!originalUrl || typeof originalUrl !== 'string') return null;

  const apiKey = process.env.CUELINKS_API_KEY || process.env.REACT_APP_CUELINKS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_CUELINKS_API_KEY_HERE') {
    // If no API key configured, use the direct deeplink redirect format
    return buildCuelinksDeeplink(originalUrl);
  }

  const cleanUrl = cleanMerchantUrl(originalUrl);

  try {
    const response = await fetch('https://developers.cuelinks.com/pub_api/v3/links/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: cleanUrl,
        subid: subId,
        shorten: true
      })
    });

    if (response.ok) {
      const data = await response.json();
      const shortUrl = data?.short_url || data?.data?.short_url || data?.data?.tracking_url || data?.data?.affiliate_url || data?.url || data?.data?.url;
      if (shortUrl) {
        logger.info('Successfully converted URL via Cuelinks API', {
          originalUrl: cleanUrl,
          shortUrl: shortUrl
        });
        return shortUrl;
      }
    }

    // Fallback to standard Cuelinks deeplink format
    return buildCuelinksDeeplink(cleanUrl);
  } catch (error) {
    logger.warn('Cuelinks API conversion error, using deeplink fallback', { error: error.message });
    return buildCuelinksDeeplink(cleanUrl);
  }
}

/**
 * Builds affiliate links for a product across Amazon and non-Amazon platforms
 * Matching requirements:
 * 1. For Amazon: Direct Amazon affiliate URL with tag (dealshubglo0c-21):
 *    https://www.amazon.in/dp/<ASIN>?tag=dealshubglo0c-21
 * 2. For non-Amazon (Flipkart, Myntra, Ajio, etc.):
 *    Cuelinks deeplink applied to affiliateUrl and links (avinashbmv, avinashbmvINR):
 *    https://linksredirect.com/?cid=<CUELINKS_CID>&source=linkkit&url=<encodeURIComponent(productUrl)>
 * @param {string} targetUrl - Merchant product URL
 * @param {string} platform - Store platform (amazon, flipkart, myntra, ajio, etc.)
 * @param {string} [productCode] - Optional platform product code
 * @param {string} [existingExtrape] - Optional existing ExtraPe shortlink to preserve if requested
 * @returns {Promise<{ avinashbmv: string, avinashbmvINR: string, affiliateUrl: string, isCuelinks: boolean }>}
 */
async function generateAffiliateLinks(targetUrl, platform = '', productCode = '', existingExtrape = '') {
  const cleanUrl = cleanMerchantUrl(targetUrl);
  const plat = (platform || '').toLowerCase();
  const isAmazon = plat.includes('amazon') || cleanUrl.includes('amazon.in') || cleanUrl.includes('amazon.com');

  if (isAmazon) {
    const tag = process.env.AMAZON_TAG || 'dealshubglo0c-21';
    let amazonUrl = '';
    if (productCode) {
      amazonUrl = `https://www.amazon.in/dp/${productCode}?tag=${tag}`;
    } else {
      try {
        const u = new URL(cleanUrl);
        u.searchParams.set('tag', tag);
        amazonUrl = u.toString();
      } catch {
        const sep = cleanUrl.includes('?') ? '&' : '?';
        amazonUrl = `${cleanUrl}${sep}tag=${tag}`;
      }
    }
    return {
      avinashbmv: amazonUrl,
      avinashbmvINR: cleanUrl,
      affiliateUrl: amazonUrl,
      isCuelinks: false
    };
  }

  // --- Non-Amazon platforms (Flipkart, Myntra, Ajio, Croma, etc.) ---
  // Generate standardized Cuelinks deeplink preserving full query params (like ?pid=)
  const cuelinksDeeplink = buildCuelinksDeeplink(cleanUrl);

  return {
    avinashbmv: cuelinksDeeplink,
    avinashbmvINR: cuelinksDeeplink,
    affiliateUrl: cuelinksDeeplink,
    isCuelinks: true
  };
}

module.exports = {
  cleanMerchantUrl,
  buildCuelinksDeeplink,
  convertToCuelinks,
  generateAffiliateLinks
};
