process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { getAccessToken } = require('./database/getAccessToken');
const constants = require('./config/constants');
const config = require('./config/config');

async function run() {
  try {
    const token = await getAccessToken(constants.env);
    const dbname = constants.postingTypesConfig[constants.type].DB;
    const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
    const baseUrl = DB_Name === 'lowerdealhub' 
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app` 
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;

    console.log(`Querying DB_Name: ${DB_Name}`);
    
    // Fetch shallow notificationTracking
    const url = `${baseUrl}/notificationTracking.json?access_token=${token}&shallow=true`;
    const res = await fetch(url);
    const data = await res.json();
    const count = Object.keys(data || {}).length;
    console.log(`Notification tracking records count (shallow): ${count}`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
