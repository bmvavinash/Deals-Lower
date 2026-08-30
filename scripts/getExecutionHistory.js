process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');

async function run() {
  try {
    const dbname = constants.postingTypesConfig[constants.type].DB;
    const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
    const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    const databaseURL = `https://${config.DATABASE_CONFIG[`${dbname}_NAME`]}-default-rtdb.asia-southeast1.firebasedatabase.app`;
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });
    }
    
    const db = admin.database();
    const historyRef = db.ref('executionTracking/history');
    
    const snapshot = await historyRef.limitToLast(10).once('value');
    const val = snapshot.val() || {};
    
    const list = Object.values(val).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    console.log(`\n=== Past Executions ===`);
    list.forEach((exec, index) => {
      console.log(`\n${index + 1}. Job ID: ${exec.id}`);
      console.log(`   Type: ${exec.type}`);
      console.log(`   Status: ${exec.status}`);
      console.log(`   Started: ${exec.startTime}`);
      console.log(`   Completed: ${exec.completedAt || 'N/A'}`);
      console.log(`   Platforms count: ${Object.keys(exec.platforms || {}).length}`);
      console.log(`   Stats: Success: ${exec.stats?.successCount || 0} | Errors: ${exec.stats?.errorCount || 0}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
