# 91Mobile Testing Guide

## ✅ Setup Complete

All components are ready for testing:
- ✅ Scraper configured for `/hub` and `/reviews`
- ✅ Database handler with `.env` support
- ✅ API endpoints registered
- ✅ Frontend routes added
- ✅ Navigation menu updated

## 🧪 Testing Steps

### Step 1: Verify Environment Setup

1. **Check `.env` file has:**
   ```env
   NEWS_DB_NAME=deals-backend-paapi
   NEWS_DB_TOKEN_FILE=your-service-account-file-name
   ```

2. **Verify service account JSON file exists:**
   - Location: `F:/Study/Affiliate/Projects/Affiliate/New Clone Affiliate/Firebase/Firebase key/`
   - File name: `{NEWS_DB_TOKEN_FILE}.json`

### Step 2: Test Scraping & Database Storage

Run the test script:
```bash
node test_91mobile_scraping.js
```

This will:
- Scrape 2 articles from `/hub` (news)
- Scrape 2 articles from `/reviews`
- Store them in the database
- Verify data retrieval

**Expected Output:**
```
✅ Scraping completed
✅ Retrieved X news articles from DB
✅ Retrieved X review articles from DB
```

### Step 3: Start Backend Server

```bash
npm run api
```

Server should start on `http://localhost:3001`

### Step 4: Test API Endpoints

In a new terminal:
```bash
node test_api_news.js
```

Or test manually:
```bash
# Get news
curl http://localhost:3001/api/news?limit=5

# Get reviews
curl http://localhost:3001/api/news/reviews?limit=5

# Trigger scraping
curl -X POST http://localhost:3001/api/news/trigger-scrape \
  -H "Content-Type: application/json" \
  -d '{"scrapeNews": true, "scrapeReviews": true, "maxPages": 1, "maxArticles": 5}'
```

### Step 5: Start Frontend

In a new terminal:
```bash
npm run frontend
```

Frontend should start on `http://localhost:5173` (or similar)

### Step 6: Test Frontend

1. **Navigate to News page:**
   - Click "News" in sidebar or visit: `http://localhost:5173/news`
   - Should display news articles if any are in DB
   - Click "Scrape News" button to trigger scraping

2. **Navigate to Reviews page:**
   - Click "Reviews" in sidebar or visit: `http://localhost:5173/reviews`
   - Should display review articles if any are in DB
   - Click "Scrape Reviews" button to trigger scraping

3. **Test from Deals page:**
   - Visit: `http://localhost:5173/deals`
   - Click "Trigger News & Reviews" button
   - This will scrape both news and reviews

## 🔍 Verification Checklist

- [ ] Scraping works (articles extracted from 91mobile)
- [ ] Data stored in Firebase database
- [ ] API endpoints return data
- [ ] Frontend displays news articles
- [ ] Frontend displays review articles
- [ ] Scrape buttons trigger scraping
- [ ] Navigation works (News and Reviews in sidebar)

## 🐛 Troubleshooting

### Issue: "Service account file not found"
- **Solution:** Verify file path and name match `NEWS_DB_TOKEN_FILE` in `.env`

### Issue: "Database connection failed"
- **Solution:** Check `NEWS_DB_NAME` is correct and database exists

### Issue: "No articles displayed"
- **Solution:** 
  1. Trigger scraping first (button or API)
  2. Wait for scraping to complete
  3. Refresh the page

### Issue: "API returns empty"
- **Solution:** 
  1. Check backend server is running
  2. Verify database has data
  3. Check browser console for errors

### Issue: "Frontend routes not working"
- **Solution:** 
  1. Verify `App.tsx` has routes
  2. Check `Sidebar.tsx` has navigation items
  3. Restart frontend server

## 📊 Expected Data Structure

### News Article:
```json
{
  "id": "article-slug",
  "type": "news",
  "source": "91mobile",
  "title": "Article Title",
  "content": "Article content...",
  "author": "Author Name",
  "publishDate": "2024-01-01T00:00:00.000Z",
  "category": "Mobile",
  "tags": ["tag1", "tag2"],
  "images": [{"url": "...", "alt": "..."}],
  "url": "https://www.91mobiles.com/hub/..."
}
```

### Review Article:
```json
{
  "id": "review-slug",
  "type": "review",
  "source": "91mobile",
  "productName": "Product Name",
  "title": "Review Title",
  "content": "Review content...",
  "rating": 4.5,
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "verdict": "Verdict text...",
  "url": "https://www.91mobiles.com/reviews/..."
}
```

## ✅ Success Criteria

All tests pass when:
1. ✅ Scraping extracts data from 91mobile
2. ✅ Data is stored in Firebase
3. ✅ API returns data correctly
4. ✅ Frontend displays articles
5. ✅ Buttons trigger scraping
6. ✅ Navigation works

## 🚀 Next Steps After Testing

Once everything works:
1. Adjust `MAX_ARTICLES` and `MAX_PAGES` in `scripts/scrape91Mobile.js` for production
2. Set up scheduled scraping (cron job or scheduler)
3. Customize frontend styling if needed
4. Add more filters/sorting options if required














