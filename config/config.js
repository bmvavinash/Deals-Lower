// config/config.js
const constants = require('./constants')
// const ENVIRONMENT = process.env.NODE_ENV || 'stage'; // Assuming NODE_ENV is set to 'development', 'stage', or 'production'
// const ENVIRONMENT = process.env.NODE_ENV || 'prod'; // Assuming NODE_ENV is set to 'development', 'stage', or 'production'
// const ENVIRONMENT = process.env.NODE_ENV || 'development'; // Assuming NODE_ENV is set to 'development', 'stage', or 'production'

// const type="general"
// const type="productlinks"
// const type="categorylinks"
// const type="speedDeals"

// const env="prod"
// const env="stage"
console.log("env in config is ",constants.env)

const CONFIG = {
  development: {
    TELEGRAM_CHANNELS: {
        DEALS_ABOVE_75: "@all1appdealstest",
        ALL_DEALS: "@all1apptest",
        LOWER_DEALS: "@all1applowerdealstest",
    },
    WHATSAPP_GROUPS: {
        DEALS_ABOVE_75: "CRJM1kOVpOy4jqfabIhlYc",
        ALL_DEALS: "Kzl4DB4yCXzJaaCP0Lrf1G"
    },
    DATABASE_CONFIG: {
      DB1_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1_NAME: "avideals1",
      JSON_FILE_NAME: "dailydeals",
      DB1_BACKUP_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1Backup_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1_BACKUP_NAME: "avideals1",
      DB1Backup_NAME: "avideals1",
      DB2_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB2_NAME: "avideals1",
      DB3_TOKEN_FILE: "avideals1-firebase-adminsdk-6usdfweg0-f38dc842sdf34359",
      DB3_NAME: "avideals1",
      TEST_DB_TOKEN: "test_db_token_dev",
      USERS_DB_TOKEN_FILE: "dealshub-users-firebase-adminsdk-fbsvc-0c2dfa3c00",
      USERS_DB_NAME: "dealshub-users",
      USERS_DB_TOKEN: ""
    },
    FACEBOOK_CONFIG: {
      TOKEN: "your_facebook_token_for_dev"
    },
    OTHER_CONSTANTS: {
      SOME_API_KEY: "your_api_key_here_dev"
    }
  },
  stage: {
    TELEGRAM_CHANNELS: {
        DEALS_ABOVE_75: "@all1appdealstest",
        ALL_DEALS: "@all1apptest",
        LOWER_DEALS: "@all1applowerdealstest",
    },
    WHATSAPP_GROUPS: {
        DEALS_ABOVE_75: "CRJM1kOVpOy4jqfabIhlYc",
        ALL_DEALS: "Kzl4DB4yCXzJaaCP0Lrf1G"
    },
    DATABASE_CONFIG: {
      DB1_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1_NAME: "avideals1",
      JSON_FILE_NAME: "dailydeals",
      DB1_BACKUP_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1Backup_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB1_BACKUP_NAME: "avideals1",
      DB1Backup_NAME: "avideals1",
      DB2_TOKEN_FILE: "avideals1-firebase-adminsdk-6uwg0-f38dc84259",
      DB2_NAME: "avideals1",
      DB3_TOKEN_FILE: "avideals1-firebase-adminsdk-6es57uwg0-f38dse57575c84259",
      DB3_NAME: "avideals1",
      TEST_DB_TOKEN: "test_db_token_stage",
      USERS_DB_TOKEN_FILE: "dealshub-users-firebase-adminsdk-fbsvc-0c2dfa3c00",
      USERS_DB_NAME: "dealshub-users",
      USERS_DB_TOKEN: ""
    },
    FACEBOOK_CONFIG: {
      TOKEN: "your_facebook_token_for_stage"
    },
    OTHER_CONSTANTS: {
      SOME_API_KEY: "your_api_key_here_stage"
    }
  },
  production: {
    TELEGRAM_CHANNELS: {
      DEALS_ABOVE_75: "@dealshubglobal2",
      ALL_DEALS: "@dealshubglobal",
      LOWER_DEALS: "@dealshubgloballower"
    },
    WHATSAPP_GROUPS: {
      DEALS_ABOVE_75: "CRJM1kOVpOy4jqfabIhlYc",
      ALL_DEALS: "Kzl4DB4yCXzJaaCP0Lrf1G"
    },
    DATABASE_CONFIG: {
      DB1_TOKEN_FILE: "lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614",
      DB1_NAME: "lowerdealhub",
      JSON_FILE_NAME: "deals",
      DB1_BACKUP_TOKEN_FILE: "lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614",
      DB1Backup_TOKEN_FILE: "lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614",
      DB1_BACKUP_NAME: "lowerdealhub",
      DB1Backup_NAME: "lowerdealhub",
      // DB2_TOKEN_FILE: "dealshubloots-firebase-adminsdk-o8i6x-ce14a7cfb9",
      DB2_NAME: "dealshubloots",
      DB3_TOKEN_FILE: "dealshublinks-firebase-adminsdk-2q3v7644565897-1d74ec028d",
      DB3_NAME: "dealshublinks",
      DB1_TOKEN: "db1_token_prod",
      DB2_TOKEN: "db2_token_prod",
      DB3_TOKEN: "db3_token_prod",
      USERS_DB_TOKEN_FILE: "dealshub-users-firebase-adminsdk-fbsvc-0c2dfa3c00",
      USERS_DB_NAME: "dealshub-users",
      USERS_DB_TOKEN: ""
    },
    FACEBOOK_CONFIG: {
      TOKEN: constants.facebookId
    },
    OTHER_CONSTANTS: {
      SOME_API_KEY: "your_api_key_here_prod"
    }
  }
};

// module.exports = CONFIG[ENVIRONMENT];
module.exports = {
  ...CONFIG[constants.env],
  // type,
  // env
}
