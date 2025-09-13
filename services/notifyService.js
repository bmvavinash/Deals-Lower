const constants = require('../config/constants.js');
const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('notifyService');

async function notifyTelegram(telegramChatId, message) {
  if (!constants.notifications.enableTelegram) return false;
  if (!telegramChatId) return false;
  
  try {
    // Import Telegram bot from existing implementation
    const { telegram } = require('../socialMedia/telegramPoster');
    
    // Send message using existing Telegram implementation
    await telegram(null, telegramChatId, message);
    
    logger.info('Telegram notification sent', { telegramChatId, preview: message?.slice?.(0, 120) });
    return true;
    
  } catch (error) {
    logger.error('Telegram notification failed', { telegramChatId, error: error.message });
    return false;
  }
}

async function notifyWhatsapp(phone, message) {
  if (!constants.notifications.enableWhatsapp) return false;
  if (!phone) return false;
  
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
      // Wait for and click the message input box
      const messageInput = await driver.wait(
        until.elementLocated(By.xpath('//*[@id="main"]/footer/div[1]/div/span[2]/div/div[2]/div[1]/div/div[1]')), 
        15000
      );
      await messageInput.click();
      
      // Split message into lines and send each line
      const messageLines = message.split('\n');
      for (let i = 0; i < messageLines.length; i++) {
        const line = messageLines[i];
        
        await driver.actions()
          .sendKeys(line)
          .perform();
        
        // Add line break if not the last line
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
      
      // Send the message
      await driver.actions().sendKeys(Key.RETURN).perform();
      await driver.sleep(2000);
      
      logger.info('WhatsApp notification sent', { phone, preview: message?.slice?.(0, 120) });
      return true;
      
    } catch (error) {
      logger.error('WhatsApp message input failed', { phone, error: error.message });
      return false;
    }
    
  } catch (error) {
    logger.error('WhatsApp notification failed', { phone, error: error.message });
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


