process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('./database/firebaseDB/productDealsDB');
const { notificationQueue } = require('./services/NotificationQueueService');

async function trigger() {
    const token = 'cZh0qF8k5GQO9DoirT6pzy:APA91bHxeEm3yYwVB8enkGQfGFFJE8qLSsYghs-lczm7gPSjxhXI0v7zfgmMfhsMzuNqNSSZzyOV4a8TWl-XvNoiwghV-pKtYobgZKw2ccUwmsgU4IKr9YI';
    
    console.log('Enqueuing Web Push notification...');
    
    await notificationQueue.enqueue('webpush', {
        title: '\uD83D\uDD25 Live Deal Alert! | LowerDeal',
        message: 'Amazon 8PM Deals are now Live on lowerdeal.com!',
        link: 'https://lowerdeal.com',
        token: token
    });
    
    console.log('Successfully enqueued! The background worker will pick it up instantly.');
    process.exit(0);
}

trigger();
