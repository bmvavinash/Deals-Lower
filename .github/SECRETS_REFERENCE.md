# GitHub Secrets Reference

This document lists all GitHub Secrets required for the workflows in this repository.

## Required Secrets

### FIREBASE_SERVICE_ACCOUNT_JSON
- **Description**: Firebase Admin SDK service account credentials for the main deals database (lowerdealhub)
- **Format**: Full JSON content of the service account key file
- **Source**: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- **Used by**: All workflows
- **How to set**: 
  1. Go to Firebase Console for `lowerdealhub` project
  2. Navigate to Project Settings → Service Accounts
  3. Click "Generate New Private Key"
  4. Copy the entire JSON content
  5. Go to GitHub repo → Settings → Secrets → Actions → New Repository Secret
  6. Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
  7. Value: Paste the entire JSON content

### USERS_FIREBASE_SERVICE_ACCOUNT_JSON
- **Description**: Firebase Admin SDK service account for the users/favorites database (dealshub-users)
- **Format**: Full JSON content of the service account key file
- **Source**: Firebase Console for `dealshub-users` project
- **Used by**: favorites-check.yml

### TELEGRAM_BOT_KEY
- **Description**: Telegram Bot API token for the deals bot
- **Format**: String like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
- **Source**: BotFather on Telegram
- **Used by**: favorites-check.yml, hot-deals-telegram.yml

### DEALS_GLOBAL_BOT_KEY
- **Description**: Telegram Bot API token for the deals global notification bot
- **Format**: Same as TELEGRAM_BOT_KEY
- **Source**: BotFather on Telegram
- **Used by**: favorites-check.yml, hot-deals-telegram.yml

### FIREBASE_API_KEY (Optional)
- **Description**: Firebase Web API key for client-side operations
- **Format**: String starting with `AIza...`
- **Source**: Firebase Console → Project Settings → General → Web API Key
- **Used by**: Any workflow that needs client-side Firebase auth

## Workflow-to-Secret Mapping

| Workflow | FIREBASE_SERVICE_ACCOUNT_JSON | USERS_FIREBASE_SERVICE_ACCOUNT_JSON | TELEGRAM_BOT_KEY | DEALS_GLOBAL_BOT_KEY |
|----------|-------------------------------|------------------------------------|-----------------|-----------------------|
| favorites-check | ✅ | ✅ | ✅ | ✅ |
| category-* (all 10) | ✅ | ❌ | ❌ | ❌ |
| hot-deals-telegram | ✅ | ❌ | ✅ | ✅ |
| banners-fetch | ✅ | ❌ | ❌ | ❌ |

## Security Notes
- Never commit service account JSON files to the repository
- Rotate keys periodically
- Use least-privilege service accounts where possible
- GitHub Secrets are encrypted and only exposed to selected workflows
