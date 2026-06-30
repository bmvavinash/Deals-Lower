const fs = require('fs');
const path = require('path');
const https = require('https');
const constants = require('../config/constants.js');
const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('notifyService');

// Optional notification tracking (backward compatible)
let notificationTrackingDB = null;
try {
  notificationTrackingDB = require('../database/firebaseDB/notificationTrackingDB').notificationTrackingDB;
} catch (error) {
  // Tracking is optional, continue without it
  logger.debug('Notification tracking not available (optional feature)');
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function notifyTelegram(telegramChatId, message, productCode = null, dealType = 'productDeal', photoUrl = '') {
  if (!constants.notifications.enableTelegram) return false;
  if (!telegramChatId) return false;
  
  let success = false;
  let error = null;
  
  try {
    // Import Telegram bot from existing implementation
    const { telegram } = require('../socialMedia/telegramPoster');
    
    // Send message using user alerts bot token (7011681754:AAEyn1F1...)
    const botToken = process.env.BOT_TOKEN || '7011681754:AAEyn1F1h9k-4Lw-b-K_1B9p10_13-z_w2A';
    await telegram(photoUrl || "", telegramChatId, message, botToken);
    
    success = true;
    logger.info('Telegram notification sent', { telegramChatId, preview: message?.slice?.(0, 120) });
    
    // Track notification if productCode provided and tracking available
    if (productCode && notificationTrackingDB) {
      try {
        await notificationTrackingDB.trackNotification(productCode, 'telegram', success, dealType, error);
      } catch (trackError) {
        logger.warn('Failed to track Telegram notification', { error: trackError.message });
      }
    }
    
    return true;
    
  } catch (err) {
    error = err.message;
    logger.error('Telegram notification failed', { telegramChatId, error: error });
    
    // Track failed notification
    if (productCode && notificationTrackingDB) {
      try {
        await notificationTrackingDB.trackNotification(productCode, 'telegram', false, dealType, error);
      } catch (trackError) {
        logger.warn('Failed to track Telegram notification failure', { error: trackError.message });
      }
    }
    
    return false;
  }
}

async function notifyWhatsapp(phone, message, productCode = null, dealType = 'productDeal', photoUrl = '') {
  if (!constants.notifications.enableWhatsapp) return false;
  if (!phone) return false;
  
  let success = false;
  let error = null;
  let tempLocalPath = null;
  
  try {
    // Use existing Chrome instance on port 9222 for WhatsApp Web
    const { Builder, By, Key, until } = require('selenium-webdriver');
    const chrome = require('selenium-webdriver/chrome');
    
    const options = new chrome.Options();
    options.debuggerAddress("localhost:9222"); // Connect to existing Chrome instance
    
    const driver = await chrome.Driver.createSession(options);
    
    // Navigate directly to WhatsApp chat with the phone number
    await driver.get(`https://web.whatsapp.com/send?phone=${phone}`);
    await driver.sleep(5000); // Wait for WhatsApp to load
    
    try {
      if (photoUrl) {
        // Download image locally to send as file attachment
        const timestamp = Date.now();
        const scratchDir = path.join(__dirname, '../scratch');
        if (!fs.existsSync(scratchDir)) {
          fs.mkdirSync(scratchDir, { recursive: true });
        }
        tempLocalPath = path.join(scratchDir, `wa_upload_${timestamp}.jpg`);
        
        logger.info('Downloading image for WhatsApp attachment...', { url: photoUrl });
        await downloadImage(photoUrl, tempLocalPath);
        
        // Find file input and upload
        const fileInput = await driver.wait(
          until.elementLocated(By.css('input[type="file"]')),
          10000
        );
        await fileInput.sendKeys(tempLocalPath);
        await driver.sleep(4000); // Wait for preview
        
        // Focus the caption box (which reuses the compose box testid on preview)
        const captionInput = await driver.wait(
          until.elementLocated(By.css('div[data-testid="conversation-compose-box-input"]')),
          10000
        );
        await driver.executeScript("arguments[0].focus(); arguments[0].click();", captionInput);
        await driver.sleep(1000);
        
        // Type caption text
        const messageLines = message.split('\n');
        for (let i = 0; i < messageLines.length; i++) {
          const line = messageLines[i];
          await driver.actions().sendKeys(line).perform();
          if (i < messageLines.length - 1) {
            await driver.actions()
              .keyDown(Key.SHIFT)
              .keyDown(Key.RETURN)
              .keyUp(Key.RETURN)
              .keyUp(Key.SHIFT)
              .perform();
          }
        }
        await driver.sleep(1000);
        
        // Click send button
        const sendBtn = await driver.wait(
          until.elementLocated(By.css('div[role="button"][aria-label*="Send"]')),
          5000
        );
        await driver.executeScript("arguments[0].click();", sendBtn);
        await driver.sleep(3000);
        
      } else {
        // Regular text-only send logic
        const messageInput = await driver.wait(
          until.elementLocated(By.css('div[contenteditable="true"]')), 
          15000
        );
        await messageInput.click();
        
        const messageLines = message.split('\n');
        for (let i = 0; i < messageLines.length; i++) {
          const line = messageLines[i];
          await driver.actions().sendKeys(line).perform();
          if (i < messageLines.length - 1) {
            await driver.actions()
              .keyDown(Key.SHIFT)
              .keyDown(Key.RETURN)
              .keyUp(Key.RETURN)
              .keyUp(Key.SHIFT)
              .perform();
          }
        }
        await driver.sleep(1000);
        await driver.actions().sendKeys(Key.RETURN).perform();
        await driver.sleep(2000);
      }
      
      success = true;
      logger.info('WhatsApp notification sent', { phone, preview: message?.slice?.(0, 120) });
      
      // Clean up local temp file
      if (tempLocalPath && fs.existsSync(tempLocalPath)) {
        try {
          fs.unlinkSync(tempLocalPath);
        } catch (cleanupErr) {
          logger.warn('Failed to delete temporary WhatsApp upload image file', { error: cleanupErr.message });
        }
      }
      
      // Track notification if productCode provided
      if (productCode && notificationTrackingDB) {
        try {
          await notificationTrackingDB.trackNotification(productCode, 'whatsapp', success, dealType, error);
        } catch (trackError) {
          logger.warn('Failed to track WhatsApp notification', { error: trackError.message });
        }
      }
      
      return true;
      
    } catch (err) {
      error = err.message;
      logger.error('WhatsApp message input failed', { phone, error: error });
      
      // Clean up local temp file in case of error
      if (tempLocalPath && fs.existsSync(tempLocalPath)) {
        try {
          fs.unlinkSync(tempLocalPath);
        } catch (cleanupErr) {}
      }
      
      // Track failed notification
      if (productCode && notificationTrackingDB) {
        try {
          await notificationTrackingDB.trackNotification(productCode, 'whatsapp', false, dealType, error);
        } catch (trackError) {
          logger.warn('Failed to track WhatsApp notification failure', { error: trackError.message });
        }
      }
      
      return false;
    }
    
  } catch (err) {
    error = err.message;
    logger.error('WhatsApp notification failed', { phone, error: error });
    
    // Track failed notification
    if (productCode && notificationTrackingDB) {
      try {
        await notificationTrackingDB.trackNotification(productCode, 'whatsapp', false, dealType, error);
      } catch (trackError) {
        logger.warn('Failed to track WhatsApp notification failure', { error: trackError.message });
      }
    }
    
    return false;
  }
}

async function notifyPush(pushToken, title, body, data) {
  if (!constants.notifications.enablePush) return false;
  if (!pushToken) return false;
  // TODO: integrate with FCM
  logger.info('Would send Push', { pushToken, title, preview: body?.slice?.(0, 120) });
  return true;
}

async function notifyBrowser(subscription, title, body, data) {
  if (!constants.notifications.enableBrowser) return false;
  if (!subscription) return false;
  // TODO: integrate with Web Push (VAPID)
  logger.info('Would send Browser notification', { title, preview: body?.slice?.(0, 120) });
  return true;
}

function isWithinDND(preferences) {
  if (!constants.notifications.respectDoNotDisturb) return false;
  const dnd = preferences?.doNotDisturb;
  if (!dnd?.start || !dnd?.end) return false;
  try {
    const now = new Date();
    const [sH, sM = 0] = String(dnd.start).split(':').map(Number);
    const [eH, eM = 0] = String(dnd.end).split(':').map(Number);
    const start = new Date(now);
    start.setHours(sH, sM, 0, 0);
    const end = new Date(now);
    end.setHours(eH, eM, 0, 0);
    if (end <= start) {
      // spans midnight
      return now >= start || now <= end;
    }
    return now >= start && now <= end;
  } catch {
    return false;
  }
}

function buildMessage(product) {
  const price = product?.price ? `₹${product.price}` : '';
  const discount = product?.discount ? ` (${product.discount}% off)` : '';
  const title = product?.title || product?.shortText || product?.urltext || 'Deal update';
  const url = product?.productUrl || product?.deeplink || '';
  return `${title}\nPrice: ${price}${discount}\nStore: ${product?.storeType || ''}\n${url}`.trim();
}

module.exports = { notifyTelegram, notifyWhatsapp, notifyPush, notifyBrowser, isWithinDND, buildMessage };


