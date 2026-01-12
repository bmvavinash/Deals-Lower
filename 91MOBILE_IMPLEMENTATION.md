# 91Mobile News & Reviews Scraping Implementation

## ✅ Implementation Complete

This document describes the complete implementation for scraping news and reviews from 91mobile.com and storing them in a separate database.

## 📁 Files Created

### Backend Files

1. **`scrappers/ninetyonemobile.js`**
   - Main scraper for 91mobile.com
   - Functions:
     - `initializeDriver()` - Sets up Chrome WebDriver
     - `extractNewsArticle(driver, url)` - Extracts news article data
     - `extractReviewArticle(driver, url)` - Extracts review article data
     - `getArticleUrls(driver, listingUrl, maxPages)` - Gets list of article URLs from listing pages

2. **`database/firebaseDB/newsReviewsDB.js`**
   - Firebase database handler for news and reviews
   - Functions:
     - `upsertNews(newsData)` - Store/update news article
     - `upsertReview(reviewData)` - Store/update review article
     - `bulkUpsertNews(newsArray)` - Bulk store news articles
     - `bulkUpsertReviews(reviewsArray)` - Bulk store review articles
     - `getNews(options)` - Get news with pagination and filters
     - `getReviews(options)` - Get reviews with pagination and filters
     - `getNewsById(id)` - Get single news article
     - `getReviewById(id)` - Get single review article

3. **`scripts/scrape91Mobile.js`**
   - Main script to run scraping
   - Can be executed manually: `node scripts/scrape91Mobile.js`
   - Configurable via options

4. **`server/api/routes/news.js`**
   - API endpoints:
     - `GET /api/news` - Get news articles (with filters)
     - `GET /api/news/:id` - Get single news article
     - `GET /api/news/reviews` - Get review articles (with filters)
     - `GET /api/news/reviews/:id` - Get single review article
     - `POST /api/news/trigger-scrape` - Manually trigger scraping
     - `POST /api/news/manual-add` - Manually add news article
     - `POST /api/news/reviews/manual-add` - Manually add review article

### Frontend Files

1. **`frontend/src/pages/NewsPage.tsx`** - News listing page
2. **`frontend/src/pages/NewsPage.css`** - News page styles
3. **`frontend/src/pages/ReviewsPage.tsx`** - Reviews listing page
4. **`frontend/src/pages/ReviewsPage.css`** - Reviews page styles
5. **`frontend/src/services/api.ts`** - Updated with news API methods

## 🔧 Configuration Required

### Database Setup

You need to provide the following database details:

1. **Firebase Service Account File**
   - Place your Firebase service account JSON file in the root directory
   - Default expected name: `news-reviews-firebase-adminsdk.json`
   - Or configure via environment variables:
     - `NEWS_DB_NAME` - Firebase database name
     - `NEWS_DB_TOKEN_FILE` - Service account file name (without .json)

2. **Update `config/config.js`** (Optional)
   ```javascript
   DATABASE_CONFIG: {
     // ... existing config ...
     NEWS_DB_NAME: 'your-news-db-name',
     NEWS_DB_TOKEN_FILE: 'your-service-account-file-name'
   }
   ```

### 91Mobile URLs Configuration

Update the listing URLs in `scripts/scrape91Mobile.js`:

```javascript
const CONFIG = {
  NEWS_LISTING_URL: 'https://www.91mobiles.com/hub', // Update if different
  REVIEWS_LISTING_URL: 'https://www.91mobiles.com/reviews', // Update if different
  MAX_PAGES: 5,
  MAX_ARTICLES: 50,
  // ...
};
```

## 📊 Data Structure

### News Article Structure
```javascript
{
  id: string,              // Unique ID (generated from URL)
  type: 'news',
  source: '91mobile',
  title: string,
  content: string,         // Article content (max 1000 chars)
  author: string,
  publishDate: string,     // ISO date string
  category: string,
  tags: string[],
  images: Array<{url: string, alt: string}>,
  url: string,             // Original article URL
  scrapedAt: string,      // ISO date string
  createdAt: string,       // ISO date string
  updatedAt: string        // ISO date string
}
```

### Review Article Structure
```javascript
{
  id: string,              // Unique ID (generated from URL)
  type: 'review',
  source: '91mobile',
  productName: string,
  title: string,
  content: string,         // Review content (max 2000 chars)
  rating: number,          // 0-5 rating
  pros: string[],
  cons: string[],
  verdict: string,
  author: string,
  publishDate: string,     // ISO date string
  images: Array<{url: string, alt: string}>,
  url: string,            // Original review URL
  scrapedAt: string,      // ISO date string
  createdAt: string,      // ISO date string
  updatedAt: string       // ISO date string
}
```

## 🚀 Usage

### Manual Scraping

1. **Via Script:**
   ```bash
   node scripts/scrape91Mobile.js
   ```

2. **Via API:**
   ```bash
   POST http://localhost:3001/api/news/trigger-scrape
   Body: {
     "scrapeNews": true,
     "scrapeReviews": true,
     "maxPages": 5,
     "maxArticles": 50
   }
   ```

3. **Via Frontend:**
   - Navigate to News page and click "Scrape News" button
   - Navigate to Reviews page and click "Scrape Reviews" button

### API Endpoints

**Get News:**
```
GET /api/news?limit=20&offset=0&category=mobile&sortBy=publishDate&order=desc
```

**Get Reviews:**
```
GET /api/news/reviews?limit=20&offset=0&productName=iphone&minRating=4&sortBy=rating&order=desc
```

**Get Single Article:**
```
GET /api/news/:id
GET /api/news/reviews/:id
```

## 🎨 Frontend Pages

### News Page (`/news`)
- Displays list of news articles
- Filter by category
- Sort by date or title
- Pagination support
- Trigger scraping button

### Reviews Page (`/reviews`)
- Displays list of product reviews
- Search by product name
- Filter by minimum rating
- Sort by date, rating, or product name
- Shows pros/cons and verdict
- Pagination support
- Trigger scraping button

## ⚙️ Customization

### Scraping Selectors

The scraper uses multiple fallback selectors to find content. If 91mobile's HTML structure is different, update selectors in:

- `scrappers/ninetyonemobile.js` - `extractNewsArticle()` and `extractReviewArticle()`

### Database Fallback

If the news database is not configured, the system will fall back to the default database. To use a separate database:

1. Create a new Firebase project
2. Download the service account JSON file
3. Place it in the root directory
4. Configure `NEWS_DB_NAME` and `NEWS_DB_TOKEN_FILE`

## 📝 Notes

- The scraper uses headless Chrome with Selenium WebDriver
- Articles are deduplicated by ID (generated from URL)
- Caching is implemented for API responses (5-10 minutes TTL)
- Scraping runs in background when triggered via API
- All scraping operations are logged

## 🔍 Testing

1. Test scraping a single article:
   ```javascript
   const { extractNewsArticle, initializeDriver } = require('./scrappers/ninetyonemobile');
   const driver = await initializeDriver();
   const article = await extractNewsArticle(driver, 'https://www.91mobiles.com/news/...');
   console.log(article);
   ```

2. Test database operations:
   ```javascript
   const { upsertNews, getNews } = require('./database/firebaseDB/newsReviewsDB');
   // Test upsert
   await upsertNews({ id: 'test', title: 'Test', ... });
   // Test get
   const news = await getNews({ limit: 10 });
   ```

## ❓ Questions?

If you need to:
- Adjust scraping selectors for 91mobile's HTML structure
- Change data fields being scraped
- Modify database structure
- Add additional filters or sorting options

Please provide the specific requirements and I'll update the implementation accordingly.














