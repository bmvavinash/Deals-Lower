// config/config.js
// const { environment } = require('./config');
// const { environment } = require('./config/constants');

// const ENVIRONMENT = environment; // or 'stage' based on your current setup
const pathToFile = "F:/Study/Affiliate/Projects/Affiliate/New Clone Affiliate/Firebase/Firebase key"
// const pathToFile = "C:/Users/Dell/Tasks/All/Aff/Key"


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

const generaltype="telegramFile"
// const generaltype="urlsFile"
// const generaltype="telegramBot"

const type="general"
// const type="textfilelinks"
// const type="productlinks"
// const type="categorylinks"
// const type="speedDeals"

const env="production"
// const env="stage"

const TelegramBotKey="5759815900:AAFKWE5cmFlmIkDUlzXT_-4sqIT2NQix3Ws"
const DealsGlobalBotKey="8177765543:AAF1lYt4e6dH6u-Cfb_Sd7oBEcl5VJadZz8"


const FirebaseApiKey="AIzaSyCpZ8uisdsfodfjpowijfsuSbimONqtRufvR8WBiUBFt7-_UI"
const POSTING_TYPES_CONFIG = {
  general: {
    DB: 'DB1',
    postTo: {
      telegram: true,
      whatsapp: false,
      // whatsapp: true,
      facebook: true
    },
    typeValue: 'all'
  },
  textfilelinks: {
    DB: 'DB1',
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
  generateLink
};
