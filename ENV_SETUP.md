# Environment Variables Setup for News & Reviews

## 📝 Setup Instructions

1. **Create a `.env` file** in the root directory of the project

2. **Add the following variables** with your actual database details:

```env
# 91Mobile News & Reviews Database Configuration

# Firebase Database Name for News & Reviews
NEWS_DB_NAME=your-news-db-name

# Firebase Service Account File Name (without .json extension)
# Place the service account JSON file in the root directory
NEWS_DB_TOKEN_FILE=your-service-account-file-name
```

## 📋 Example

```env
NEWS_DB_NAME=news-reviews-db
NEWS_DB_TOKEN_FILE=news-reviews-firebase-adminsdk-abc123
```

## 🔐 Security Note

- **DO NOT** commit the `.env` file to git
- The `.env` file should be in `.gitignore`
- Keep your service account JSON file secure

## ✅ Verification

After setting up the `.env` file:

1. The system will automatically load these variables
2. The database handler will use these values to connect to your Firebase database
3. You can test by triggering the News & Reviews scraping from the UI

## 🚀 Usage

Once configured, you can:
- Trigger scraping via the "Trigger News & Reviews" button in the Deals page
- Or use the API endpoint: `POST /api/news/trigger-scrape`
- Or run manually: `node scripts/scrape91Mobile.js`














