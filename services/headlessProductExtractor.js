/**
 * services/headlessProductExtractor.js
 * Lightweight, crash-free server-side headless automation for product extraction.
 * Uses Cheerio DOM parsing + metadata + Cuelinks API affiliate conversion.
 * Never spawns desktop Chrome GUI, preventing Render OOM crashes.
 */

const cheerio = require('cheerio');
const { resolvePlatformFromUrl } = require('../utils/platformUtils');
const { getformattedDate } = require('../utils/commonUtils');
const { generateAffiliateLinks } = require('./cuelinksService');
const { getModuleLogger } = require('../logger/logger');
const updateProduct = require('../database/firebaseDB/firebaseUpdate');

const logger = getModuleLogger('headless-product-extractor');

// Known bot challenges, firewall blocks, or error titles that indicate extraction failure
const BLOCKED_TITLE_PATTERNS = [
  /^Access Denied/i,
  /^Oops!\s*Something went wrong/i,
  /^Robot Check/i,
  /^Page Not Found/i,
  /^403 Forbidden/i,
  /^404 Not Found/i,
  /Attention Required!\s*\|\s*Cloudflare/i,
  /Just a moment\.\.\./i,
  /Security Verification/i,
  /^Blocked/i,
  /Challenge/i,
  /Online Shopping India\s*\|\s*Buy Mobiles/i
];

/**
 * Checks if HTML or status code indicates merchant bot-block, 403, 404, or error page
 * @param {number} status 
 * @param {string} html 
 * @returns {boolean}
 */
function isMerchantBlockedOrError(status, html) {
  if (status === 403 || status === 401 || status === 503 || status === 404) return true;
  if (!html || typeof html !== 'string') return true;

  // Title-based checks
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  if (BLOCKED_TITLE_PATTERNS.some(regex => regex.test(rawTitle))) return true;

  // Body content-based checks
  const blockedSnippets = [
    "You don't have permission to access",
    "Enter the characters you see below",
    "Reference &#35;18",
    "Reference #18",
    "Your request was blocked",
    "Cloudflare Ray ID",
    "The Web address you entered is not a functioning page",
    "Looking for something?"
  ];
  if (blockedSnippets.some(snippet => html.includes(snippet))) return true;

  return false;
}

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
 * Extracts OpenGraph and Meta tags from Cheerio instance
 * @param {Object} $ - Cheerio loaded instance
 * @returns {Object}
 */
function extractMetaTagsFromCheerio($) {
  const meta = {};
  $('meta').each((i, el) => {
    const prop = $(el).attr('property') || $(el).attr('name') || $(el).attr('itemprop');
    const content = $(el).attr('content');
    if (prop && content) {
      meta[prop.toLowerCase().trim()] = content.trim();
    }
  });
  return meta;
}

/**
 * Cleans and converts raw price string to integer string
 * @param {string|number} raw 
 * @returns {string|null}
 */
function cleanPrice(raw) {
  if (!raw) return null;
  const str = String(raw).replace(/<[^>]*>/g, '').trim();
  // Strip common currency symbols and extract digits
  const cleaned = str.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const beforeDecimal = cleaned.split('.')[0];
  const num = parseInt(beforeDecimal, 10);
  if (isNaN(num) || num <= 0) return null;
  return String(num);
}

/**
 * Extracts product code for known and unknown platforms
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
    const ajioMatch = url.match(/\/p\/([a-z0-9_]+)/i) || url.match(/([0-9]{9}(?:_[a-z0-9]+)?)/i);
    return ajioMatch ? ajioMatch[1] : null;
  }

  // Generic fallback: check pid / id / sku query or path token
  const queryMatch = url.match(/[?&](?:pid|id|sku|productId|item_id)=([A-Z0-9_-]+)/i);
  if (queryMatch) return queryMatch[1];

  const genericMatch = url.match(/\/([A-Z0-9_-]{8,})/i);
  return genericMatch ? genericMatch[1] : null;
}

/**
 * Server-side headless automation for extracting and saving products
 * Runs entirely in-memory using lightweight HTTP + Cheerio + Cuelinks API.
 * Never spawns desktop Chrome GUI, preventing Render OOM crashes.
 * @param {string} rawUrl - Incoming product URL or shortlink
 * @param {Object} [options={}] - Processing options
 * @returns {Promise<{ success: boolean, productCode?: string, data?: Object, lowerdealUrl?: string, message?: string }>}
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
  const detectedInitialPlatform = resolvePlatformFromUrl(rawUrl) || 'amazon';

  // Amazon India responds with full server-side pricing HTML when fetched with mobile browser user-agent
  const userAgent = detectedInitialPlatform === 'amazon'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  let fetchStatus = 200;
  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    });

    fetchStatus = res.status;
    resolvedUrl = res.url || rawUrl;
    responseHtml = await res.text();
    logger.info('Resolved URL on server', { original: rawUrl, resolved: resolvedUrl, status: res.status });
  } catch (fetchErr) {
    logger.warn('Failed initial fetch, using raw URL', { error: fetchErr.message });
  }

  // 2. Identify platform and product code
  const platform = resolvePlatformFromUrl(resolvedUrl) || detectedInitialPlatform || 'unknown';
  let productCode = extractProductCode(resolvedUrl, platform);

  if (!productCode) {
    try {
      const parsed = new URL(resolvedUrl);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      productCode = pathParts[pathParts.length - 1] || `prod-${Date.now()}`;
    } catch {
      productCode = `prod-${Date.now()}`;
    }
  }

  // Check if merchant returned an error, 403, 404, or bot challenge
  if (isMerchantBlockedOrError(fetchStatus, responseHtml)) {
    const errorMsg = fetchStatus === 404 
      ? `Product [${productCode}] was not found or has been removed from ${platform.toUpperCase()}.`
      : `Unable to extract product details from ${platform.toUpperCase()}: Merchant access denied or bot challenge.`;
    
    logger.warn('Product page returned blocked/error response on merchant', {
      url: resolvedUrl,
      productCode,
      status: fetchStatus,
      platform
    });

    return {
      success: false,
      status: 'error',
      productCode,
      platform,
      error: errorMsg,
      message: errorMsg
    };
  }

  // 3. Load HTML into Cheerio
  const $ = cheerio.load(responseHtml || '');

  // Strip navigation, header, footer, search bars to eliminate false-positive prices like "Under ₹500"
  $('header, nav, footer, #nav-main, #navbar-main, .nav-searchbar, select, option, #nav-subnav, #nav-belt, .header-container, #header, #nav-flyout-iss, #nav-flyout-searchAjax, .carousel, .promotions, .banner').remove();

  const meta = extractMetaTagsFromCheerio($);
  const jsonLd = extractJsonLd(responseHtml || '');
  const productJson = jsonLd.find(j => j['@type'] === 'Product' || j['@type'] === 'IndividualProduct') || {};

  // Extract Title
  let title = productJson.name || 
              meta['og:title'] || 
              meta['twitter:title'] || 
              $('#productTitle').text().trim() || 
              $('#title').text().trim() || 
              $('h1._6EBuvT').text().trim() || 
              $('h1.pdp-title').text().trim() || 
              $('h1').first().text().trim() || 
              $('title').text().trim() || 
              '';

  // Clean title suffixes
  title = title.replace(/\s*\|\s*(Amazon\.in|Flipkart\.com|Myntra|AJIO).*$/i, '')
               .replace(/\s*:\s*(Amazon\.in|Flipkart).*$/i, '')
               .replace(/\s*-\s*Buy\s.*$/i, '')
               .trim();

  // Check if title is a blocked/error title that slipped through
  if (BLOCKED_TITLE_PATTERNS.some(r => r.test(title))) {
    const errorMsg = `Unable to extract product details from ${platform.toUpperCase()}: Merchant returned "${title}".`;
    logger.warn('Product title matched block pattern', { productCode, title, platform });
    return {
      success: false,
      status: 'error',
      productCode,
      platform,
      error: errorMsg,
      message: errorMsg
    };
  }

  // Extract Photo / Image
  let photo = '';
  if (productJson.image) {
    photo = Array.isArray(productJson.image) ? productJson.image[0] : productJson.image;
  }
  if (!photo) {
    photo = meta['og:image'] || 
            meta['twitter:image'] || 
            $('#landingImage').attr('src') || 
            $('#main-image').attr('src') || 
            $('img._53J4C-').attr('src') || 
            $('img.image-grid-image').first().attr('src') || 
            $('img[src*="media-amazon.com/images/I/"]').first().attr('src') || 
            $('img[src*="rukminim"]').first().attr('src') || 
            $('img[src*="assets.myntassets.com"]').first().attr('src') || 
            '';
  }

  // Extract Brand
  let brand = productJson.brand?.name || 
              productJson.brand || 
              meta['og:brand'] || 
              meta['product:brand'] || 
              $('#bylineInfo').text().trim() || 
              $('h1.pdp-title').text().trim() || 
              '';
  brand = brand.replace(/^Brand:\s*/i, '').replace(/^Visit the\s*/i, '').replace(/\s*Store$/i, '').trim();

  // --- Out of Stock Detection ---
  const offer = Array.isArray(productJson.offers) ? productJson.offers[0] : (productJson.offers || {});
  const offerAvailability = String(offer?.availability || '').toLowerCase();
  const isJsonLdOOS = offerAvailability.includes('outofstock') || offerAvailability.includes('soldout') || offerAvailability.includes('discontinued');

  const metaAvailability = String(meta['og:availability'] || meta['product:availability'] || meta['availability'] || '').toLowerCase();
  const isMetaOOS = metaAvailability.includes('out of stock') || metaAvailability.includes('oos') || metaAvailability.includes('soldout');

  const isAmazonOOS = platform === 'amazon' && (
    $('#availability').text().includes('Currently unavailable') ||
    $('#availability').text().includes('out of stock') ||
    $('#outOfStock').length > 0 ||
    responseHtml.includes('Currently unavailable.') ||
    responseHtml.includes("We don't know when or if this item will be back in stock.")
  );

  const isFlipkartOOS = platform === 'flipkart' && (
    $('._16FRp0').text().includes('Sold Out') ||
    $('._16FRp0').text().includes('Currently Out of Stock') ||
    responseHtml.includes('Currently Out of Stock') ||
    responseHtml.includes('This item is currently out of stock')
  );

  const isMyntraOOS = platform === 'myntra' && (
    $('.pdp-out-of-stock').length > 0 ||
    $('.pdp-sold-out').length > 0 ||
    responseHtml.includes('This product is currently out of stock') ||
    responseHtml.includes('"availability":"OutOfStock"')
  );

  const isAjioOOS = platform === 'ajio' && (
    $('.out-of-stock').length > 0 ||
    responseHtml.includes('Product is currently out of stock')
  );

  const isOutOfStock = Boolean(isJsonLdOOS || isMetaOOS || isAmazonOOS || isFlipkartOOS || isMyntraOOS || isAjioOOS);

  // Extract Price & MRP based on platform
  let price = null;
  let mrp = null;
  let discount = '';

  if (platform === 'amazon') {
    // Current Selling Price
    const priceRaw = $(
      '#corePriceDisplay_desktop_feature_div .priceToPay span.a-offscreen, ' +
      '#corePriceDisplay_mobile_feature_div .a-offscreen, ' +
      '.priceToPay span.a-offscreen, ' +
      'span.a-price:not(.a-text-price):not(.basisPrice) span.a-offscreen, ' +
      'span.a-price.aok-align-center span.a-offscreen, ' +
      '#apex_desktop .priceToPay span.a-offscreen, ' +
      '#priceblock_ourprice, ' +
      '#priceblock_dealprice'
    ).first().text().trim();
    price = cleanPrice(priceRaw);

    // MRP (List price)
    const mrpRaw = $(
      '#corePriceDisplay_desktop_feature_div .a-text-price span.a-offscreen, ' +
      'span.a-price.a-text-price[data-a-strike="true"] span.a-offscreen, ' +
      'span.a-text-strike, ' +
      'span.basisPrice span.a-offscreen, ' +
      '#corePrice_desktop .a-text-price span.a-offscreen'
    ).first().text().trim();
    mrp = cleanPrice(mrpRaw);

    // Savings percentage
    const discRaw = $('#corePriceDisplay_desktop_feature_div .savingsPercentage, .savingsPercentage').first().text().trim();
    if (discRaw) {
      discount = discRaw.replace(/[^\d%]/g, '');
    }
  } else if (platform === 'flipkart') {
    // Current Selling Price
    const priceRaw = $(
      '.hl05eU .Nx9bqj.CxhGGd, ' +
      '.Nx9bqj.CxhGGd, ' +
      'div._30jeq3._16J0da, ' +
      'div._30jeq3, ' +
      '.Nx9bqj'
    ).first().text().trim();
    price = cleanPrice(priceRaw);

    // MRP
    const mrpRaw = $(
      '.hl05eU .yRaY8j.A6\\+E6v, ' +
      '.yRaY8j, ' +
      'div._3I9_wc._2p6lqe, ' +
      'div._3I9_wc, ' +
      'span[style*="line-through"]'
    ).first().text().trim();
    mrp = cleanPrice(mrpRaw);

    // Discount
    const discRaw = $(
      '.hl05eU .UkUFwK.WW8yVX span, ' +
      '.UkUFwK span, ' +
      'div._3Ay6Sb span'
    ).first().text().trim();
    if (discRaw) {
      discount = discRaw.replace(/[^\d%]/g, '');
    }
  } else if (platform === 'myntra') {
    // Current Selling Price
    const priceRaw = $('span.pdp-price strong, span.pdp-price, .pdp-price').first().text().trim();
    price = cleanPrice(priceRaw);

    // MRP
    const mrpRaw = $('span.pdp-mrp s, span.pdp-mrp, .pdp-mrp').first().text().trim();
    mrp = cleanPrice(mrpRaw);

    // Discount
    const discRaw = $('span.pdp-discount, .pdp-discount').first().text().trim();
    if (discRaw) {
      discount = discRaw.replace(/[^\d%]/g, '');
    }
  }

  // Generic Schema / JSON-LD Fallback for Price & MRP
  if (!price && offer) {
    price = cleanPrice(offer?.price || offer?.lowPrice);
    mrp = cleanPrice(offer?.highPrice);
  }
  if (!price) {
    price = cleanPrice(meta['product:price:amount'] || meta['og:price:amount'] || meta['price']);
  }

  // Calculate discount if MRP and price are available
  if (price && mrp && Number(mrp) > Number(price)) {
    const discPercent = Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100);
    discount = `${discPercent}%`;
  } else if (!mrp && price && discount) {
    const discNum = parseInt(discount.replace(/[^\d]/g, ''), 10);
    if (!isNaN(discNum) && discNum > 0 && discNum < 100) {
      mrp = String(Math.round(Number(price) / (1 - (discNum / 100))));
    }
  }

  // Prevent false-positive price "500" from navigation / coupon promotions
  if (price === '500') {
    const isPromo500 = responseHtml.includes('Under ₹500') || 
                       responseHtml.includes('under-ten-dollars') || 
                       responseHtml.includes('Save ₹500') || 
                       responseHtml.includes('₹500 off');
    if (isPromo500 && (mrp && Number(mrp) > 2000)) {
      logger.warn('Suppressed suspicious promotional ₹500 price', { productCode, mrp });
      price = null;
    }
  }

  // --- Strict Validation of Extracted Details ---
  const isValidTitle = Boolean(title && title.trim().length >= 3 && title !== `Product ${productCode}`);
  const isValidPhoto = Boolean(photo && typeof photo === 'string' && (photo.startsWith('http://') || photo.startsWith('https://')));
  const isValidPrice = Boolean(price && Number(price) > 0);

  const missingFields = [];
  if (!isValidTitle) missingFields.push('title');
  if (!isValidPhoto) missingFields.push('image/photo URL');
  if (!isValidPrice && !isOutOfStock) missingFields.push('price (item is not marked out of stock)');

  if (missingFields.length > 0) {
    const errorMsg = `Unable to extract product details for [${productCode}] on ${platform.toUpperCase()}: Missing ${missingFields.join(', ')}.`;
    logger.warn('Server headless extraction failed validation', {
      productCode,
      platform,
      missingFields,
      isOutOfStock,
      hasTitle: isValidTitle,
      hasPhoto: isValidPhoto,
      hasPrice: isValidPrice
    });

    return {
      success: false,
      status: 'error',
      productCode,
      platform,
      outOfStock: isOutOfStock,
      error: errorMsg,
      message: errorMsg
    };
  }

  logger.info('Extracted product attributes on server successfully', {
    platform,
    productCode,
    title,
    price: price || 'N/A',
    mrp: mrp || 'N/A',
    discount: discount || 'N/A',
    hasPhoto: Boolean(photo),
    isOutOfStock
  });

  // 4. Generate Affiliate Links using Cuelinks API (and Amazon tag for Amazon)
  let affiliateLinks = { avinashbmv: resolvedUrl, avinashbmvINR: resolvedUrl, isCuelinks: false };
  try {
    affiliateLinks = await generateAffiliateLinks(resolvedUrl, platform, productCode);
    logger.info('Generated affiliate links', { platform, isCuelinks: affiliateLinks.isCuelinks });
  } catch (affErr) {
    logger.warn('Affiliate link generation deferred/fallback used', { error: affErr.message });
  }

  // 5. Persist validated product to Firebase Realtime Database
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
    inStock: !isOutOfStock,
    outOfStock: isOutOfStock,
    availability: isOutOfStock ? 'OutOfStock' : 'InStock',
    productStatus: isOutOfStock ? 'outOfStock' : 'active',
    links: {
      avinashbmv: affiliateLinks.avinashbmv || resolvedUrl,
      avinashbmvINR: affiliateLinks.avinashbmvINR || resolvedUrl
    },
    date: todayDate,
    saleName: saleName || '',
    updatedAt: new Date().toISOString()
  };

  try {
    await updateProduct(productCode, productPayload);
    logger.info('Successfully saved validated product to Firebase Realtime Database on server', { productCode, isOutOfStock });

    return {
      success: true,
      status: 'success',
      processedOn: 'server',
      productCode,
      lowerdealUrl: `https://lowerdeal.com/p/${productCode}`,
      affiliateUrl: affiliateLinks.avinashbmv || affiliateLinks.avinashbmvINR || resolvedUrl,
      data: productPayload,
      outOfStock: isOutOfStock,
      inStock: !isOutOfStock,
      availability: isOutOfStock ? 'OutOfStock' : 'InStock',
      isCuelinks: affiliateLinks.isCuelinks,
      message: isOutOfStock
        ? `Product [${platform.toUpperCase()}] ${productCode} processed successfully (⚠️ Currently Out of Stock)!`
        : `Product [${platform.toUpperCase()}] ${productCode} processed successfully on server!`
    };
  } catch (dbErr) {
    logger.error('Failed to save product to Firebase', { error: dbErr.message });
    throw dbErr;
  }
}

module.exports = {
  extractProductOnServer,
  extractJsonLd,
  cleanPrice,
  extractProductCode
};
