async function firebasepost(app, access_token, env="prod", jsonFileName="deals", url="https://dealshubglobal-default-rtdb.firebaseio.com",extract="Telegram",extractData="productlinks") {
  const fetch = require('node-fetch');

  let authorized=false

  
  const constants = require('../config/constants.js');
  const config = require('../config/config.js');

  env=constants.env

  const dbname= constants.postingTypesConfig[constants.type].DB
  let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

  jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME

const apiUrl = `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/${jsonFileName}.json?access_token=${access_token}`

  await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(app),
  })
    .then(async (response) => {
      const responseData = await response.json();
      console.log('Response:', responseData);
      if (response.status === 401 || responseData.name.toLowerCase().includes('unauthorized')) {
        authorized = false
      } else {
        authorized = true
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      authorized = false

    });
    return authorized
}

exports.firebasepost = firebasepost;
