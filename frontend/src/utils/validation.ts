/**
 * Replicated validation logic from the Affiliate Website
 * This ensures the admin portal accurately identifies which deals are displaying on the site.
 */

const isShortlink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const shortlinkPatterns = [
    /^https?:\/\/amzn\.to\//i,
    /^https?:\/\/fkrt\.it\//i,
    /^https?:\/\/myntra\.ly\//i,
    /^https?:\/\/myntr\.in\//i,
    /^https?:\/\/ajio\.ly\//i,
    /^https?:\/\/bit\.ly\//i,
    /^https?:\/\/tinyurl\.com\//i,
    /^https?:\/\/t\.co\//i,
    /^https?:\/\/short\.link\//i,
    /^https?:\/\/cutt\.ly\//i,
    /^https?:\/\/is\.gd\//i,
    /^https?:\/\/v\.gd\//i,
    /^https?:\/\/fkrt\.co\//i
  ];
  return shortlinkPatterns.some(pattern => pattern.test(url));
};

const isAmazonUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return (url.includes('amazon.in') || url.includes('amazon.com')) && !isShortlink(url);
};

const isAmazonShortlink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return isShortlink(url) && url.includes('amzn.to');
};

const containsPlatformKeywords = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const platformKeywords = ['amazon', 'flipkart', 'myntra', 'ajio'];
  return platformKeywords.some(keyword => url.toLowerCase().includes(keyword));
};

const cleanUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  let cleanedUrl = url.replace(/^@+/, '');
  const doubleWrapperMatch = cleanedUrl.match(/^https?:\/\/inrdeals\.com\/avi646476329\/(https?:\/\/.+)$/);
  if (doubleWrapperMatch) {
    cleanedUrl = doubleWrapperMatch[1];
  }
  return cleanedUrl;
};

const isFullLink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const cleanedUrl = cleanUrl(url);
  if (isShortlink(cleanedUrl)) return false;
  return containsPlatformKeywords(cleanedUrl);
};

const processUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  const cleanedUrl = cleanUrl(url);
  if (isShortlink(cleanedUrl)) return cleanedUrl;
  if (!isFullLink(cleanedUrl)) return cleanedUrl;

  if (isAmazonUrl(cleanedUrl)) {
    if (!cleanedUrl.includes('tag=')) {
      const separator = cleanedUrl.includes('?') ? '&' : '?';
      return `${cleanedUrl}${separator}tag=dealshubglo0c-21`;
    }
    return cleanedUrl;
  } else {
    if (!cleanedUrl.includes('inrdeals.com')) {
      return `http://inrdeals.com/avi646476329/${cleanedUrl}`;
    }
    return cleanedUrl;
  }
};

const extractProductCodeFromUrl = (url: string): string | undefined => {
  try {
    if (!url || typeof url !== 'string') return undefined;
    const match = url.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
    return match && match[1] ? match[1].toUpperCase() : undefined;
  } catch (_) {
    return undefined;
  }
};

const getCanonicalProductCode = (product: any): string | undefined => {
  if (!product) return undefined;
  return (
    product?.productCode ||
    extractProductCodeFromUrl(product?.url) ||
    extractProductCodeFromUrl(product?.productUrl) ||
    extractProductCodeFromUrl(product?.deepLink) ||
    product?.productId ||
    product?.asin ||
    product?.code ||
    product?.id
  );
};

const buildProductUrl = (product: any): string | null => {
  if (!product) return null;
  const urlSources = [
    product.links?.avinashbmv,
    product.links?.avinashbmvINR,
    product.productUrl,
  ];
  
  const existingUrl = urlSources.find(url => url && typeof url === 'string' && url.trim() !== '');
  if (existingUrl) {
    return processUrl(existingUrl);
  }

  const productCode = product.productCode;
  const productUrl = product.productUrl;

  if (!productCode && !productUrl) return null;

  let isAmazon = false;
  let isShortlinkFound = false;

  const allUrls = [
    product.links?.avinashbmv,
    product.links?.avinashbmvINR,
    product.productUrl
  ].filter(url => url && typeof url === 'string' && url.trim() !== '');

  for (const url of allUrls) {
    if (isShortlink(url)) {
      isShortlinkFound = true;
      if (isAmazonShortlink(url)) {
        isAmazon = true;
      }
      break;
    } else if (isAmazonUrl(url)) {
      isAmazon = true;
      break;
    }
  }

  if (isShortlinkFound) {
    const shortlinkUrl = allUrls.find(url => isShortlink(url));
    if (shortlinkUrl) return shortlinkUrl;
  }

  if (isAmazon) {
    if (!productCode) return null;
    return `https://www.amazon.in/dp/${productCode}/?tag=dealshubglo0c-21`;
  } else {
    if (productUrl && typeof productUrl === 'string') {
      const cleanU = productUrl.replace(/^https?:\/\/inrdeals\.com\/avi646476329\//, '');
      return `http://inrdeals.com/avi646476329/${cleanU}`;
    }
    return 'http://inrdeals.com/avi646476329/url';
  }
};

const hasRenderablePrice = (product: any): boolean => {
  if (!product) return false;
  const priceVal = Number(
    product?.price != null ? product.price :
      product?.discountedPrice != null ? product.discountedPrice :
        product?.finalPrice != null ? product.finalPrice : 0
  );
  return !isNaN(priceVal) && priceVal > 0;
};

const hasValidImage = (product: any): boolean => {
  const img = product?.photo || product?.images || product?.image || '';
  return typeof img === 'string' && /^(https?:)?\/\//i.test(img);
};



/**
 * Returns detailed validation object explaining why a product displays or is hidden
 */
export const getValidationDetails = (product: any) => {
  const reasons: string[] = [];
  
  if (!product) {
    return { isValid: false, reasons: ["No product data"] };
  }

  const code = getCanonicalProductCode(product);
  if (!code) reasons.push("Missing valid product code (e.g., ASIN/ID)");

  if (!hasRenderablePrice(product)) reasons.push("Missing renderable price (> 0)");

  if (!hasValidImage(product)) reasons.push("Missing valid image URL");

  const url = buildProductUrl(product);
  
  // If avinashbmv direct link is present, it is considered valid without the inrdeals wrapper
  const hasDirectLink = Boolean(product?.links?.avinashbmv && product.links.avinashbmv.trim() !== '');

  if (!url) {
    reasons.push("Cannot construct product URL (missing base URL or format issues)");
  } else if (url.includes(' ')) {
    reasons.push("Constructed URL contains spaces");
  } else if (!isShortlink(url)) {
    if (isAmazonUrl(url) && !url.includes('tag=')) {
      reasons.push("Amazon URL missing affiliate tag (tag=dealshubglo0c-21)");
    } else if (!isAmazonUrl(url) && !url.includes('inrdeals.com') && !hasDirectLink) {
      reasons.push("Non-Amazon URL missing inrdeals.com wrapper");
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons
  };
};
