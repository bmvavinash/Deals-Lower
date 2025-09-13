const constants = require('../config/constants.js');

function minutesUntil(timestampIso) {
  const ts = typeof timestampIso === 'number' ? timestampIso : Date.parse(timestampIso);
  if (!ts) return Infinity;
  return Math.floor((ts - Date.now()) / (60 * 1000));
}

function isLowStock(stock) {
  const thr = constants.notifications?.lowStockThreshold ?? 2;
  if (typeof stock !== 'number') return false;
  return stock > 0 && stock <= thr;
}

function isExpiringSoon(timerIsoOrMs) {
  const m = minutesUntil(timerIsoOrMs);
  const thr = constants.notifications?.expiryWarnMinutes ?? 30;
  return Number.isFinite(m) && m >= 0 && m <= thr;
}

function isUrgent(product) {
  const low = isLowStock(product?.stock);
  const exp = product?.dealEndAt ? isExpiringSoon(product.dealEndAt) : false;
  return { urgent: !!(low || exp), lowStock: low, expiring: exp };
}

module.exports = { minutesUntil, isLowStock, isExpiringSoon, isUrgent };





