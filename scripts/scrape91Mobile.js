/**
 * Script to scrape news and reviews from 91mobile.com
 * Can be run manually or scheduled
 */

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const { initializeDriver, extractNewsArticle, extractReviewArticle, getArticleUrls } = require('../scrappers/ninetyonemobile');
const { bulkUpsertNews, bulkUpsertReviews } = require('../database/firebaseDB/newsReviewsDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('scrape91Mobile');

// Configuration
const CONFIG = {
  // 91mobile listing URLs
  NEWS_LISTING_URL: 'https://www.91mobiles.com/hub',
  REVIEWS_LISTING_URL: 'https://www.91mobiles.com/reviews',
  MAX_PAGES: 5, // Maximum pages to scrape from listing
  MAX_ARTICLES: 50, // Maximum articles to scrape per run
  DELAY_BETWEEN_ARTICLES: 2000, // Delay in ms between scraping articles
  SCRAPE_NEWS: true,
  SCRAPE_REVIEWS: true
};

/**
 * Main scraping function
 */
async function scrape91Mobile(options = {}) {
  const {
    scrapeNews = CONFIG.SCRAPE_NEWS,
    scrapeReviews = CONFIG.SCRAPE_REVIEWS,
    maxPages = CONFIG.MAX_PAGES,
    maxArticles = CONFIG.MAX_ARTICLES,
    newsListingUrl = CONFIG.NEWS_LISTING_URL,
    reviewsListingUrl = CONFIG.REVIEWS_LISTING_URL
  } = options;

  let driver = null;

  try {
    logger.info('🚀 Starting 91mobile scraping', { scrapeNews, scrapeReviews, maxPages, maxArticles });

    // Initialize driver
    driver = await initializeDriver();
    logger.info('✅ WebDriver initialized');

    const results = {
      news: { scraped: 0, stored: 0, errors: 0 },
      reviews: { scraped: 0, stored: 0, errors: 0 }
    };

    // Scrape News
    if (scrapeNews) {
      try {
        logger.info('📰 Starting news scraping...');
        const newsUrls = await getArticleUrls(driver, newsListingUrl, maxPages);
        logger.info(`Found ${newsUrls.length} news URLs`);

        const newsArticles = [];
        const newsToScrape = newsUrls.slice(0, maxArticles);

        for (let i = 0; i < newsToScrape.length; i++) {
          try {
            logger.info(`Scraping news ${i + 1}/${newsToScrape.length}`, { url: newsToScrape[i] });
            const newsData = await extractNewsArticle(driver, newsToScrape[i]);
            newsArticles.push(newsData);
            results.news.scraped++;

            // Delay between articles
            if (i < newsToScrape.length - 1) {
              await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_ARTICLES));
            }
          } catch (error) {
            logger.error('Error scraping news article', { url: newsToScrape[i], error: error.message });
            results.news.errors++;
          }
        }

        // Store news articles
        if (newsArticles.length > 0) {
          const dbName = process.env.NEWS_DB_NAME || 'deals-backend-paapi';
          logger.info(`Storing ${newsArticles.length} news articles to database: ${dbName}...`);
          const storeResult = await bulkUpsertNews(newsArticles);
          results.news.stored = storeResult.created + storeResult.updated;
          logger.info('News articles stored successfully', { 
            ...storeResult, 
            database: dbName,
            storagePath: 'news'
          });
        }

      } catch (error) {
        logger.error('Error in news scraping', { error: error.message, stack: error.stack });
        results.news.errors++;
      }
    }

    // Scrape Reviews
    if (scrapeReviews) {
      try {
        logger.info('📱 Starting reviews scraping...');
        const reviewUrls = await getArticleUrls(driver, reviewsListingUrl, maxPages);
        logger.info(`Found ${reviewUrls.length} review URLs`);

        const reviewArticles = [];
        const reviewsToScrape = reviewUrls.slice(0, maxArticles);

        for (let i = 0; i < reviewsToScrape.length; i++) {
          try {
            logger.info(`Scraping review ${i + 1}/${reviewsToScrape.length}`, { url: reviewsToScrape[i] });
            const reviewData = await extractReviewArticle(driver, reviewsToScrape[i]);
            reviewArticles.push(reviewData);
            results.reviews.scraped++;

            // Delay between articles
            if (i < reviewsToScrape.length - 1) {
              await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_ARTICLES));
            }
          } catch (error) {
            logger.error('Error scraping review article', { url: reviewsToScrape[i], error: error.message });
            results.reviews.errors++;
          }
        }

        // Store review articles
        if (reviewArticles.length > 0) {
          const dbName = process.env.NEWS_DB_NAME || 'deals-backend-paapi';
          logger.info(`Storing ${reviewArticles.length} review articles to database: ${dbName}...`);
          const storeResult = await bulkUpsertReviews(reviewArticles);
          results.reviews.stored = storeResult.created + storeResult.updated;
          logger.info('Review articles stored successfully', { 
            ...storeResult, 
            database: dbName,
            storagePath: 'reviews'
          });
        }

      } catch (error) {
        logger.error('Error in reviews scraping', { error: error.message, stack: error.stack });
        results.reviews.errors++;
      }
    }

    const dbName = process.env.NEWS_DB_NAME || 'deals-backend-paapi';
    logger.info('✅ 91mobile scraping completed', { 
      ...results, 
      database: dbName,
      storagePath: 'news and reviews'
    });
    return results;

  } catch (error) {
    logger.error('❌ Fatal error in 91mobile scraping', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    if (driver) {
      try {
        await driver.quit();
        logger.info('WebDriver closed');
      } catch (error) {
        logger.warn('Error closing driver', { error: error.message });
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  scrape91Mobile()
    .then(results => {
      console.log('Scraping completed:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrape91Mobile };

