const admin = require('firebase-admin'); 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
admin.initializeApp({ credential: admin.credential.cert(require('C:/Users/anila/keys/lowerdealhub-firebase-adminsdk-fbsvc-fa13fd2614.json')), databaseURL: 'https://lowerdealhub-default-rtdb.asia-southeast1.firebasedatabase.app' }); 
admin.database().ref('/productdeals').orderByChild('productCode').equalTo('ACC8BD936515F7F9').once('value').then(s => { console.log(JSON.stringify(s.val(), null, 2)); process.exit(0); }).catch(console.error);
