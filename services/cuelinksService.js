/**
 * services/cuelinksService.js
 * Cuelinks API integration & affiliate URL generator
 * Logic modeled after lowerdeal.com (Affiliate repo)
 */

const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('cuelinks-service');

/**
 * Rigorously validates whether a URL is a valid ExtraPe shortlink.
 * ExtraPe shortlinks use specific domains: extp.in, extrape.com, extrapay.com, extrapay.in, fkrt.co, myntr.in, ajiio.co
 * and must contain an alphanumeric short-code path (disallowing homepages, login, converter, or empty paths).
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid ExtraPe shortlink
 */
function isValidExtrapeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (trimmed.includes(' ') || trimmed.includes('undefined') || trimmed.includes('null') || trimmed.includes('[object')) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const validHosts = [
      'extp.in',
      'extrape.com',
      'extrapay.com',
      'extrapay.in',
      'fkrt.co',
      'myntr.in',
      'ajiio.co'
    ];

    const isKnownHost = validHosts.includes(host) || host.endsWith('.extp.in') || host.endsWith('.extrape.com');
    if (!isKnownHost) return false;

    const pathname = parsed.pathname.trim();
    const invalidPaths = ['', '/', '/login', '/link-converter', '/register', '/home', '/dashboard', '/converter', '/about', '/contact', '/privacy', '/terms'];
    if (invalidPaths.includes(pathname.toLowerCase())) return false;

    // Path must have at least 2 characters after slash (e.g. /ab, /DUL8, /x9Z1)
    if (pathname.length < 3) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Actively tests whether an ExtraPe shortlink resolves and redirects properly.
 * @param {string} url - ExtraPe shortlink to test
 * @param {number} [timeoutMs=4000] - Timeout in milliseconds
 * @returns {Promise<{ valid: boolean, status: number|string, destination?: string, reason?: string }>}
 */
async function verifyExtrapeUrl(url, timeoutMs = 4000) {
  if (!isValidExtrapeUrl(url)) {
    return { valid: false, status: 'invalid_format', reason: 'URL failed structural validation' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    const status = res.status;
    const location = res.headers.get('location') || '';

    // ExtraPe shortlinks return a 301, 302, 307, or 308 redirect to destination merchant
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (location.includes('/login') || location.includes('/error') || location.endsWith('extrape.com/') || location === '/' || location.includes('/404')) {
        return {
          valid: false,
          status,
          destination: location,
          reason: 'Redirects to error or login page (session/campaign expired)'
        };
      }
      return {
        valid: true,
        status,
        destination: location
      };
    }

    if (status === 200) {
      return { valid: true, status };
    }

    if (status === 404 || status === 410 || status >= 500) {
      return {
        valid: false,
        status,
        reason: `HTTP ${status} response from shortlink endpoint`
      };
    }

    return { valid: true, status };
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn('Active ExtraPe link verification timeout or network error', { url, error: err.message });
    // Keep structural validity on timeout so transient network glitches don't drop active links
    return {
      valid: true,
      status: 'timeout_assumed_valid',
      reason: err.message
    };
  }
}

/**
 * Cleans malformed or wrapped merchant URLs
 * @param {string} url 
 * @returns {string}
 */
function cleanMerchantUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.replace(/^@+/, '').trim();

  // If already a Cuelinks shortlink or valid ExtraPe shortlink, keep as is
  if (/^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?clnk\.in\//i.test(cleaned) || /^https?:\/\/(?:www\.)?cuelinks\.com\//i.test(cleaned) || isValidExtrapeUrl(cleaned)) {
    return cleaned;
  }

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

  // Unwrap legacy linksredirect wrappers if nested or obsolete
  if (cleaned.includes('linksredirect.com')) {
    try {
      const parsed = new URL(cleaned);
      const target = parsed.searchParams.get('url');
      if (target && (target.startsWith('http://') || target.startsWith('https://'))) {
        return cleanMerchantUrl(target);
      }
    } catch {
      const linksredirectPattern = /^https?:\/\/(?:www\.)?linksredirect\.com\/.*[?&]url=([^&]+)/i;
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
    }
  }

  return cleaned;
}

/**
 * Generates the standardized Cuelinks deeplink wrapper for non-Amazon links
 * Format: https://linksredirect.com/?cid=<CUELINKS_CID>&publisher_referral_url=https%3A%2F%2Flowerdeal.com&source=linkkit&url=<encodeURIComponent(productUrl)>
 * @param {string} productUrl - Clean merchant product page URL (preserves query params like ?pid=)
 * @returns {string}
 */
function buildCuelinksDeeplink(productUrl) {
  if (!productUrl || typeof productUrl !== 'string') return '';
  const trimmed = productUrl.trim();

  // If already a Cuelinks shortlink or valid ExtraPe shortlink
  if (/^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?clnk\.in\//i.test(trimmed) || /^https?:\/\/(?:www\.)?cuelinks\.com\//i.test(trimmed) || isValidExtrapeUrl(trimmed)) {
    return trimmed;
  }

  const cid = (process.env.CUELINKS_CID || process.env.REACT_APP_CUELINKS_CID || '176755').trim();
  const publisherReferralUrl = encodeURIComponent('https://lowerdeal.com');

  // If already an up-to-date linksredirect link with CID and publisher_referral_url
  if (trimmed.includes('linksredirect.com') && trimmed.includes(`cid=${cid}`) && trimmed.includes('publisher_referral_url=')) {
    return trimmed;
  }

  const cleanUrl = cleanMerchantUrl(productUrl);
  if (/^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?clnk\.in\//i.test(cleanUrl) || /^https?:\/\/(?:www\.)?cuelinks\.com\//i.test(cleanUrl) || isValidExtrapeUrl(cleanUrl)) {
    return cleanUrl;
  }

  return `https://linksredirect.com/?cid=${cid}&publisher_referral_url=${publisherReferralUrl}&source=linkkit&url=${encodeURIComponent(cleanUrl)}`;
}

/**
 * Converts a merchant URL into a Cuelinks shortened affiliate link via REST API
 * @param {string} originalUrl - Target merchant URL
 * @param {string} [subId='server_api'] - SubID for conversion tracking
 * @returns {Promise<string|null>} - Short Cuelinks URL or fallback deeplink
 */
async function convertToCuelinks(originalUrl, subId = 'server_api') {
  if (!originalUrl || typeof originalUrl !== 'string') return null;
  const trimmed = originalUrl.trim();

  // If already a Cuelinks shortlink or valid ExtraPe shortlink
  if (/^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?clnk\.in\//i.test(trimmed) || /^https?:\/\/(?:www\.)?cuelinks\.com\//i.test(trimmed) || isValidExtrapeUrl(trimmed)) {
    return trimmed;
  }

  const apiKey = (process.env.CUELINKS_API_KEY || process.env.REACT_APP_CUELINKS_API_KEY || '').trim();
  if (!apiKey || apiKey === 'YOUR_CUELINKS_API_KEY_HERE') {
    // If no API key configured, use the direct deeplink redirect format
    return buildCuelinksDeeplink(trimmed);
  }

  const cleanUrl = cleanMerchantUrl(trimmed);

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
 *    - Priority 1: ExtraPe shortlink in avinashbmv if valid (validated for real shortlink domain & slug).
 *    - Priority 2 / Fallback: Standard Cuelinks deeplink (CID 176755 + publisher_referral_url=https://lowerdeal.com)
 *    If ExtraPe is missing, expired, or invalid, Cuelinks is assigned so NO LEADS GO UNTRACKED.
 * @param {string} targetUrl - Merchant product URL
 * @param {string} platform - Store platform (amazon, flipkart, myntra, ajio, etc.)
 * @param {string} [productCode] - Optional platform product code
 * @param {string} [existingExtrape] - Optional existing ExtraPe shortlink to validate and preserve
 * @returns {Promise<{ avinashbmv: string, avinashbmvINR: string, affiliateUrl: string, isCuelinks: boolean, hasValidExtrape: boolean }>}
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
      isCuelinks: false,
      hasValidExtrape: false
    };
  }

  // --- Non-Amazon platforms (Flipkart, Myntra, Ajio, Croma, etc.) ---
  const cuelinksDeeplink = buildCuelinksDeeplink(cleanUrl);

  // If existingExtrape is provided, rigorously validate that it is a genuine ExtraPe shortlink
  if (existingExtrape && typeof existingExtrape === 'string' && isValidExtrapeUrl(existingExtrape)) {
    return {
      avinashbmv: existingExtrape.trim(),
      avinashbmvINR: cuelinksDeeplink,
      affiliateUrl: cuelinksDeeplink,
      isCuelinks: true,
      hasValidExtrape: true
    };
  }

  // If ExtraPe is missing or invalid, both primary and backup slots use Cuelinks -> ZERO LEADS GO UNTRACKED
  return {
    avinashbmv: cuelinksDeeplink,
    avinashbmvINR: cuelinksDeeplink,
    affiliateUrl: cuelinksDeeplink,
    isCuelinks: true,
    hasValidExtrape: false
  };
}

module.exports = {
  isValidExtrapeUrl,
  verifyExtrapeUrl,
  cleanMerchantUrl,
  buildCuelinksDeeplink,
  convertToCuelinks,
  generateAffiliateLinks
};
