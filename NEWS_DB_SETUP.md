# News & Reviews Database Setup Guide

## ✅ What You Need

For Firebase Admin SDK, you **ONLY need**:
1. **Database Name** (e.g., `deals-backend-paapi`)
2. **Service Account JSON File** (contains all other details automatically)

You **DO NOT need**:
- ❌ Auth domain
- ❌ Project ID (it's in the service account JSON)
- ❌ Storage bucket
- ❌ Message sender ID
- ❌ App ID
- ❌ Measurement ID

Those are only needed for **client-side Firebase SDK**, not Admin SDK.

## 📝 Setup Steps

### 1. Add to `.env` file

```env
# Database name only (without -default-rtdb suffix)
# The full URL will be: https://deals-backend-paapi-default-rtdb.asia-southeast1.firebasedatabase.app
NEWS_DB_NAME=deals-backend-paapi

# Service account file name (without .json extension)
# The file should be in: F:/Study/Affiliate/Projects/Affiliate/New Clone Affiliate/Firebase/Firebase key/
NEWS_DB_TOKEN_FILE=your-service-account-file-name
```

### 2. Place Service Account File

Place your Firebase service account JSON file in:
```
F:/Study/Affiliate/Projects/Affiliate/New Clone Affiliate/Firebase/Firebase key/
```

The file name should match `NEWS_DB_TOKEN_FILE` + `.json`

**Example:**
- If `NEWS_DB_TOKEN_FILE=deals-backend-paapi-firebase-adminsdk-abc123`
- Then file should be: `deals-backend-paapi-firebase-adminsdk-abc123.json`
- Full path: `F:/Study/Affiliate/Projects/Affiliate/New Clone Affiliate/Firebase/Firebase key/deals-backend-paapi-firebase-adminsdk-abc123.json`

## 🔍 How It Works

The code automatically:
1. Reads `NEWS_DB_NAME` from `.env`
2. Constructs the database URL as: `https://{NEWS_DB_NAME}-default-rtdb.asia-southeast1.firebasedatabase.app`
3. Uses `pathToFile` from `config/constants.js` to find the service account file
4. Loads the service account JSON (which contains project_id, private_key, etc.)

## 📋 Example `.env` Configuration

```env
NEWS_DB_NAME=deals-backend-paapi
NEWS_DB_TOKEN_FILE=deals-backend-paapi-firebase-adminsdk-abc123
```

## ✅ Verification

After setup, the system will:
- Load environment variables from `.env`
- Use `pathToFile` from `constants.js` (already configured)
- Construct database URL automatically
- Initialize Firebase Admin SDK with the service account

## 🚀 Alternative: Add to config.js (Optional)

If you prefer to keep it in `config.js` instead of `.env`, you can add:

```javascript
DATABASE_CONFIG: {
  // ... existing config ...
  NEWS_DB_NAME: 'deals-backend-paapi',
  NEWS_DB_TOKEN_FILE: 'deals-backend-paapi-firebase-adminsdk-abc123'
}
```

But `.env` is recommended for:
- ✅ Security (not committed to git)
- ✅ Environment-specific values
- ✅ Easy updates without code changes

## ❓ Questions?

**Q: Should I add it to config.js or .env?**
A: **`.env` is recommended** - it's more secure and easier to manage.

**Q: Do I need the full database URL?**
A: **No** - just the database name. The URL is constructed automatically.

**Q: Where does the service account file go?**
A: In the `pathToFile` directory from `constants.js` (already configured).

**Q: Do I need other Firebase details?**
A: **No** - the service account JSON file contains everything needed.














