const admin = require('firebase-admin');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('webpush-service');

/**
 * Get all users subscribed to Web Push (FCM)
 */
async function getWebPushSubscribers() {
  const users = await userFavoritesDB.getAllUsers();
  const subscribers = [];
  const allUsersList = [];

  for (const [uid, u] of Object.entries(users || {})) {
    const hasWebpush = Boolean(u.channels && u.channels.webpush);
    const userSummary = {
      uid,
      name: u.displayName || u.profile?.displayName || 'User',
      email: u.email || u.profile?.email || 'N/A',
      hasWebpush,
      token: hasWebpush ? u.channels.webpush : null
    };
    allUsersList.push(userSummary);
    if (hasWebpush) {
      subscribers.push(userSummary);
    }
  }

  return {
    totalUsers: allUsersList.length,
    subscribersCount: subscribers.length,
    subscribers,
    allUsers: allUsersList
  };
}

/**
 * Broadcast Web Push notification to all subscribers
 */
async function broadcastWebPush({ title, body, link, icon, badge, extraData = {} } = {}) {
  const { subscribers } = await getWebPushSubscribers();
  if (!subscribers || subscribers.length === 0) {
    logger.warn('No active Web Push subscribers found to notify.');
    return { success: true, count: 0, sent: 0, failed: 0, details: [] };
  }

  let userApp;
  try {
    userApp = admin.app('user-favourites');
  } catch (e) {
    userApp = admin.app();
  }

  let cleanTitle = title || '\uD83D\uDD25 New Sale is LIVE! | LowerDeal';
  if (cleanTitle.startsWith('??')) cleanTitle = cleanTitle.replace(/^(\?\?|\?)\s*/, '\uD83D\uDD25 ');

  let cleanBody = body || 'Amazon 8PM Deals are now Live on lowerdeal.com! Don’t miss limited-time price drops.';
  cleanBody = cleanBody.replace(/http:\/\/localhost:3000/g, 'https://lowerdeal.com').replace(/localhost:3000/g, 'lowerdeal.com');

  let cleanLink = link || 'https://lowerdeal.com';
  cleanLink = cleanLink.replace(/http:\/\/localhost:3000/g, 'https://lowerdeal.com');

  const payload = {
    title: cleanTitle,
    body: cleanBody,
    link: cleanLink,
    icon: icon || 'https://lowerdeal.com/logo192.png',
    badge: badge || 'https://lowerdeal.com/logo192.png'
  };

  const results = [];
  let sentCount = 0;
  let failCount = 0;

  for (const sub of subscribers) {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: {
        title: payload.title,
        message: payload.body,
        link: payload.link,
        source: 'lowerdeal.com',
        ...extraData
      },
      webpush: {
        fcmOptions: {
          link: payload.link
        },
        notification: {
          icon: payload.icon,
          badge: payload.badge
        }
      },
      token: sub.token
    };

    try {
      const response = await userApp.messaging().send(message);
      sentCount++;
      results.push({
        uid: sub.uid,
        email: sub.email,
        name: sub.name,
        status: 'delivered',
        messageId: response
      });
      logger.info(`Web Push sent successfully to ${sub.name} (${sub.email})`, { messageId: response });
    } catch (err) {
      failCount++;
      const isUnregistered = err.code === 'messaging/registration-token-not-registered';
      results.push({
        uid: sub.uid,
        email: sub.email,
        name: sub.name,
        status: 'failed',
        error: err.message,
        unregistered: isUnregistered
      });
      logger.warn(`Web Push send failed for ${sub.name} (${sub.email}): ${err.message}`);
    }
  }

  return {
    success: true,
    totalSubscribers: subscribers.length,
    sent: sentCount,
    failed: failCount,
    results
  };
}

module.exports = {
  getWebPushSubscribers,
  broadcastWebPush
};
