// config/config.js
// const { environment } = require('./config');
// const { environment } = require('./config/constants');

// const ENVIRONMENT = environment; // or 'stage' based on your current setup
const pathToFile = "C:/Users/Dell/Tasks/All/Aff/Key"


const facebookId="EAAKw6ZAutPZBoBO93V3v8gGjqY44nA32GOsrwPwZAN98bjiRjRy8BA00HDlnssPWdS41GCZCfFUwAMJJjK2Brs7C4Y4ZCT07V90nZBSJq6raQSvbwLK8JwkDL19pqILtyvuZAo5yO85yhshZAffga1C3ej8zFcDqC96FWeqZAhPo1zrZAC0doYLwVIlyvOoazdCMZBp3lvy3zAd7nMKXQ4JEjPPUiEZD"

const type="general"
// const type="productlinks"
// const type="categorylinks"
// const type="speedDeals"

const env="production"
// const env="stage"


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
  env,
  facebookId,
  pathToFile
};
