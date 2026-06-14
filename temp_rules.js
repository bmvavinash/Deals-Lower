const { getAccessToken } = require('./database/getAccessToken');
const constants = require('./config/constants');
const config = require('./config/config');

async function run() {
  const token = await getAccessToken(constants.env);
  const DB_Name = config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
  const baseUrl = DB_Name === 'lowerdealhub' ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app` : `https://${DB_Name}-default-rtdb.firebaseio.com`;
  const url = `${baseUrl}/config/categoryMatchingRules.json?access_token=${token}`;
  
  const rules = {
    'Electronics': ['amazon', 'flipkart'],
    'Mobile': ['amazon', 'flipkart'],
    'Fashion': ['amazon', 'flipkart', 'myntra', 'ajio'],
    'Kitchen': ['amazon', 'flipkart']
  };
  
  await fetch(url, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(rules)
  });
  console.log('Rules saved!');
}
run();
