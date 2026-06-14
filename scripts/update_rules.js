process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const admin = require('firebase-admin');
const serviceAccount = require('C:\\Users\\anila\\keys\\lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app'
});

async function run() {
  try {
    console.log('Fetching rules...');
    let rulesStr = await admin.database().getRules();
    let rules = JSON.parse(rulesStr);
    
    // Add productdeals_static index
    if (!rules.rules.productdeals_static) {
      rules.rules.productdeals_static = {};
    }
    rules.rules.productdeals_static['.indexOn'] = ["staticCategory", "categoryGroup", "staticSubcategory", "staticStyle"];
    rules.rules.productdeals_static['$id'] = {
      ".read": true,
      ".write": true
    };
    
    // Add productdeals index just in case
    if (!rules.rules.productdeals) {
      rules.rules.productdeals = {};
    }
    rules.rules.productdeals['.indexOn'] = ["categoryGroup", "datetime"];
    rules.rules.productdeals['$id'] = {
      ".read": true,
      ".write": true
    };
    
    console.log('Setting rules...');
    await admin.database().setRules(JSON.stringify(rules));
    console.log('Done!');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

run();
