/**
 * Firebase Database Handler for News and Reviews
 * Stores news articles and product reviews from 91mobile
 */

// Load environment variables from .env file FIRST - before any other requires
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed or .env not found, continue without it
}

const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require('../../logger/logger');

const logger = getModuleLogger('newsReviewsDB');

// Database configuration - reads from .env file first, then config, then defaults
// User will add the actual values in .env file
// NEWS_DB_NAME should be just the database name (e.g., "deals-backend-paapi")
// The full URL will be automatically constructed as: https://{NEWS_DB_NAME}-default-rtdb.firebaseio.com
const NEWS_DB_NAME = process.env.NEWS_DB_NAME || config.DATABASE_CONFIG?.NEWS_DB_NAME || 'news-reviews';
const NEWS_DB_TOKEN_FILE = process.env.NEWS_DB_TOKEN_FILE || config.DATABASE_CONFIG?.NEWS_DB_TOKEN_FILE || 'news-reviews-firebase-adminsdk';

// Log the configuration being used for debugging
logger.info('News DB configuration loaded', { 
  NEWS_DB_NAME, 
  NEWS_DB_TOKEN_FILE,
  fromEnv: !!process.env.NEWS_DB_NAME,
  envValue: process.env.NEWS_DB_NAME
});

let newsDb = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK for News/Reviews database
 */
function initializeNewsDB() {
  if (isInitialized) {
    return newsDb;
  }

  try {
    const serviceAccountPath = `${constants.pathToFile}/${NEWS_DB_TOKEN_FILE}.json`;
    let serviceAccount;
    
    try {
      serviceAccount = require(serviceAccountPath);
      logger.info('News DB service account file found', { path: serviceAccountPath });
    } catch (error) {
      logger.warn('News DB service account file not found, using default DB', { 
        path: serviceAccountPath,
        error: error.message 
      });
      // Fallback to default database structure
      try {
        const dbname = constants.postingTypesConfig[constants.type]?.DB || 'DB1Backup';
        const defaultDBName = config.DATABASE_CONFIG[`${dbname}_NAME`];
        const defaultTokenFile = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
        
        if (!defaultTokenFile) {
          throw new Error(`No fallback token file configured for ${dbname}`);
        }
        
        const fallbackPath = `${constants.pathToFile}/${defaultTokenFile}.json`;
        serviceAccount = require(fallbackPath);
        const fallbackDbName = defaultDBName || 'avideals1';
        
        logger.info('Using fallback database', { dbName: fallbackDbName, tokenFile: defaultTokenFile });
        
        // Initialize with fallback
        if (!admin.apps.find(app => app.name === 'news-reviews')) {
          // Try default region first, fallback to asia-southeast1 if needed
          const fallbackUrl = `https://${fallbackDbName}-default-rtdb.firebaseio.com`;
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: fallbackUrl
          }, 'news-reviews');
        }
        
        newsDb = admin.app('news-reviews').database();
        isInitialized = true;
        logger.info('News DB initialized with fallback database', { dbName: fallbackDbName });
        return newsDb;
      } catch (fallbackError) {
        logger.error('Fallback database initialization failed', { 
          error: fallbackError.message
        });
        // Don't throw - allow module to load, but DB operations will fail
        throw new Error(`Failed to initialize News DB: ${fallbackError.message}`);
      }
    }

    // Initialize with provided service account
    if (!admin.apps.find(app => app.name === 'news-reviews')) {
      // Use default region URL format (Firebase will redirect if needed)
      const dbUrl = `https://${NEWS_DB_NAME}-default-rtdb.firebaseio.com`;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: dbUrl
      }, 'news-reviews');
      logger.info('Initializing with database URL', { dbUrl, dbName: NEWS_DB_NAME });
    }

    newsDb = admin.app('news-reviews').database();
    isInitialized = true;
    logger.info('News DB initialized successfully', { dbName: NEWS_DB_NAME });
    return newsDb;

  } catch (error) {
    logger.error('Error initializing News DB', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get database reference
 * Automatically initializes if not already initialized
 * This is lazy initialization - module can load even if service account is missing
 */
function getDB() {
  if (!isInitialized) {
    try {
      return initializeNewsDB();
    } catch (error) {
      logger.error('Failed to initialize database in getDB()', { error: error.message });
      throw error;
    }
  }
  return newsDb;
}

/**
 * Get reference to news collection
 */
function getNewsRef() {
  const db = getDB();
  logger.debug('Getting news reference', { dbName: NEWS_DB_NAME });
  return db.ref('news');
}

/**
 * Get reference to reviews collection
 */
function getReviewsRef() {
  return getDB().ref('reviews');
}

/**
 * Sanitize key for Firebase (remove invalid characters)
 */
function sanitizeKey(key) {
  return String(key).replace(/[.#$/\[\]]/g, '_');
}

/**
 * Store or update a news article
 * @param {Object} newsData - News article data
 * @returns {Promise<Object>} Result with created/updated status
 */
async function upsertNews(newsData) {
  try {
    if (!newsData || !newsData.id) {
      throw new Error('News data must have an id');
    }

    const safeKey = sanitizeKey(newsData.id);
    const newsRef = getNewsRef().child(safeKey);

    // Check if exists
    const snapshot = await newsRef.once('value');
    const existing = snapshot.val();

    const updateData = {
      ...newsData,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      // Update existing
      updateData.createdAt = existing.createdAt || new Date().toISOString();
      await newsRef.update(updateData);
      logger.info('News article updated', { id: newsData.id, key: safeKey });
      return { created: false, updated: true, key: safeKey, data: updateData };
    } else {
      // Create new
      updateData.createdAt = new Date().toISOString();
      await newsRef.set(updateData);
      logger.info('News article created', { id: newsData.id, key: safeKey });
      return { created: true, updated: false, key: safeKey, data: updateData };
    }

  } catch (error) {
    logger.error('Error upserting news', { error: error.message, newsId: newsData?.id });
    throw error;
  }
}

/**
 * Store or update a review article
 * @param {Object} reviewData - Review article data
 * @returns {Promise<Object>} Result with created/updated status
 */
async function upsertReview(reviewData) {
  try {
    if (!reviewData || !reviewData.id) {
      throw new Error('Review data must have an id');
    }

    const safeKey = sanitizeKey(reviewData.id);
    const reviewsRef = getReviewsRef().child(safeKey);

    // Check if exists
    const snapshot = await reviewsRef.once('value');
    const existing = snapshot.val();

    const updateData = {
      ...reviewData,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      // Update existing
      updateData.createdAt = existing.createdAt || new Date().toISOString();
      await reviewsRef.update(updateData);
      logger.info('Review article updated', { id: reviewData.id, key: safeKey });
      return { created: false, updated: true, key: safeKey, data: updateData };
    } else {
      // Create new
      updateData.createdAt = new Date().toISOString();
      await reviewsRef.set(updateData);
      logger.info('Review article created', { id: reviewData.id, key: safeKey });
      return { created: true, updated: false, key: safeKey, data: updateData };
    }

  } catch (error) {
    logger.error('Error upserting review', { error: error.message, reviewId: reviewData?.id });
    throw error;
  }
}

/**
 * Bulk upsert news articles
 * @param {Array<Object>} newsArray - Array of news article data
 * @returns {Promise<Object>} Summary of operations
 */
async function bulkUpsertNews(newsArray) {
  try {
    const results = {
      total: newsArray.length,
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: []
    };

    for (const newsData of newsArray) {
      try {
        const result = await upsertNews(newsData);
        if (result.created) results.created++;
        if (result.updated) results.updated++;
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          id: newsData?.id,
          error: error.message
        });
        logger.error('Error in bulk upsert news item', { id: newsData?.id, error: error.message });
      }
    }

    logger.info('Bulk upsert news completed', { 
      ...results, 
      dbName: NEWS_DB_NAME,
      storagePath: 'news'
    });
    return results;

  } catch (error) {
    logger.error('Error in bulk upsert news', { error: error.message });
    throw error;
  }
}

/**
 * Bulk upsert review articles
 * @param {Array<Object>} reviewsArray - Array of review article data
 * @returns {Promise<Object>} Summary of operations
 */
async function bulkUpsertReviews(reviewsArray) {
  try {
    const results = {
      total: reviewsArray.length,
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: []
    };

    for (const reviewData of reviewsArray) {
      try {
        const result = await upsertReview(reviewData);
        if (result.created) results.created++;
        if (result.updated) results.updated++;
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          id: reviewData?.id,
          error: error.message
        });
        logger.error('Error in bulk upsert review item', { id: reviewData?.id, error: error.message });
      }
    }

    logger.info('Bulk upsert reviews completed', results);
    return results;

  } catch (error) {
    logger.error('Error in bulk upsert reviews', { error: error.message });
    throw error;
  }
}

/**
 * Get news articles with pagination
 * @param {Object} options - Query options (limit, offset, category, etc.)
 * @returns {Promise<Object>} News articles and pagination info
 */
async function getNews(options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      category = null,
      sortBy = 'publishDate',
      order = 'desc'
    } = options;

    let query = getNewsRef().orderByChild(sortBy);

    if (order === 'desc') {
      query = query.limitToLast(limit + offset);
    } else {
      query = query.limitToFirst(limit + offset);
    }

    const snapshot = await query.once('value');
    const data = snapshot.val() || {};
    let articles = Object.values(data);

    // Filter by category if provided
    if (category) {
      articles = articles.filter(article => 
        article.category && article.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Sort
    articles.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (order === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });

    // Apply pagination
    const paginated = articles.slice(offset, offset + limit);

    return {
      data: paginated,
      pagination: {
        total: articles.length,
        limit,
        offset,
        hasMore: offset + limit < articles.length
      }
    };

  } catch (error) {
    logger.error('Error getting news', { error: error.message });
    throw error;
  }
}

/**
 * Get review articles with pagination
 * @param {Object} options - Query options (limit, offset, productName, etc.)
 * @returns {Promise<Object>} Review articles and pagination info
 */
async function getReviews(options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      productName = null,
      minRating = null,
      sortBy = 'publishDate',
      order = 'desc'
    } = options;

    let query = getReviewsRef().orderByChild(sortBy);

    if (order === 'desc') {
      query = query.limitToLast(limit + offset);
    } else {
      query = query.limitToFirst(limit + offset);
    }

    const snapshot = await query.once('value');
    const data = snapshot.val() || {};
    let reviews = Object.values(data);

    // Filter by product name if provided
    if (productName) {
      reviews = reviews.filter(review => 
        review.productName && review.productName.toLowerCase().includes(productName.toLowerCase())
      );
    }

    // Filter by minimum rating if provided
    if (minRating !== null) {
      reviews = reviews.filter(review => review.rating && review.rating >= minRating);
    }

    // Sort
    reviews.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (order === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });

    // Apply pagination
    const paginated = reviews.slice(offset, offset + limit);

    return {
      data: paginated,
      pagination: {
        total: reviews.length,
        limit,
        offset,
        hasMore: offset + limit < reviews.length
      }
    };

  } catch (error) {
    logger.error('Error getting reviews', { error: error.message });
    throw error;
  }
}

/**
 * Get a single news article by ID
 * @param {string} id - News article ID
 * @returns {Promise<Object|null>} News article or null
 */
async function getNewsById(id) {
  try {
    const safeKey = sanitizeKey(id);
    const snapshot = await getNewsRef().child(safeKey).once('value');
    return snapshot.val();
  } catch (error) {
    logger.error('Error getting news by ID', { id, error: error.message });
    throw error;
  }
}

/**
 * Get a single review article by ID
 * @param {string} id - Review article ID
 * @returns {Promise<Object|null>} Review article or null
 */
async function getReviewById(id) {
  try {
    const safeKey = sanitizeKey(id);
    const snapshot = await getReviewsRef().child(safeKey).once('value');
    return snapshot.val();
  } catch (error) {
    logger.error('Error getting review by ID', { id, error: error.message });
    throw error;
  }
}

// Explicit exports at the end
module.exports = {
  initializeNewsDB,
  getDB,
  getNewsRef,
  getReviewsRef,
  upsertNews,
  upsertReview,
  bulkUpsertNews,
  bulkUpsertReviews,
  getNews,
  getReviews,
  getNewsById,
  getReviewById
};
