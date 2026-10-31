const { TelegramBotKey } = require("../config/constants");
const { getModuleLogger } = require("../logger/logger");

const logger = getModuleLogger('telegramPoster');

/**
 * Send a message or photo with caption to Telegram
 * @param {string} photo - Image URL (optional)
 * @param {string} chat_id - Telegram Channel username or Chat ID
 * @param {string} text - Message text or caption
 * @param {string} token - Bot token override (optional)
 * @returns {Promise<{success: boolean, messageId?: number, chatId?: string|number, isPhoto?: boolean, error?: string, data?: any}>}
 */
async function telegram(photo = "", chat_id = "@dealshubglobal", text = "details", token = "") {
  if (!token) {
    token = TelegramBotKey;
  }

  const isPhoto = Boolean(photo && photo.trim() !== "");
  logger.info(`Sending Telegram post (${isPhoto ? 'Photo + Caption' : 'Text message'})`, {
    chat_id,
    hasPhoto: isPhoto,
    textLength: text ? text.length : 0
  });

  try {
    const url = isPhoto 
      ? `https://api.telegram.org/bot${token}/sendPhoto`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const payload = isPhoto
      ? { chat_id, photo, caption: text }
      : { chat_id, text };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.ok && result.result) {
      const messageId = result.result.message_id;
      const resolvedChatId = result.result.chat ? result.result.chat.id : chat_id;
      logger.info('Telegram post succeeded', {
        messageId,
        chatId: resolvedChatId,
        chatTitle: result.result.chat ? result.result.chat.title : undefined
      });
      return {
        success: true,
        messageId,
        chatId: resolvedChatId,
        isPhoto,
        data: result.result
      };
    } else {
      const errorMsg = result.description || 'Unknown Telegram API error';
      logger.error('Telegram post failed from API', {
        chat_id,
        errorCode: result.error_code,
        error: errorMsg
      });
      return {
        success: false,
        error: errorMsg,
        data: result
      };
    }
  } catch (error) {
    logger.error('Telegram network/request error', {
      chat_id,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Edit an existing Telegram message (supports both text and photo captions)
 * @param {string|number} chatId - Telegram chat/channel ID
 * @param {number} messageId - Message ID to edit
 * @param {string} text - Updated text/caption
 * @param {boolean} isPhoto - Whether the original message contained a photo
 * @param {string} token - Bot token override (optional)
 * @returns {Promise<{success: boolean, alreadyUpdated?: boolean, messageId?: number, chatId?: string|number, error?: string, data?: any}>}
 */
async function editTelegramMessage(chatId, messageId, text, isPhoto = true, token = "") {
  if (!token) {
    token = TelegramBotKey;
  }

  if (!chatId || !messageId) {
    logger.warn('editTelegramMessage called with missing chatId or messageId', { chatId, messageId });
    return { success: false, error: 'Missing chatId or messageId' };
  }

  logger.info('Attempting to edit Telegram message', {
    chatId,
    messageId,
    isPhoto,
    textPreview: text ? text.substring(0, 60) + '...' : ''
  });

  const callTelegramApi = async (method, body) => {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  };

  try {
    let result;

    if (isPhoto) {
      // First attempt: editMessageCaption for media messages
      result = await callTelegramApi('editMessageCaption', {
        chat_id: chatId,
        message_id: messageId,
        caption: text,
        parse_mode: 'HTML'
      });

      // Fallback: if message was actually a text message or caption not allowed
      if (!result.ok && result.description && (
        result.description.includes('there is no text in the message to edit') ||
        result.description.includes('message is not a photo') ||
        result.description.includes('message to edit not found')
      )) {
        logger.debug('editMessageCaption failed, falling back to editMessageText', { chatId, messageId, desc: result.description });
        result = await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });
      }
    } else {
      // First attempt: editMessageText for regular text messages
      result = await callTelegramApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      // Fallback: if message actually had media/photo
      if (!result.ok && result.description && result.description.includes('there is no text in the message to edit')) {
        logger.debug('editMessageText failed, falling back to editMessageCaption', { chatId, messageId, desc: result.description });
        result = await callTelegramApi('editMessageCaption', {
          chat_id: chatId,
          message_id: messageId,
          caption: text,
          parse_mode: 'HTML'
        });
      }
    }

    if (result.ok) {
      logger.info('Telegram message successfully edited', { chatId, messageId });
      return { success: true, messageId, chatId, data: result.result };
    }

    // Handle Telegram 400 error when text has not changed
    if (result.description && result.description.includes('message is not modified')) {
      logger.info('Telegram message is already up to date (not modified)', { chatId, messageId });
      return { success: true, alreadyUpdated: true, messageId, chatId };
    }

    logger.error('Telegram editMessage API error', {
      chatId,
      messageId,
      errorCode: result.error_code,
      error: result.description
    });
    return { success: false, error: result.description, errorCode: result.error_code };
  } catch (error) {
    logger.error('Telegram editMessage exception', {
      chatId,
      messageId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  telegram,
  editTelegramMessage
};
