const admin = require('firebase-admin');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('webpush-service');

/**
 * Extracts all valid unique FCM tokens across multiple devices for a user.
 * Supports:
 *  - Multi-device channels.fcm_tokens map ({ [safeKey]: { token, deviceType, platform } })
 *  - Legacy single-token channels.webpush string
 */
function extractUserTokens(u) {
  const tokenMap = new Map();

  // 1. Check multi-device map
  if (u.channels?.fcm_tokens && typeof u.channels.fcm_tokens === 'object') {
    for (const [key, item] of Object.entries(u.channels.fcm_tokens)) {
      if (typeof item === 'string' && item.trim()) {
        const tok = item.trim();
        tokenMap.set(tok, { token: tok, key, device: 'Browser', deviceType: 'unknown' });
      } else if (item && typeof item === 'object' && item.token) {
        const tok = String(item.token).trim();
        if (tok) {
          tokenMap.set(tok, {
            token: tok,
            key,
            device: item.platform || item.deviceType || 'device',
            deviceType: item.deviceType || 'unknown'
          });
        }
      }
    }
  }

  // 2. Check legacy / primary webpush field
  if (u.channels?.webpush) {
    if (typeof u.channels.webpush === 'string' && u.channels.webpush.trim()) {
      const tok = u.channels.webpush.trim();
      if (!tokenMap.has(tok)) {
        tokenMap.set(tok, { token: tok, key: 'primary', device: 'Primary Device', deviceType: 'primary' });
      }
    } else if (typeof u.channels.webpush === 'object') {
      for (const [k, val] of Object.entries(u.channels.webpush)) {
        const tok = typeof val === 'string' ? val.trim() : (val?.token ? String(val.token).trim() : null);
        if (tok && !tokenMap.has(tok)) {
          tokenMap.set(tok, { token: tok, key: k, device: val?.platform || 'device', deviceType: val?.deviceType || 'unknown' });
        }
      }
    }
  }

  return Array.from(tokenMap.values());
}

/**
 * Get all users subscribed to Web Push (FCM), including multi-device breakdown
 */
async function getWebPushSubscribers() {
  const users = await userFavoritesDB.getAllUsers();
  const subscribers = [];
  const allUsersList = [];
  let totalDevices = 0;

  for (const [uid, u] of Object.entries(users || {})) {
    const devices = extractUserTokens(u);
    const hasWebpush = devices.length > 0;
    totalDevices += devices.length;

    const userSummary = {
      uid,
      name: u.displayName || u.profile?.displayName || 'User',
      email: u.email || u.profile?.email || 'N/A',
      hasWebpush,
      devicesCount: devices.length,
      devices,
      // Retain token string for backward compatibility
      token: devices.length > 0 ? devices[0].token : null
    };

    allUsersList.push(userSummary);
    if (hasWebpush) {
      subscribers.push(userSummary);
    }
  }

  return {
    totalUsers: allUsersList.length,
    subscribersCount: subscribers.length,
    totalDevices,
    subscribers,
    allUsers: allUsersList
  };
}

/**
 * Broadcast Web Push notification to all subscribers and all their registered devices
 */
async function broadcastWebPush({ title, body, link, icon, badge, extraData = {} } = {}) {
  const { subscribers, totalDevices } = await getWebPushSubscribers();
  if (!subscribers || subscribers.length === 0) {
    logger.warn('No active Web Push subscribers found to notify.');
    return { success: true, count: 0, totalDevices: 0, sent: 0, failed: 0, details: [] };
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
    icon: icon || 'https://lowerdeal.com/logo192_v2.png',
    badge: badge || 'https://lowerdeal.com/logo192_v2.png'
  };

  const results = [];
  let sentCount = 0;
  let failCount = 0;

  for (const sub of subscribers) {
    // Deliver to EVERY device of this subscriber
    for (const dev of sub.devices) {
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
        token: dev.token
      };

      try {
        const response = await userApp.messaging().send(message);
        sentCount++;
        results.push({
          uid: sub.uid,
          email: sub.email,
          name: sub.name,
          device: dev.device,
          deviceType: dev.deviceType,
          status: 'delivered',
          messageId: response
        });
        logger.info(`Web Push sent successfully to ${sub.name} (${sub.email}) [${dev.device}]`, { messageId: response });
      } catch (err) {
        failCount++;
        const isUnregistered = err.code === 'messaging/registration-token-not-registered';
        results.push({
          uid: sub.uid,
          email: sub.email,
          name: sub.name,
          device: dev.device,
          deviceType: dev.deviceType,
          status: 'failed',
          error: err.message,
          unregistered: isUnregistered
        });
        logger.warn(`Web Push send failed for ${sub.name} (${sub.email}) [${dev.device}]: ${err.message}`);

        // Clean up unregistered/stale token from multi-device map
        if (isUnregistered && dev.key && dev.key !== 'primary') {
          try {
            const db = userApp.database ? userApp.database() : admin.database();
            await db.ref(`users/${sub.uid}/channels/fcm_tokens/${dev.key}`).remove();
            logger.info(`Cleaned up unregistered FCM token for user ${sub.uid}: ${dev.key}`);
          } catch (cleanupErr) {
            logger.warn('Failed to clean up stale token:', cleanupErr.message);
          }
        }
      }
    }
  }

  return {
    success: true,
    totalSubscribers: subscribers.length,
    totalDevices,
    sent: sentCount,
    failed: failCount,
    results
  };
}

module.exports = {
  extractUserTokens,
  getWebPushSubscribers,
  broadcastWebPush
};
