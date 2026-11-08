// Post or patch (but for objects its put(overwriting the existing object))
var firebase = require('firebase/app');
var database = require('firebase/database');
const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { productStatus } = require('../../config/const.js');
const { getModuleLogger } = require("../../logger/logger.js");
const { detectChanges, areChangesSignificant, logChanges } = require("../../utils/changeDetection.js");
const { getISTTimestamp, validateText } = require('../../utils/commonUtils');

env=constants.env

const logger = getModuleLogger('firebaseUpdate');

const dbname= constants.postingTypesConfig[constants.type].DB
let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME
const defaultApp = admin.apps.find(app => app.name === '[DEFAULT]');
if (!defaultApp) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  if (!serviceAccount) {
    try {
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    } catch (e) {
      console.error(`Firebase credentials file not found at ${constants.pathToFile}/${filePath}.json and no FIREBASE_SERVICE_ACCOUNT_JSON env variable provided.`);
      throw e;
    }
  }
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
    if (updatedData) {
      if (updatedData.title) {
        const cleanRes = validateText(updatedData.title);
        updatedData.title = cleanRes.value || updatedData.title;
      }
      if (updatedData.productText) {
        const cleanRes = validateText(updatedData.productText);
        updatedData.productText = cleanRes.value || updatedData.productText;
      }
      if (updatedData.urltext) {
        const cleanRes = validateText(updatedData.urltext);
        updatedData.urltext = cleanRes.value || updatedData.urltext;
      }
    }

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

      // Check for price changes: Price Increase (Missed Deal) vs Price Drop
      const oldPrice = parseFloat(String(existingProductData.price || existingProductData.dealPrice || '').replace(/[^0-9.]/g, '')) || 0;
      const newPrice = parseFloat(String(updatedData.price || '').replace(/[^0-9.]/g, '')) || 0;

      if (oldPrice > 0 && newPrice > 0 && Math.abs(oldPrice - newPrice) >= 1) {
        if (newPrice > oldPrice) {
          // Price Increased -> Missed Deal
          diff.isMissedDeal = true;
          diff.isExpired = true;
          diff.dealStatus = 'missed';
          diff.previousPrice = oldPrice;
          diff.dealPrice = existingProductData.dealPrice || oldPrice;
          diff.currentPrice = newPrice;
          diff.missedSavings = Math.round(newPrice - oldPrice);
          diff.isPriceDrop = false;

          logger.info('Detected price increase - marked as Missed Deal', {
            productCode,
            oldPrice,
            newPrice,
            missedSavings: diff.missedSavings
          });

          const tgChatId = existingProductData.telegramChatId || (existingProductData.telegramMessageId ? '@dealshubglobal' : null);
          const tgMsgId = existingProductData.telegramMessageId;
          if (tgChatId && tgMsgId) {
            try {
              const { sendTelegramUpdateAlert } = require('../../socialMedia/telegramPoster');
              const alertMsg = `⚠️ MISSED DEAL / PRICE INCREASED\n\n${existingProductData.title || updatedData.title || 'Product'}\n\nDeal Price Was: ₹${oldPrice}\nCurrent Price: ₹${newPrice}\nYou missed saving: ₹${diff.missedSavings}\n\nLive Link: https://lowerdeal.com/p/${productCode}`;
              sendTelegramUpdateAlert(tgChatId, alertMsg, '', tgMsgId).catch(tgErr => {
                logger.warn('Failed to dispatch Telegram missed deal alert', { error: tgErr.message });
              });
            } catch (tgReqErr) {
              logger.warn('Error loading telegramPoster for alert', { error: tgReqErr.message });
            }
          }
        } else if (newPrice < oldPrice) {
          // Price Decreased -> Price Drop
          diff.isPriceDrop = true;
          diff.isMissedDeal = false;
          diff.isExpired = false;
          diff.dealStatus = 'active';
          diff.previousPrice = oldPrice;
          diff.currentPrice = newPrice;
          diff.price = newPrice;
          diff.priceDropAmount = Math.round(oldPrice - newPrice);

          logger.info('Detected price drop - marked as Price Drop', {
            productCode,
            oldPrice,
            newPrice,
            priceDropAmount: diff.priceDropAmount
          });

          const tgChatId = existingProductData.telegramChatId || (existingProductData.telegramMessageId ? '@dealshubglobal' : null);
          const tgMsgId = existingProductData.telegramMessageId;
          if (tgChatId && tgMsgId) {
            try {
              const { sendTelegramUpdateAlert } = require('../../socialMedia/telegramPoster');
              const alertMsg = `🔥 PRICE DROP ALERT!\n\n${existingProductData.title || updatedData.title || 'Product'}\n\nEarlier Price: ₹${oldPrice}\nNew Deal Price: ₹${newPrice}\nPrice Drop: ₹${diff.priceDropAmount} OFF!\n\nGrab it here: https://lowerdeal.com/p/${productCode}`;
              sendTelegramUpdateAlert(tgChatId, alertMsg, '', tgMsgId).catch(tgErr => {
                logger.warn('Failed to dispatch Telegram price drop alert', { error: tgErr.message });
              });
            } catch (tgReqErr) {
              logger.warn('Error loading telegramPoster for alert', { error: tgReqErr.message });
            }
          }
        }
      }

      // Ensure fields like createdAt, productId, productCode, productNumber are preserved
      diff.createdAt = existingProductData.createdAt;
      diff.productId = existingProductData.productId;
      diff.productCode = existingProductData.productCode;
      if (existingProductData.productNumber) {
        diff.productNumber = existingProductData.productNumber;
      } else if (updatedData.productNumber) {
        diff.productNumber = updatedData.productNumber;
      } else {
        try {
          const { getOrCreateProductNumber } = require("../../services/productNumberService");
          diff.productNumber = await getOrCreateProductNumber(productCode, existingProductData);
        } catch (_) {}
      }
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
        // Create a new product - ensure productNumber is assigned for YouTube and social linking
        if (!updatedData.productNumber) {
          try {
            const { getOrCreateProductNumber } = require("../../services/productNumberService");
            updatedData.productNumber = await getOrCreateProductNumber(productCode, updatedData);
          } catch (_) {}
        }
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
