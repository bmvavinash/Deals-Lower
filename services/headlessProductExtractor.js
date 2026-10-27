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
    const ajioMatch = url.match(/\/p\/([a-z0-9_]+)/i) || url.match(/([0-9]{9})/);
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
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    resolvedUrl = res.url || rawUrl;
    responseHtml = await res.text();
    logger.info('Resolved URL on server', { original: rawUrl, resolved: resolvedUrl, status: res.status });

    // Check if the merchant returned 404 or Page Not Found
    const isPageNotFound = res.status === 404 || 
                           responseHtml.includes('Page Not Found') || 
                           responseHtml.includes('Looking for something?') ||
                           responseHtml.includes('The Web address you entered is not a functioning page');
    if (isPageNotFound) {
      const pCode = extractProductCode(resolvedUrl, detectedInitialPlatform) || 'unknown';
      logger.warn('Product page returned 404 or Page Not Found on merchant', { url: resolvedUrl, productCode: pCode });
      return {
        success: false,
        status: 'error',
        productCode: pCode,
        message: `Product [${pCode}] was not found or has been removed from ${detectedInitialPlatform}.`
      };
    }
  } catch (fetchErr) {
    logger.warn('Failed initial fetch redirect resolution, using raw URL', { error: fetchErr.message });
  }

  // 2. Identify platform and product code
  const platform = resolvePlatformFromUrl(resolvedUrl) || detectedInitialPlatform || 'unknown';
  let productCode = extractProductCode(resolvedUrl, platform);

  if (!productCode) {
    // Generate deterministic fallback code if URL doesn't have standard pattern
    try {
      const parsed = new URL(resolvedUrl);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      productCode = pathParts[pathParts.length - 1] || `prod-${Date.now()}`;
    } catch {
      productCode = `prod-${Date.now()}`;
    }
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
  if (!price && productJson.offers) {
    const offer = Array.isArray(productJson.offers) ? productJson.offers[0] : productJson.offers;
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
    // Infer MRP if discount is available
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
      // Suspect false 500 price on a high-value product (e.g. iPhone, Samsung, Premium Luggage)
      logger.warn('Suppressed suspicious promotional ₹500 price', { productCode, mrp });
      price = null;
    }
  }

  logger.info('Extracted product attributes on server', {
    platform,
    productCode,
    hasTitle: Boolean(title),
    price: price || 'N/A',
    mrp: mrp || 'N/A',
    discount: discount || 'N/A',
    hasPhoto: Boolean(photo)
  });

  // 4. Generate Affiliate Links using Cuelinks API (and Amazon tag for Amazon)
  let affiliateLinks = { avinashbmv: resolvedUrl, avinashbmvINR: resolvedUrl, isCuelinks: false };
  try {
    affiliateLinks = await generateAffiliateLinks(resolvedUrl, platform, productCode);
    logger.info('Generated affiliate links', { platform, isCuelinks: affiliateLinks.isCuelinks });
  } catch (affErr) {
    logger.warn('Affiliate link generation deferred/fallback used', { error: affErr.message });
  }

  // 5. Always persist product to Firebase Realtime Database
  // Do NOT block or require local browser daemon even if some fields are missing.
  // lowerdeal.com queue links API handles async enrichment.
  const todayDate = getformattedDate();
  const productPayload = {
    productCode,
    title: title || `Product ${productCode}`,
    productText: title || `Product ${productCode}`,
    price: price ? String(price) : '',
    mrp: mrp ? String(mrp) : '',
    discount: discount || '',
    photo: photo || '',
    brand: brand || '',
    productUrl: resolvedUrl,
    url: resolvedUrl,
    storeType: platform,
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

module.exports = {
  extractProductOnServer,
  extractJsonLd,
  cleanPrice,
  extractProductCode
};
