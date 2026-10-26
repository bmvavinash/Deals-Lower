/**
 * services/headlessProductExtractor.js
 * Lightweight, crash-free server-side headless automation for product extraction.
 * Integrates with cuelinksService for Cuelinks API affiliate conversion (similar to lowerdeal.com).
 */

const { resolvePlatformFromUrl } = require('../utils/platformUtils');
const { getformattedDate, cleanProductUrl } = require('../utils/commonUtils');
const { generateAffiliateLinks, cleanMerchantUrl } = require('./cuelinksService');
const { getModuleLogger } = require('../logger/logger');
const updateProduct = require('../database/firebaseDB/firebaseUpdate');

const logger = getModuleLogger('headless-product-extractor');

/**
 * Extracts structured JSON-LD scripts from HTML
 * @param {string} html 
 * @returns {Array<Object>}
 */
function extractJsonLd(html) {
  const scripts = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data)) {
        scripts.push(...data);
      } else {
        scripts.push(data);
      }
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  }
  return scripts;
}

/**
 * Extracts OpenGraph and Meta tags from HTML
 * @param {string} html 
 * @returns {Object}
 */
function extractMetaTags(html) {
  const meta = {};
  const regex = /<meta\b[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const propMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (propMatch && contentMatch) {
      meta[propMatch[1].toLowerCase()] = contentMatch[1];
    }
  }
  return meta;
}

/**
 * Extracts product code for known platforms
 * @param {string} url 
 * @param {string} platform 
 * @returns {string|null}
 */
function extractProductCode(url, platform) {
  if (!url) return null;
  const p = (platform || '').toLowerCase();

  if (p === 'amazon') {
    const asinMatch = url.match(/(?:\/dp\/|\/gp\/product\/|\/asin\/)([A-Z0-9]{10})/i);
    return asinMatch ? asinMatch[1] : null;
  }
  if (p === 'flipkart') {
    const pidMatch = url.match(/[?&]pid=([A-Z0-9]+)/i) || url.match(/\/p\/(itm[a-z0-9]+)/i);
    return pidMatch ? pidMatch[1] : null;
  }
  if (p === 'myntra') {
    const idMatch = url.match(/\/(\d+)\/buy/i) || url.match(/\/(\d+)(?:\?|$)/);
    return idMatch ? idMatch[1] : null;
  }
  if (p === 'ajio') {
    const ajioMatch = url.match(/\/p\/([a-z0-9_]+)/i) || url.match(/([0-9]{9})/);
    return ajioMatch ? ajioMatch[1] : null;
  }

  // Generic fallback
  const genericMatch = url.match(/\/([A-Z0-9_-]{8,})/i);
  return genericMatch ? genericMatch[1] : null;
}

/**
 * Server-side headless automation for extracting and saving products
 * Runs entirely in-memory using lightweight HTTP + metadata + Cuelinks API.
 * Never spawns desktop Chrome or GUI, preventing Render OOM crashes.
 * @param {string} rawUrl - Incoming product URL or shortlink
 * @param {Object} [options={}] - Processing options
 * @returns {Promise<{ success: boolean, productCode?: string, data?: Object, queued?: boolean, message?: string }>}
 */
async function extractProductOnServer(rawUrl, options = {}) {
  const { postProduct = false, saleName = null } = options;

  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Valid product URL is required');
  }

  logger.info('Starting server-side headless product processing', { url: rawUrl });

  // 1. Follow HTTP redirects to resolve canonical merchant URL
  let resolvedUrl = rawUrl;
  let responseHtml = '';
  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      },
      redirect: 'follow'
    });

    resolvedUrl = res.url || rawUrl;
    responseHtml = await res.text();
    logger.info('Resolved URL on server', { original: rawUrl, resolved: resolvedUrl, status: res.status });
  } catch (fetchErr) {
    logger.warn('Failed initial fetch redirect resolution, using raw URL', { error: fetchErr.message });
  }

  // 2. Identify platform and product code
  const platform = resolvePlatformFromUrl(resolvedUrl) || 'amazon';
  const productCode = extractProductCode(resolvedUrl, platform);

  if (!productCode) {
    logger.warn('Could not extract productCode from URL', { url: resolvedUrl, platform });
    return {
      success: false,
      status: 'error',
      message: `Could not identify product code from URL: ${resolvedUrl}`
    };
  }

  // 3. Extract metadata from HTML
  const meta = extractMetaTags(responseHtml);
  const jsonLd = extractJsonLd(responseHtml);
  const productJson = jsonLd.find(j => j['@type'] === 'Product' || j['@type'] === 'IndividualProduct') || {};

  // Extract Title
  let title = productJson.name || meta['og:title'] || meta['twitter:title'] || '';
  if (!title) {
    const titleTagMatch = responseHtml.match(/<title>([^<]+)<\/title>/i);
    if (titleTagMatch) title = titleTagMatch[1].trim();
  }
  // Clean store suffixes from title
  title = title.replace(/\s*\|\s*(Amazon\.in|Flipkart\.com|Myntra|AJIO).*$/i, '').trim();

  // Extract Price
  let price = null;
  if (productJson.offers) {
    if (Array.isArray(productJson.offers)) {
      price = productJson.offers[0]?.price;
    } else {
      price = productJson.offers.price;
    }
  }
  if (!price) {
    price = meta['product:price:amount'] || meta['og:price:amount'];
  }
  if (!price) {
    // Regex fallback for price
    const priceMatch = responseHtml.match(/(?:₹|Rs\.?)\s*([\d,]+)/);
    if (priceMatch) price = priceMatch[1].replace(/,/g, '');
  }

  // Extract Image / Photo
  let photo = '';
  if (productJson.image) {
    photo = Array.isArray(productJson.image) ? productJson.image[0] : productJson.image;
  }
  if (!photo) {
    photo = meta['og:image'] || meta['twitter:image'] || '';
  }

  // Extract Brand
  const brand = productJson.brand?.name || productJson.brand || meta['og:brand'] || '';

  // Extract MRP and calculate discount if available
  let mrp = null;
  let discount = '';
  const mrpMatch = responseHtml.match(/(?:M\.?R\.?P\.?|List Price)\s*:\s*(?:₹|Rs\.?)\s*([\d,]+)/i);
  if (mrpMatch) {
    mrp = mrpMatch[1].replace(/,/g, '');
    if (price && mrp && Number(mrp) > Number(price)) {
      const discPercent = Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100);
      discount = `${discPercent}%`;
    }
  }

  logger.info('Extracted product attributes on server', {
    platform,
    productCode,
    hasTitle: Boolean(title),
    hasPrice: Boolean(price),
    hasPhoto: Boolean(photo)
  });

  // 4. Generate Affiliate Links using Cuelinks API (and Amazon tag for Amazon)
  const affiliateLinks = await generateAffiliateLinks(resolvedUrl, platform, productCode);
  logger.info('Generated affiliate links', { platform, isCuelinks: affiliateLinks.isCuelinks });

  // 5. If title and photo are present, update Firebase directly on the server
  if (title && (photo || price)) {
    const todayDate = getformattedDate();
    const productPayload = {
      productCode,
      title,
      productText: title,
      price: price ? String(price) : '',
      mrp: mrp ? String(mrp) : '',
      discount: discount || '',
      photo: photo || '',
      brand: brand || '',
      productUrl: resolvedUrl,
      url: resolvedUrl,
      storeType: platform,
      links: {
        avinashbmv: affiliateLinks.avinashbmv,
        avinashbmvINR: affiliateLinks.avinashbmvINR
      },
      date: todayDate,
      saleName: saleName || '',
      updatedAt: new Date().toISOString()
    };

    try {
      await updateProduct(productCode, productPayload);
      logger.info('Successfully saved product to Firebase Realtime Database on server', { productCode });

      return {
        success: true,
        status: 'success',
        processedOn: 'server',
        productCode,
        lowerdealUrl: `https://lowerdeal.com/p/${productCode}`,
        affiliateUrl: affiliateLinks.avinashbmv || affiliateLinks.avinashbmvINR || resolvedUrl,
        data: productPayload,
        isCuelinks: affiliateLinks.isCuelinks,
        message: `Product [${platform.toUpperCase()}] ${productCode} processed successfully on server!`
      };
    } catch (dbErr) {
      logger.error('Failed to save product to Firebase', { error: dbErr.message });
      throw dbErr;
    }
  }

  // 6. If lightweight extraction was blocked (e.g. Amazon CAPTCHA challenge), return indication
  logger.warn('Server-side HTTP extraction yielded insufficient attributes; falling back to queue', { productCode });
  return {
    success: false,
    insufficientData: true,
    productCode,
    resolvedUrl,
    platform
  };
}

module.exports = {
  extractProductOnServer,
  extractJsonLd,
  extractMetaTags,
  extractProductCode
};
