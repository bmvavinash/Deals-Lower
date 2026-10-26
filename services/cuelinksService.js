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
  const inrdealsPattern = /^https?:\/\/(?:www\.)?inrdeals\.com\/(?:[a-zA-Z0-9]+\/)?(.*)$/;
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
  return cleaned;
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
    logger.warn('Cuelinks API key missing in environment, falling back to INRDeals');
    return null;
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
      if (data && data.short_url) {
        logger.info('Successfully converted URL via Cuelinks API', {
          originalUrl: cleanUrl,
          shortUrl: data.short_url
        });
        return data.short_url;
      }
    }

    logger.warn('Cuelinks API returned non-OK status or missing short_url', {
      status: response.status,
      url: cleanUrl
    });
    return null;
  } catch (error) {
    logger.error('Cuelinks conversion request failed', { error: error.message });
    return null;
  }
}

/**
 * Builds affiliate links for a product across Amazon and non-Amazon platforms
 * Matching lowerdeal.com priority:
 * 1. For Amazon: Direct Amazon affiliate URL with tag (default: dealshubglo0c-21)
 * 2. For non-Amazon (Flipkart, Myntra, Ajio, etc.):
 *    - First try Cuelinks REST API
 *    - Fallback to INRDeals (https://inrdeals.com/avi646476329/{url})
 * @param {string} targetUrl - Merchant product URL
 * @param {string} platform - Store platform (amazon, flipkart, myntra, ajio, etc.)
 * @param {string} [productCode] - Optional platform product code
 * @param {string} [existingExtrape] - Optional existing ExtraPe shortlink to preserve
 * @returns {Promise<{ avinashbmv: string, avinashbmvINR: string, isCuelinks: boolean }>}
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
      avinashbmvINR: '',
      isCuelinks: false
    };
  }

  // --- Non-Amazon platforms (Flipkart, Myntra, Ajio, Croma, etc.) ---
  const inrdealsUrl = `https://inrdeals.com/avi646476329/${cleanUrl}`;

  // 1. Try Cuelinks API
  let cuelinksUrl = null;
  try {
    cuelinksUrl = await convertToCuelinks(cleanUrl);
  } catch (err) {
    logger.warn('Error during Cuelinks conversion', { error: err.message });
  }

  // 2. Final link resolution (Cuelinks -> existing Extrape -> INRDeals)
  const finalAvinashbmv = cuelinksUrl || existingExtrape || inrdealsUrl;

  return {
    avinashbmv: finalAvinashbmv,
    avinashbmvINR: inrdealsUrl,
    isCuelinks: Boolean(cuelinksUrl)
  };
}

module.exports = {
  cleanMerchantUrl,
  convertToCuelinks,
  generateAffiliateLinks
};
