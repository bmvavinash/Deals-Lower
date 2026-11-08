/**
 * services/productNumberService.js
 * 
 * Provides unique, sequential product number generation and indexing across all products.
 * Solves non-clickable YouTube / social links by generating a clean numeric identifier (e.g. 1001, 1042)
 * that viewers can easily type into the search bar or dedicated product number search page.
 * 
 * Firebase Realtime Database Data Model:
 * - /counters/lastProductNumber : Integer counter (starts at 1000; first assigned is 1001)
 * - /productNumbers/${num}      : { productCode, productNumber, storeType, title, price, dealUrl, assignedAt }
 * - /productCodeToNumber/${code}: num
 * - /deals/${code}/productNumber: num
 */

const admin = require('firebase-admin');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('productNumberService');

/**
 * Retrieves existing productNumber or allocates a new unique sequential number.
 * Thread-safe and atomic via Firebase RTDB transaction.
 * 
 * @param {string} productCode - Clean product identifier (e.g. ASIN, Flipkart PID)
 * @param {Object} metadata - Optional title, price, storeType for reverse index record
 * @returns {Promise<number|null>} - Unique product number
 */
async function getOrCreateProductNumber(productCode, metadata = {}) {
  if (!productCode) return null;
  const cleanCode = String(productCode).trim();
  if (!cleanCode) return null;

  if (!admin.apps.length) {
    logger.warn('Firebase Admin not initialized, cannot allocate productNumber');
    return null;
  }

  const db = admin.database();

  try {
    // 1. Check if mapping already exists in /productCodeToNumber/${cleanCode}
    const mappingSnap = await db.ref(`productCodeToNumber/${cleanCode}`).once('value');
    if (mappingSnap.exists() && mappingSnap.val()) {
      const existingNum = Number(mappingSnap.val());
      if (!isNaN(existingNum) && existingNum > 0) {
        return existingNum;
      }
    }

    // 2. Check if the deal itself already has productNumber in /deals/${cleanCode}
    const dealSnap = await db.ref(`deals/${cleanCode}/productNumber`).once('value');
    if (dealSnap.exists() && dealSnap.val()) {
      const existingNum = Number(dealSnap.val());
      if (!isNaN(existingNum) && existingNum > 0) {
        // Backfill reverse index mappings
        await Promise.all([
          db.ref(`productCodeToNumber/${cleanCode}`).set(existingNum),
          db.ref(`productNumbers/${existingNum}`).update({
            productCode: cleanCode,
            productNumber: existingNum,
            storeType: metadata.storeType || metadata.platform || '',
            title: metadata.title || '',
            price: metadata.price || null,
            updatedAt: new Date().toISOString()
          })
        ]);
        return existingNum;
      }
    }

    // 3. Atomically allocate next sequential product number
    const counterRef = db.ref('counters/lastProductNumber');
    const tx = await counterRef.transaction((current) => {
      // Start from 1000 so the first assigned number is 1001
      if (!current || typeof current !== 'number' || current < 1000) {
        return 1001;
      }
      return current + 1;
    });

    if (!tx.committed || !tx.snapshot.exists()) {
      throw new Error('Transaction was not committed for lastProductNumber');
    }

    const assignedNumber = tx.snapshot.val();

    // 4. Persist bidirectional index and metadata
    const indexData = {
      productCode: cleanCode,
      productNumber: assignedNumber,
      storeType: metadata.storeType || metadata.platform || '',
      title: metadata.title || '',
      price: metadata.price || null,
      dealUrl: metadata.dealUrl || metadata.lowerdealUrl || `https://lowerdeal.com/p/${cleanCode}`,
      assignedAt: new Date().toISOString()
    };

    await Promise.all([
      db.ref(`productNumbers/${assignedNumber}`).set(indexData),
      db.ref(`productCodeToNumber/${cleanCode}`).set(assignedNumber),
      db.ref(`deals/${cleanCode}/productNumber`).set(assignedNumber)
    ]);

    logger.info(`✅ Assigned new unique productNumber #${assignedNumber} to [${cleanCode}]`, {
      productCode: cleanCode,
      productNumber: assignedNumber,
      title: metadata.title?.slice(0, 50)
    });

    return assignedNumber;
  } catch (err) {
    logger.error(`Failed to get or create productNumber for [${cleanCode}]`, { error: err.message });
    return null;
  }
}

/**
 * Resolves a product record by its unique productNumber.
 * 
 * @param {string|number} productNumber - The product number (e.g. 1042 or "#1042")
 * @returns {Promise<Object|null>} - Deal object or null
 */
async function getProductByNumber(productNumber) {
  if (!productNumber) return null;
  const num = parseInt(String(productNumber).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num <= 0) return null;

  if (!admin.apps.length) return null;
  const db = admin.database();

  try {
    // 1. Direct O(1) index lookup via /productNumbers/${num}
    const numSnap = await db.ref(`productNumbers/${num}`).once('value');
    if (numSnap.exists() && numSnap.val()) {
      const { productCode } = numSnap.val();
      if (productCode) {
        const dealSnap = await db.ref(`deals/${productCode}`).once('value');
        if (dealSnap.exists()) {
          const dealData = dealSnap.val();
          return {
            ...dealData,
            productCode,
            productNumber: num,
            lowerdealUrl: `https://lowerdeal.com/p/${productCode}`
          };
        }
      }
    }

    // 2. Fallback query /deals by orderByChild('productNumber')
    const querySnap = await db.ref('deals').orderByChild('productNumber').equalTo(num).limitToFirst(1).once('value');
    if (querySnap.exists()) {
      const deals = querySnap.val();
      const [pCode, deal] = Object.entries(deals)[0];
      return {
        ...deal,
        productCode: deal.productCode || pCode,
        productNumber: num,
        lowerdealUrl: `https://lowerdeal.com/p/${deal.productCode || pCode}`
      };
    }

    return null;
  } catch (err) {
    logger.error(`Error resolving product by number #${num}`, { error: err.message });
    return null;
  }
}

module.exports = {
  getOrCreateProductNumber,
  getProductByNumber
};
