// Post or patch (but for objects its put(overwriting the existing object))
var firebase = require('firebase/app');
var database = require('firebase/database');
const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { productStatus } = require('../../config/const.js');
const { getModuleLogger } = require("../../logger/logger.js");
const { detectChanges, areChangesSignificant, logChanges } = require("../../utils/changeDetection.js");
const { getISTTimestamp } = require('../../utils/commonUtils');

env=constants.env

const logger = getModuleLogger('firebaseUpdate');

const dbname= constants.postingTypesConfig[constants.type].DB
let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
  const dbUrl = DB_Name === 'lowerdealhub' 
		? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
		: `https://${DB_Name}-default-rtdb.firebaseio.com`;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: dbUrl,
  });
}

const db = admin.database();

/**
 * Sanitize data for Firebase by removing undefined values and null values
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
function sanitizeForFirebase(data) {
  if (data === null || data === undefined) {
    return {};
  }
  
  if (typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirebase(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        const sanitizedValue = sanitizeForFirebase(value);
        if (Object.keys(sanitizedValue).length > 0) {
          sanitized[key] = sanitizedValue;
        }
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

// Dynamic Firebase config based on environment
const firebaseConfig = {
  apiKey: "AIzaSyAPxlbkX6b52v9I0u4cdwq3zZBPNIPZeQk",
  authDomain: "lowerdealhub.firebaseapp.com",
  databaseURL: "https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lowerdealhub",
  storageBucket: "lowerdealhub.firebasestorage.app",
  messagingSenderId: "598732188394",
  appId: "1:598732188394:web:a9d61b5847b84e12a68593",
  measurementId: "G-6CFDE4LJZT"
};

// const firebaseConfig = {

//     apiKey: constants.FirebaseApiKey,
//     authDomain: `${DB_Name}.firebaseapp.com`,
//     databaseURL: `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`,
//     // databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`,
//     projectId: `${DB_Name}`,
//     storageBucket: `${DB_Name}.appspot.com`,
//     messagingSenderId: "848061960225",
//     appId: "1:848061960225:web:30d1b2fbd6c6243b2e1360",
//     measurementId: "G-HJNCM2MN6Q"
        
//   // Your Firebase configuration
// };
const app = firebase.initializeApp(firebaseConfig);
// const db = database.getDatabase(app);

// const db = getDatabase(app); // Get the database instance
// const ref = ref(db, '/deals'); // Create a reference to the '/deals' path

var ref = database.ref(db, '/deals');

// Function to update a record
async function updateProduct(productCode, updatedData, access_token="", env="stage") {
  try {
    // Get a reference to the product node
      const productRef = db.ref('deals/' + productCode); // Directly use the ref from the admin.database() instance
      // const productRef = db.ref(productCode); 

    // Check if the product exists
      const productSnapshot = await productRef.once('value'); // Use .once('value') to fetch the snapshot
    if (productSnapshot.exists()) {
      const existingProductData = productSnapshot.val();

      // Enhanced change detection using the new utility
      const changeResult = detectChanges(existingProductData, updatedData);
      
      // Log the changes for monitoring
      logChanges(productCode, changeResult, { 
        logLevel: 'info', 
        includeDetails: changeResult.hasCriticalChanges 
      });

      // Check if changes are significant enough to warrant an update
      const significantChanges = areChangesSignificant(changeResult, {
        requireCriticalChanges: false, // Allow secondary changes too
        minChangeThreshold: 1,
        ignorePriceFluctuations: true,
        priceFluctuationThreshold: 0.02 // 2% threshold for price changes
      });

      if (!significantChanges) {
        logger.info('Changes not significant; skipping full update but updating timestamps', { 
          functionName: 'updateProduct', 
          productCode,
          changeType: changeResult.changeType,
          changeCount: changeResult.changeCount
        });
        
        const nowIso = getISTTimestamp();
        const nowMs = Date.now();
        await productRef.update({
          updateTimestamp: nowIso,
          updatedatetime: nowMs,
          updatedAt: nowIso
        });
        
        return { status: 200, message: 'NO_SIGNIFICANT_CHANGES_TIMESTAMP_UPDATED' };
      }

      // Prepare update data with only changed fields
      const nowIso = getISTTimestamp();
      const nowMs = Date.now();
      
      const diff = {};
      changeResult.allChanges.forEach(change => {
        diff[change.field] = change.newValue;
      });

      // Ensure timestamps when we do update
      diff.updateTimestamp = nowIso;
      diff.updatedatetime = nowMs;
      diff.updatedAt = nowIso;

      // Ensure fields like createdAt, productId, productCode are preserved
      diff.createdAt = existingProductData.createdAt;
      diff.productId = existingProductData.productId;
      diff.productCode = existingProductData.productCode;
      if(diff.date == existingProductData.date){
        if(!constants.updateTodayDeals) {
          logger.info("DB Found : Updated Product today hence not posting !" , { functionName: 'updateProduct' });
          return { status: 301, message: productStatus.PRODUCT_POSTED_TODAY };

        }
        // return { status: 301, message: productStatus.PRODUCT_POSTED_TODAY };
      }

      // If items exist in updatedData, merge the arrays
      if (updatedData.items) {
        // Get the existing items array
        const existingItems = existingProductData.items || [];
        // const existingItems = productSnapshot.val().items || []; // Default to empty array if no items exist
        let newItems = []
        // Append new items to the existing array
        if (existingItems && Array.isArray(existingItems)) {
          newItems = [...existingItems, ...updatedData.items];
        }

        // Update the items array in the database
        await productRef.child('items').set(newItems);

        // Update other fields using diff - ensure no undefined values
        const sanitizedDiff = sanitizeForFirebase(diff);
        await productRef.update({
          ...sanitizedDiff,
          items: newItems // Ensure items are updated with the combined array
        });
      } else {
        // Update only the changed fields - ensure no undefined values
        const sanitizedDiff = sanitizeForFirebase(diff);
        await productRef.update(sanitizedDiff);
      }
      console.log('Product updated successfully!');
      return { status: 200, message: productStatus.PRODUCT_UPDATED_SUCCESSFULLY }; // Return success status
    } else {
        // Create a new product - ensure no undefined values
        const sanitizedData = sanitizeForFirebase(updatedData);
        await productRef.set(sanitizedData); // Use .set() directly on the reference
      console.log('New product created!');
      return { status: 201, message: productStatus.PRODUCT_CREATED }; // Return success status for creation
    }
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 'permission-denied') {
      return { status: 403, message: 'Permission denied' }; // Handle specific error
    } else {
      return { status: 500, message: 'Internal server error' }; // Return error status
    }
  }
}

module.exports = updateProduct;

// // Example usage:
// const productCode = 'ABC123'; // Replace with your actual product code
// // const updatedData = {
// //   price: 29,  // to check if record is patch or put
// //   discount: 50.1,
// //   newAttribute: 'someValue', // Add a new attribute
// //   // helloCheck:'adding new value'
// // };





// let updatedData = {
//   // price: 50,  // to check if record is patch or put
//   discount: 43.1,
//   // newAttribute: 'someValueNew', // Add a new attribute
//   items: []  // Initially an empty array to store objects
// };

// // Add an object to the array
// // updatedData.items.push({
// //   id: 1,
// //   name: "itemName",
// //   value: "itemValue"
// // });

// // Add another object to the array
// updatedData.items.push({
//   id: 2,
//   name: "secondItemTwiceAgain",
//   value: "secondValueTwiceAgain"
// });

// console.log(updatedData);


// response = updateProduct(productCode, updatedData);
// console.log("Response is ",response)
