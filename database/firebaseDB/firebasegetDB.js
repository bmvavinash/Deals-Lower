// Get a reference to the database
const database = firebase.database();

// Get a reference to the specific location where you want to check the key
const ref = database.ref('your/path/to/data');

// Check if the key exists
ref.child('yourKey').once('value', (snapshot) => {
  if (snapshot.exists()) {
    console.log('Key exists!');
  } else {
    console.log('Key does not exist!');
  }
});
