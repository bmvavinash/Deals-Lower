async function firebasePut(app, access_token, env="prod", jsonFileName="deals") {
    const fetch = require('node-fetch');
    const constants = require('../config/constants.js');
    const config = require('../config/config.js');
  
    env = constants.env;
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  
    const apiUrl = `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/${jsonFileName}.json?access_token=${access_token}`;
  
    let authorized = false;
  
    await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(app),
    })
      .then(async (response) => {
        const responseData = await response.json();
        console.log('Response:', responseData);
        // authorized = response.status !== 401 && !responseData.name.toLowerCase().includes('unauthorized');
      })
      .catch((error) => {
        console.error('Error:', error);
        authorized = false;
      });
  
    return authorized;
  }
  

module.exports = firebasePut;