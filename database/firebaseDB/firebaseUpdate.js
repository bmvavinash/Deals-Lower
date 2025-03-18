// Post or patch (but for objects its put(overwriting the existing object))
var firebase = require('firebase/app');
var database = require('firebase/database');
const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { productStatus } = require('../../config/const.js');
const { getModuleLogger } = require("../../logger/logger.js");

env=constants.env

const logger = getModuleLogger('firebaseUpdate');

const dbname= constants.postingTypesConfig[constants.type].DB
let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
});

const db = admin.database();


const firebaseConfig = {

    apiKey: constants.FirebaseApiKey,
    authDomain: `${DB_Name}.firebaseapp.com`,
    databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`,
    projectId: `${DB_Name}`,
    storageBucket: `${DB_Name}.appspot.com`,
    messagingSenderId: "848061960225",
    appId: "1:848061960225:web:30d1b2fbd6c6243b2e1360",
    measurementId: "G-HJNCM2MN6Q"
        
  // Your Firebase configuration
};
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

      // Create an object to hold the merged data
      const mergedData = {
        ...existingProductData, // Preserve existing fields
        ...updatedData, // Merge with updated data
      };

      // Ensure fields like createdAt, productId, productCode are preserved
      mergedData.createdAt = existingProductData.createdAt;
      mergedData.productId = existingProductData.productId;
      mergedData.productCode = existingProductData.productCode;
      if(mergedData.date == existingProductData.date){
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

        // Update other fields
        await productRef.update({
          ...updatedData,
          items: newItems // Ensure items are updated with the combined array
        });
      } else {
        // Update only the specified fields
        const fieldsToUpdate = Object.keys(updatedData);
        const updateData = {};
        fieldsToUpdate.forEach(field => {
          updateData[field] = updatedData[field];
        });
        await productRef.update(updateData);
      }
      console.log('Product updated successfully!');
      return { status: 200, message: productStatus.PRODUCT_UPDATED_SUCCESSFULLY }; // Return success status
    } else {
        // Create a new product
        await productRef.set(updatedData); // Use .set() directly on the reference
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