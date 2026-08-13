// config/config.js
// const { environment } = require('./config');
// const { environment } = require('./config/constants');

// const ENVIRONMENT = environment; // or 'stage' based on your current setup
const pathToFile = process.env.FIREBASE_KEYS_PATH || "C:/Users/anila/keys"


const facebookId="100094567890123" // Replace with your actual Facebook ID

const kiteKey="100094567890123" // Replace with your actual Facebook ID
const kiteUsername="100094567890123" // Replace with your actual Facebook ID
const kitePassword="Depura@100094567890123" // Replace with your actual Facebook ID

const extraPeUsername="avinmafdsjgil.100094567890123" // Replace with your actual Facebook ID"
const extraPePassword="fs094567890123" // Replace with your actual Facebook ID"

const updateTodayDeals=true
// const updateTodayDeals=false

// const generateLink=false
const generateLink=true

const source="deals"
// const source="stocks"

// const generaltype="telegramFile"
// const generaltype="urlsFile"
const generaltype="bulkUpdate"  // Telegram datasources disabled; bulk + API only

const type="general"
// const type="textfilelinks"
// const type="productlinks"
// const type="categorylinks"
// const type="speedDeals"

const env="production"
// const env="stage"

const TelegramBotKey=process.env.TELEGRAM_BOT_KEY || "5759815900:AAFKWE5cmFlmIkDUlzXT_-4sqIT2NQix3Ws"
const DealsGlobalBotKey=process.env.DEALS_GLOBAL_BOT_KEY || "8177765543:AAF1lYt4e6dH6u-Cfb_Sd7oBEcl5VJadZz8"


const FirebaseApiKey=process.env.FIREBASE_API_KEY || "AIzaSyCpZ8uisdsfodfjpowijfsuSbimONqtRufvR8WBiUBFt7-_UI"
// Interval for bulk updates (in ms). If changed to invalid, fallback will be 2 hours.
// RE-ENABLED AFTER FIXING productDealsDB.js
const bulkUpdateIntervalMs = 2 * 60 * 60 * 1000; // 2 hours
// const bulkUpdateIntervalMs = null; // Disabled for testing

// Execution toggles
const enableTelegramProcessing = true; // Telegram datasources enabled
const enableBulkProcessing = true;     // Gate to start bulk website processing
const telegramMode = 'finite';         // 'continuous' for infinite loop, 'finite' for limited loops
const enableProductUrlFix = true;      // Gate to enable product URL verification and fixing

// Global timeouts and watchdogs
const maxPageTimeoutMs = 5 * 60 * 1000;        // 5 minutes per webpage scrape
const maxPlatformTimeoutMs = 10 * 60 * 1000;   // 10 minutes per platform/category batch
const maxIdleGlobalMs = 5 * 60 * 1000;         // 5 minutes idle watchdog

// TELEGRAM BOT WITH BULK UPDATES CONFIGURATION
console.log("=== BULK UPDATES + API MODE (Telegram datasources disabled) ===");
console.log("Type:", type);
console.log("General Type:", generaltype);
console.log("Source:", source);
console.log("Environment:", env);
console.log("Bulk Updates:", bulkUpdateIntervalMs ? "ENABLED" : "DISABLED");
console.log("Mode: Bulk Updates + API (no Telegram datasource)");
console.log("==================================================");
const POSTING_TYPES_CONFIG = {
  general: {
    DB: 'DB1',
    // DB: 'DB1Backup',
    postTo: {
      telegram: false,
      whatsapp: false, // DISABLED FOR TESTING
      // whatsapp: true,
      facebook: false  // DISABLED FOR TESTING
    },
    typeValue: 'all'
  },
  textfilelinks: {
    DB: 'DB1',
    // DB: 'DB1Backup',
    postTo: {
      telegram: true,
      whatsapp: false,
      // whatsapp: true,
      facebook: true
    },
    typeValue: 'all'
  },
  productlinks: {
    DB: 'DB2',
    postTo: {
      telegram: false,
      whatsapp: false,
      facebook: false
    },
    typeValue: 'onlyproductDB'
  },
  categorylinks: {
    DB: 'DB3',
    postTo: {
      telegram: false,
      whatsapp: false,
      facebook: false
    },
    typeValue: 'onlycategoryDB'
  },
  speedDeals: {
    DB: 'DB1',
    postTo: {
      telegram: true,
      whatsapp: false,
      facebook: true
    },
    typeValue: 'exceptWhatsapp'
  }
};

// Export based on the current environment
module.exports = {
  // environment: ENVIRONMENT,
  postingTypesConfig: POSTING_TYPES_CONFIG,
  type,
  generaltype,
  env,
  kiteKey,
  kiteUsername,
  kitePassword,
  source,
  facebookId,
  pathToFile,
  TelegramBotKey,
  DealsGlobalBotKey,
  updateTodayDeals,
  extraPeUsername,
  extraPePassword,
  FirebaseApiKey,
  generateLink,
  bulkUpdateIntervalMs,
  enableTelegramProcessing,
  enableBulkProcessing,
  telegramMode,
  enableProductUrlFix,
  maxPageTimeoutMs,
  maxPlatformTimeoutMs,
  maxIdleGlobalMs,

  // Secondary Firebase project for user favourites/preferences (uses Admin SDK)
  userFirebase: {
    serviceAccountPath: process.env.USERS_FIREBASE_SERVICE_ACCOUNT_PATH || 'C:/Users/anila/keys',
    databaseURL: process.env.USERS_FIREBASE_DATABASE_URL || 'https://dealshub-users-default-rtdb.asia-southeast1.firebasedatabase.app',
    appName: 'user-favourites'
  },

  // Notification toggles and thresholds
  notifications: {
    enableWhatsapp: true,
    enableTelegram: true,
    enablePush: false,
    enableBrowser: false,
    enableFavoritesService: true,
    lowStockThreshold: 2,
    expiryWarnMinutes: 30,
    respectDoNotDisturb: true,
    // Favorites processing intervals (in milliseconds)
    favoritesProcessingIntervalMs: 60 * 60 * 1000, // 1 hour - full favorites processing
    favoritesUrgentCheckIntervalMs: 10 * 60 * 1000, // 10 minutes - urgent notifications check
    // Maximum notifications per cycle to prevent spam
    maxNotificationsPerCycle: 200,
    // Price drop threshold for notifications (percentage)
    priceDropThreshold: 0.1 // 10% default
  },

  // Frontend API configuration
  frontend: {
    apiPort: 3001,
    enableWebSocket: true,
    logRetentionDays: 30
  }
};
