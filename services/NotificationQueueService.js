const { getModuleLogger } = require('../logger/logger');
const admin = require('firebase-admin');
const { telegram } = require('../socialMedia/telegramPoster');
const { whatsapp } = require('../socialMedia/whatsappPoster');

const isLocalFallback = false;

const logger = getModuleLogger('notification-queue');

const db = () => admin.database();

class NotificationQueueService {
  constructor() {
    this.isProcessing = false;
    
    // Delays to prevent getting blocked (in milliseconds)
    this.DELAYS = {
      telegram: 0,      // No delay for Telegram
      whatsapp: 15000,  // 15 seconds between WhatsApp messages
      webpush: 1000     // 1 second between Web Push
    };
  }

  get queueRef() {
    return db().ref('notification_queue');
  }

  /**
   * Add a notification to the queue instead of sending it immediately.
   */
  async enqueue(channel, data) {
    try {
      if (isLocalFallback) {
        logger.warn('Local fallback active, skipping queue enqueue');
        return false;
      }
      
      const payload = {
        channel,
        data,
        status: 'pending',
        createdAt: Date.now()
      };
      
      await this.queueRef.push(payload);
      logger.info(`Enqueued ${channel} notification successfully.`);
      return true;
    } catch (error) {
      logger.error(`Error enqueueing ${channel} notification`, { error: error.message });
      return false;
    }
  }

  /**
   * Start the background worker that processes the queue sequentially.
   */
  startWorker() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    logger.info('Started Notification Queue Worker.');
    this.processNext();
  }

  /**
   * Process the next notification in the queue.
   */
  async processNext() {
    try {
      if (isLocalFallback) {
        this.isProcessing = false;
        return;
      }

      // Fetch the oldest pending notification
      const snapshot = await this.queueRef
        .orderByChild('status')
        .equalTo('pending')
        .limitToFirst(1)
        .once('value');

      const val = snapshot.val();
      if (!val) {
        // Queue is empty, check again after 10 seconds
        setTimeout(() => this.processNext(), 10000);
        return;
      }

      const key = Object.keys(val)[0];
      const job = val[key];

      // Mark as processing to avoid duplicate processing
      await this.queueRef.child(key).update({ status: 'processing', processedAt: Date.now() });

      let success = false;
      
      try {
        if (job.channel === 'telegram') {
            await telegram(job.data.photo, job.data.chatId, job.data.text, job.data.token || "");
            success = true;
        } else if (job.channel === 'whatsapp') {
            // NOTE: If WhatsApp login isn't available on the server, 
            // a separate local client should consume 'whatsapp' jobs from Firebase instead.
            // For now, we will still attempt it if selenium is available.
            try {
                await whatsapp(job.data.watsCode || "", job.data.text);
                success = true;
            } catch (waErr) {
                logger.error('WhatsApp sending failed (possibly requires local client login)', { error: waErr.message });
                // We leave success=false so it can be handled appropriately or logged
            }
        } else if (job.channel === 'webpush') {
            // Actual implementation for Web Push via FCM
            if (!job.data.token) {
                logger.error('Web Push failed: No target token provided');
            } else {
                let cleanTitle = job.data.title || '\uD83D\uDD25 New Deal Alert! | LowerDeal';
                if (cleanTitle.startsWith('??')) cleanTitle = cleanTitle.replace(/^(\?\?|\?)\s*/, '\uD83D\uDD25 ');
                
                let cleanBody = job.data.message || job.data.body || 'Check out this new deal on lowerdeal.com!';
                cleanBody = cleanBody.replace(/http:\/\/localhost:3000/g, 'https://lowerdeal.com').replace(/localhost:3000/g, 'lowerdeal.com');
                
                let cleanLink = job.data.link || 'https://lowerdeal.com';
                cleanLink = cleanLink.replace(/http:\/\/localhost:3000/g, 'https://lowerdeal.com');

                const message = {
                    notification: {
                        title: cleanTitle,
                        body: cleanBody
                    },
                    data: {
                        title: cleanTitle,
                        message: cleanBody,
                        link: cleanLink,
                        source: 'lowerdeal.com'
                    },
                    webpush: {
                        fcmOptions: {
                            link: cleanLink
                        },
                        notification: {
                            icon: 'https://lowerdeal.com/logo192.png',
                            badge: 'https://lowerdeal.com/logo192.png'
                        }
                    },
                    token: job.data.token
                };
                
                // Get the secondary app which handles user profiles (dealshub-users)
                // This matches the frontend SenderID.
                try {
                    const userApp = admin.app('user-favourites');
                    await userApp.messaging().send(message);
                    logger.info('Web Push notification triggered successfully to FCM');
                    success = true;
                } catch (e) {
                    if (e.code === 'app/no-app') {
                        // Fallback to default if user-favourites isn't initialized yet
                        await admin.messaging().send(message);
                        logger.info('Web Push notification triggered successfully to FCM (default app)');
                        success = true;
                    } else {
                        throw e;
                    }
                }
            }
        } else {
            logger.warn(`Unknown notification channel: ${job.channel}`);
        }
      } catch (sendError) {
        logger.error(`Error sending ${job.channel} notification`, { error: sendError.message, key });
      }

      // Delete the job from the queue after processing
      await this.queueRef.child(key).remove();
      logger.info(`Processed ${job.channel} notification. Status: ${success ? 'Success' : 'Failed'}`);

      // Fetch dynamic delays from Firebase config (so it can be controlled via admin page)
      let dynamicDelays = { ...this.DELAYS, telegram: 0 }; // Default telegram to 0
      try {
          const delaySnap = await db().ref('config/notification_delays').once('value');
          if (delaySnap.exists()) {
              dynamicDelays = { ...dynamicDelays, ...delaySnap.val() };
          }
      } catch (err) {
          logger.warn('Failed to fetch dynamic notification delays, using defaults');
      }

      // Apply the delay based on the channel before processing the next one
      const delayMs = dynamicDelays[job.channel] !== undefined ? dynamicDelays[job.channel] : 5000;
      
      if (delayMs > 0) {
          setTimeout(() => this.processNext(), delayMs);
      } else {
          // Use setImmediate to avoid deep recursion if delay is 0
          setImmediate(() => this.processNext());
      }

    } catch (error) {
      logger.error('Error in Notification Queue Worker', { error: error.message });
      // Retry after delay on error
      setTimeout(() => this.processNext(), 10000);
    }
  }
}

// Export a singleton instance
const notificationQueue = new NotificationQueueService();
module.exports = { notificationQueue };
