process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('./database/firebaseDB/productDealsDB');
const { notificationQueue } = require('./services/NotificationQueueService');

async function trigger() {
    const token = 'cZh0qF8k5GQO9DoirT6pzy:APA91bHxeEm3yYwVB8enkGQfGFFJE8qLSsYghs-lczm7gPSjxhXI0v7zfgmMfhsMzuNqNSSZzyOV4a8TWl-XvNoiwghV-pKtYobgZKw2ccUwmsgU4IKr9YI';
    
    console.log('Enqueuing Web Push notification...');
    
    await notificationQueue.enqueue('webpush', {
        title: '🔥 Live Deal Alert!',
        message: 'This is a test web push notification directly from the backend queue!',
        link: 'http://localhost:3000',
        token: token
    });
    
    console.log('Successfully enqueued! The background worker will pick it up instantly.');
    process.exit(0);
}

trigger();
