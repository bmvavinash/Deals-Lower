/**
 * Resolve ecommerce platform key from a URL (supports short links and marketplaces).
 */
function resolvePlatformFromUrl(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('amazon.') || lower.includes('amzn.')) return 'amazon';
  if (lower.includes('flipkart.') || lower.includes('shopsy.') || lower.includes('fkrt.') || lower.includes('fkrt.co')) return 'flipkart';
  if (lower.includes('ajio.')) return 'ajio';
  if (lower.includes('myntra.') || lower.includes('myntr.')) return 'myntra';
  if (lower.includes('jiomart.') || lower.includes('reliancedigital.') || lower.includes('jio.')) return 'jiomart';
  return null;
}

module.exports = { resolvePlatformFromUrl };
