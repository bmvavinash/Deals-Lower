/**
 * Check execution tracker data in Firebase
 */

const admin = require('firebase-admin');
const constants = require('../config/constants');
const config = require('../config/config');

const dbname = constants.postingTypesConfig[constants.type].DB;
const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
  });
}

const db = admin.database();

async function checkExecutionTracker() {
  try {
    const ref = db.ref('executionTracking');
    const snapshot = await ref.once('value');
    const data = snapshot.val();
    
    console.log('\n📊 Execution Tracker Data:\n');
    console.log('='.repeat(80));
    
    if (!data) {
      console.log('❌ No execution tracking data found in Firebase');
      console.log('   This means bulk updates may not have started properly');
      return;
    }
    
    const current = data.current || null;
    const history = data.history || [];
    
    console.log('\n🔄 Current Execution:');
    if (current) {
      console.log(`  ID: ${current.id}`);
      console.log(`  Type: ${current.type}`);
      console.log(`  Status: ${current.status}`);
      console.log(`  Start Time: ${current.startTime}`);
      console.log(`  Current Platform: ${current.currentPlatform || 'N/A'}`);
      console.log(`  Current Category: ${current.currentCategory || 'N/A'}`);
      console.log(`  Total Products: ${current.totalProducts || 0}`);
      console.log(`  Total Processed: ${current.totalProcessed || 0}`);
      console.log(`  Total Created: ${current.totalCreated || 0}`);
      console.log(`  Total Updated: ${current.totalUpdated || 0}`);
      
      if (current.platforms && typeof current.platforms === 'object') {
        const platformKeys = Object.keys(current.platforms);
        console.log(`\n  Platforms (${platformKeys.length}):`);
        platformKeys.forEach(platform => {
          const platformData = current.platforms[platform];
          console.log(`    - ${platform}:`);
          console.log(`        Total Products: ${platformData.totalProducts || 0}`);
          console.log(`        Processed: ${platformData.totalProcessed || 0}`);
          console.log(`        Created: ${platformData.totalCreated || 0}`);
          console.log(`        Updated: ${platformData.totalUpdated || 0}`);
          
          if (platformData.categories && typeof platformData.categories === 'object') {
            const categoryKeys = Object.keys(platformData.categories);
            console.log(`        Categories (${categoryKeys.length}):`);
            categoryKeys.forEach(category => {
              const catData = platformData.categories[category];
              console.log(`          - ${category}:`);
              console.log(`              Total: ${catData.totalProducts || 0}`);
              console.log(`              Processed: ${catData.processed || 0}`);
              console.log(`              Created: ${catData.created || 0}`);
              console.log(`              Updated: ${catData.updated || 0}`);
            });
          }
        });
      } else {
        console.log('  ⚠️  Platforms data is missing or invalid');
      }
    } else {
      console.log('  ❌ No current execution running');
    }
    
    console.log(`\n📜 Execution History: ${history.length} entries`);
    if (history.length > 0) {
      console.log('  Recent executions:');
      history.slice(0, 3).forEach((exec, idx) => {
        console.log(`    ${idx + 1}. ${exec.id} - ${exec.status} - ${exec.type}`);
        console.log(`       Products: ${exec.totalProducts || 0}, Processed: ${exec.totalProcessed || 0}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

checkExecutionTracker();
