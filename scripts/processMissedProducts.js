/**
 * scripts/processMissedProducts.js
 * CLI runner executed by localDaemon to process items that could not be scraped in cloud GitHub Actions.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const admin = require('firebase-admin');
const { getModuleLogger } = require('../logger/logger');
const { runBatch } = require('../dataSources/batchProductExtractor');
const config = require('../config/config');
const constants = require('../config/constants');

const logger = getModuleLogger('processMissedProducts');

// Initialize Firebase if needed
if (!admin.apps.some(app => app.name === '[DEFAULT]')) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch(e){}
  }
  const dbname = constants.postingTypesConfig[constants.type].DB;
  const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
  if (!serviceAccount) {
    try { serviceAccount = require(`${constants.pathToFile}/${filePath}.json`); } catch(e){}
  }
  const dbUrl = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: dbUrl
  });
}

async function main() {
  const actionName = process.argv[2] || 'unknown';
  const commandKey = process.argv[3] || null;

  logger.info(`Starting processMissedProducts for action: ${actionName}`, { commandKey });

  const db = admin.database();
  let urlsToProcess = [];

  if (commandKey) {
    const snap = await db.ref(`commandsQueue/${commandKey}`).once('value');
    const cmdData = snap.val();
    if (cmdData && Array.isArray(cmdData.missedUrls)) {
      urlsToProcess = cmdData.missedUrls;
    }
  }

  if (urlsToProcess.length === 0) {
    logger.info('No missed URLs found in command payload.');
    process.exit(0);
  }

  logger.info(`Processing ${urlsToProcess.length} missed URLs with local runner...`);
  
  // Extract category from action name if possible (e.g. category-electronics -> electronics)
  let category = 'ALL';
  if (actionName.startsWith('category-')) {
    category = actionName.replace('category-', '');
  }

  try {
    const result = await runBatch(urlsToProcess, 'website', category, 'productdeals');
    logger.info('Successfully processed missed URLs via local daemon:', result);
    process.exit(0);
  } catch (err) {
    logger.error('Failed to process missed URLs in local daemon:', { error: err.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
