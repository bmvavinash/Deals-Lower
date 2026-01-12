/**
 * API Routes for News and Reviews from 91mobile
 */

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const express = require('express');
const router = express.Router();
const { getModuleLogger } = require('../../../logger/logger');
const { scrape91Mobile } = require('../../../scripts/scrape91Mobile');
const {
  getNews,
  getReviews,
  getNewsById,
  getReviewById,
  upsertNews,
  upsertReview
} = require('../../../database/firebaseDB/newsReviewsDB');
const cacheService = require('../../../services/cacheService');

const logger = getModuleLogger('newsAPI');

/**
 * GET /api/news
 * Get news articles with pagination and filters
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      limit = 50,
      offset = 0,
      category = null,
      sortBy = 'publishDate',
      order = 'desc'
    } = req.query;

    // Check cache
    const cacheKey = `news_${limit}_${offset}_${category || 'all'}_${sortBy}_${order}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached news');
      return res.json(cached);
    }

    // Initialize DB if needed
    try {
      const { initializeNewsDB } = require('../../../database/firebaseDB/newsReviewsDB');
      initializeNewsDB();
    } catch (initError) {
      logger.warn('News DB initialization failed, returning empty result', { error: initError.message });
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false
        }
      });
    }

    const result = await getNews({
      limit: parseInt(limit),
      offset: parseInt(offset),
      category: category || null,
      sortBy,
      order
    });

    const response = {
      success: true,
      data: result.data || [],
      pagination: result.pagination || {
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      }
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching news', { error: error.message, stack: error.stack });
    // Return empty result instead of error to prevent 404
    res.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        hasMore: false
      }
    });
  }
});

/**
 * GET /api/news/:id
 * Get a single news article by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `news_${id}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const news = await getNewsById(id);

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    const response = {
      success: true,
      data: news
    };

    // Cache for 10 minutes
    cacheService.set(cacheKey, response, 600);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching news by ID', { id: req.params.id, error: error.message });
    next(error);
  }
});

/**
 * GET /api/reviews
 * Get review articles with pagination and filters
 */
router.get('/reviews', async (req, res, next) => {
  try {
    const {
      limit = 50,
      offset = 0,
      productName = null,
      minRating = null,
      sortBy = 'publishDate',
      order = 'desc'
    } = req.query;

    // Check cache
    const cacheKey = `reviews_${limit}_${offset}_${productName || 'all'}_${minRating || 'all'}_${sortBy}_${order}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached reviews');
      return res.json(cached);
    }

    // Initialize DB if needed
    try {
      const { initializeNewsDB } = require('../../../database/firebaseDB/newsReviewsDB');
      initializeNewsDB();
    } catch (initError) {
      logger.warn('News DB initialization failed, returning empty result', { error: initError.message });
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false
        }
      });
    }

    const result = await getReviews({
      limit: parseInt(limit),
      offset: parseInt(offset),
      productName: productName || null,
      minRating: minRating ? parseFloat(minRating) : null,
      sortBy,
      order
    });

    const response = {
      success: true,
      data: result.data || [],
      pagination: result.pagination || {
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      }
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching reviews', { error: error.message, stack: error.stack });
    // Return empty result instead of error to prevent 404
    res.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        hasMore: false
      }
    });
  }
});

/**
 * GET /api/reviews/:id
 * Get a single review article by ID
 */
router.get('/reviews/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `review_${id}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const review = await getReviewById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review article not found'
      });
    }

    const response = {
      success: true,
      data: review
    };

    // Cache for 10 minutes
    cacheService.set(cacheKey, response, 600);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching review by ID', { id: req.params.id, error: error.message });
    next(error);
  }
});

/**
 * POST /api/news/trigger-scrape
 * Manually trigger scraping of 91mobile news and reviews
 */
router.post('/trigger-scrape', async (req, res, next) => {
  try {
    const {
      scrapeNews = true,
      scrapeReviews = true,
      maxPages = 5,
      maxArticles = 50,
      newsListingUrl = null,
      reviewsListingUrl = null
    } = req.body;

    logger.info('Manual 91mobile scraping triggered', {
      scrapeNews,
      scrapeReviews,
      maxPages,
      maxArticles
    });

    // Trigger scraping in background (non-blocking)
    scrape91Mobile({
      scrapeNews,
      scrapeReviews,
      maxPages,
      maxArticles,
      newsListingUrl: newsListingUrl || undefined,
      reviewsListingUrl: reviewsListingUrl || undefined
    })
      .then(results => {
        logger.info('91mobile scraping completed', results);
      })
      .catch(error => {
        logger.error('91mobile scraping failed', { error: error.message, stack: error.stack });
      });

    res.json({
      success: true,
      message: '91mobile scraping triggered successfully.',
      note: 'Scraping is running in background. Check logs for progress.'
    });
  } catch (error) {
    logger.error('Error triggering 91mobile scraping', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/news/manual-add
 * Manually add a news article (for testing or manual entry)
 */
router.post('/manual-add', async (req, res, next) => {
  try {
    const newsData = req.body;

    if (!newsData.id && !newsData.url) {
      return res.status(400).json({
        success: false,
        message: 'News data must have either id or url'
      });
    }

    // Generate ID from URL if not provided
    if (!newsData.id && newsData.url) {
      const urlMatch = newsData.url.match(/\/([^\/]+)\/?$/);
      newsData.id = urlMatch ? urlMatch[1].replace(/\.html$/, '') : newsData.url.split('/').pop().replace(/\.html$/, '');
    }

    newsData.type = 'news';
    newsData.source = '91mobile';
    newsData.scrapedAt = new Date().toISOString();

    const result = await upsertNews(newsData);

    res.json({
      success: true,
      message: result.created ? 'News article created' : 'News article updated',
      data: result.data
    });
  } catch (error) {
    logger.error('Error manually adding news', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/reviews/manual-add
 * Manually add a review article (for testing or manual entry)
 */
router.post('/reviews/manual-add', async (req, res, next) => {
  try {
    const reviewData = req.body;

    if (!reviewData.id && !reviewData.url) {
      return res.status(400).json({
        success: false,
        message: 'Review data must have either id or url'
      });
    }

    // Generate ID from URL if not provided
    if (!reviewData.id && reviewData.url) {
      const urlMatch = reviewData.url.match(/\/([^\/]+)\/?$/);
      reviewData.id = urlMatch ? urlMatch[1].replace(/\.html$/, '') : reviewData.url.split('/').pop().replace(/\.html$/, '');
    }

    reviewData.type = 'review';
    reviewData.source = '91mobile';
    reviewData.scrapedAt = new Date().toISOString();

    const result = await upsertReview(reviewData);

    res.json({
      success: true,
      message: result.created ? 'Review article created' : 'Review article updated',
      data: result.data
    });
  } catch (error) {
    logger.error('Error manually adding review', { error: error.message });
    next(error);
  }
});

module.exports = router;

