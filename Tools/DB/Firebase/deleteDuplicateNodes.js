// Initialize Firebase


var firebase = require('firebase/app');
var database = require('firebase/database');
const admin = require('firebase-admin');
const constants = require('../config/constants.js');
const config = require('../config/config.js');

env=constants.env



const dbname= constants.postingTypesConfig[constants.type].DB
let DB_Name=config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME

// const apiUrl = `https://${DB_Name}-default-rtdb.firebaseio.com/${jsonFileName}.json?access_token=${access_token}`

// Initialize Firebase
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com` // Replace with your database URL
});

const db = admin.database();


const firebaseConfig = {

    apiKey: "AIzaSyCpZ8uiuSbimONqtRufvR8WBiUBFt7-_UI",
    authDomain: `${DB_Name}.firebaseapp.com`,
    databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`,
    projectId: `${DB_Name}`,
    storageBucket: `${DB_Name}.appspot.com`,
    messagingSenderId: "848061960225",
    appId: "1:848061960225:web:30d1b2fbd6c6243b2e1360",
    measurementId: "G-HJNCM2MN6Q"
        
  // Your Firebase configuration
};
// const firebaseConfig = {
//     // Your Firebase configuration goes here
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_AUTH_DOMAIN",
//     databaseURL: "YOUR_DATABASE_URL",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_STORAGE_BUCKET",
//     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//     appId: "YOUR_APP_ID"
//   };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Get a reference to the database
  const database = firebase.database();
  const productsRef = database.ref('products');
  
  // Function to remove duplicates
  function removeDuplicates() {
    productsRef.once('value', (snapshot) => {
      const products = snapshot.val();
      const uniqueProductCodes = new Set(); // Use a Set to track unique product codes
  
      // Iterate through each product
      for (const productId in products) {
        const product = products[productId];
        const productCode = product.productCode;
  
        // Check if the product code is already in the set
        if (uniqueProductCodes.has(productCode)) {
          // Duplicate found, delete the record
        //   database.ref(`products/${productId}`).remove();
            console.log("Product Code is ",productCode);
        } else {
          // Add the product code to the set
          uniqueProductCodes.add(productCode);
        }
      }
    });
  }
  
  // Call the function to remove duplicates
  removeDuplicates();
  