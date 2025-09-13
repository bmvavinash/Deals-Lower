/**
 * Enhanced change detection utilities for product data comparison
 * Focuses on critical fields: price, mrp, discount, and other important attributes
 */

const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('changeDetection');

/**
 * Critical fields that should trigger updates when changed
 */
const CRITICAL_FIELDS = [
  'price', 'mrp', 'discount', 'offerPrice', 'isDeal', 'isOffer', 
  'isOutOfStock', 'rating', 'ratingsCount', 'reviewsCount'
];

/**
 * Secondary fields that are important but less critical
 */
const SECONDARY_FIELDS = [
  'title', 'brand', 'category', 'images', 'photo', 'productUrl',
  'offers', 'promoInfo', 'extraOffers', 'seller'
];

/**
 * Fields that should be ignored for change detection
 */
const IGNORED_FIELDS = [
  'updateTimestamp', 'updatedatetime', 'createdAt', 'date', 'datetime',
  'lastChecked', 'checkCount'
];

/**
 * Compare two product objects and return detailed change information
 * @param {Object} oldProduct - Existing product data
 * @param {Object} newProduct - New product data
 * @returns {Object} Change detection result
 */
function detectChanges(oldProduct, newProduct) {
  if (!oldProduct || !newProduct) {
    return {
      hasChanges: true,
      changeType: 'new_or_missing',
      criticalChanges: [],
      secondaryChanges: [],
      allChanges: []
    };
  }

  const criticalChanges = [];
  const secondaryChanges = [];
  const allChanges = [];

  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldProduct || {}),
    ...Object.keys(newProduct || {})
  ]);

  for (const key of allKeys) {
    // Skip ignored fields
    if (IGNORED_FIELDS.includes(key)) continue;

    const oldValue = oldProduct[key];
    const newValue = newProduct[key];

    // Normalize values for comparison
    const oldNormalized = normalizeValue(oldValue);
    const newNormalized = normalizeValue(newValue);

    if (oldNormalized !== newNormalized) {
      const change = {
        field: key,
        oldValue: oldValue,
        newValue: newValue,
        oldNormalized: oldNormalized,
        newNormalized: newNormalized
      };

      allChanges.push(change);

      if (CRITICAL_FIELDS.includes(key)) {
        criticalChanges.push(change);
      } else if (SECONDARY_FIELDS.includes(key)) {
        secondaryChanges.push(change);
      }
    }
  }

  const hasChanges = allChanges.length > 0;
  const hasCriticalChanges = criticalChanges.length > 0;

  return {
    hasChanges,
    hasCriticalChanges,
    changeType: hasCriticalChanges ? 'critical' : hasChanges ? 'secondary' : 'none',
    criticalChanges,
    secondaryChanges,
    allChanges,
    changeCount: allChanges.length,
    criticalChangeCount: criticalChanges.length
  };
}

/**
 * Normalize values for comparison
 * @param {any} value - Value to normalize
 * @returns {string} Normalized string representation
 */
function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value.sort());
  if (typeof value === 'object') return JSON.stringify(value, Object.keys(value).sort());
  return String(value);
}

/**
 * Check if changes are significant enough to warrant an update
 * @param {Object} changeResult - Result from detectChanges
 * @param {Object} options - Options for significance check
 * @returns {boolean} Whether changes are significant
 */
function areChangesSignificant(changeResult, options = {}) {
  const {
    requireCriticalChanges = false,
    minChangeThreshold = 0,
    ignorePriceFluctuations = true,
    priceFluctuationThreshold = 0.05 // 5%
  } = options;

  if (!changeResult.hasChanges) return false;

  // If critical changes are required and none exist, not significant
  if (requireCriticalChanges && !changeResult.hasCriticalChanges) {
    return false;
  }

  // Check minimum change threshold
  if (changeResult.changeCount < minChangeThreshold) {
    return false;
  }

  // Check for price fluctuations that might be insignificant
  if (ignorePriceFluctuations) {
    const priceChanges = changeResult.criticalChanges.filter(change => 
      ['price', 'mrp', 'offerPrice'].includes(change.field)
    );

    for (const priceChange of priceChanges) {
      const oldPrice = parseFloat(priceChange.oldValue) || 0;
      const newPrice = parseFloat(priceChange.newValue) || 0;
      
      if (oldPrice > 0 && newPrice > 0) {
        const fluctuation = Math.abs(newPrice - oldPrice) / oldPrice;
        if (fluctuation < priceFluctuationThreshold) {
          logger.info(`Price fluctuation below threshold: ${fluctuation.toFixed(3)} < ${priceFluctuationThreshold}`, {
            field: priceChange.field,
            oldPrice,
            newPrice
          });
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Generate a summary of changes for logging
 * @param {Object} changeResult - Result from detectChanges
 * @returns {string} Human-readable change summary
 */
function generateChangeSummary(changeResult) {
  if (!changeResult.hasChanges) {
    return 'No changes detected';
  }

  const parts = [];
  
  if (changeResult.criticalChangeCount > 0) {
    parts.push(`${changeResult.criticalChangeCount} critical changes`);
  }
  
  if (changeResult.secondaryChanges.length > 0) {
    parts.push(`${changeResult.secondaryChanges.length} secondary changes`);
  }

  const summary = parts.join(', ');
  
  // Add specific field changes for critical fields
  const criticalFields = changeResult.criticalChanges.map(c => c.field).join(', ');
  if (criticalFields) {
    return `${summary} (${criticalFields})`;
  }
  
  return summary;
}

/**
 * Log change detection results
 * @param {string} productCode - Product identifier
 * @param {Object} changeResult - Result from detectChanges
 * @param {Object} options - Logging options
 */
function logChanges(productCode, changeResult, options = {}) {
  const { logLevel = 'info', includeDetails = false } = options;
  
  const summary = generateChangeSummary(changeResult);
  
  const logData = {
    productCode,
    changeType: changeResult.changeType,
    changeCount: changeResult.changeCount,
    criticalChangeCount: changeResult.criticalChangeCount,
    summary
  };

  if (includeDetails && changeResult.hasChanges) {
    logData.criticalChanges = changeResult.criticalChanges.map(c => ({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue
    }));
  }

  logger[logLevel](`Product ${productCode}: ${summary}`, logData);
}

module.exports = {
  detectChanges,
  areChangesSignificant,
  generateChangeSummary,
  logChanges,
  CRITICAL_FIELDS,
  SECONDARY_FIELDS,
  IGNORED_FIELDS
};



