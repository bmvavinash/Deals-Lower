const { TelegramBotKey } = require("../config/constants");

async function telegram(photo = "", chat_id = "@dealshubglobal", text = "details", token = "", thread_id = null) {
  if (!token) {
    token = TelegramBotKey;
  }

  // AIR-TIGHT GUARD: Never send Deals to Stocks channels
  if (chat_id === '@dealsequity' || chat_id === '-1004332585915') {
    console.error(`[CRITICAL SECURITY BLOCK] Blocked deals poster from sending to Stocks channel: ${chat_id}`);
    return false;
  }

  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    try {
      if (!photo || photo.trim() === "") {
        console.log('Telegram deals post without photo to ' + chat_id);
        const payload = {
          chat_id: chat_id,
          text: text
        };
        if (thread_id) {
          payload.message_thread_id = Number(thread_id);
        }

        const requestOptions = {
          method: "POST",
          headers: myHeaders,
          body: JSON.stringify(payload)
        };
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, requestOptions);
        const result = await response.json();
        if (!result.ok) {
          console.error('Telegram deal send error:', result);
        } else if (result.result && result.result.message_id) {
          telegram.lastMessageId = result.result.message_id;
          telegram.lastChatId = chat_id;
        }
        return result.ok;
      } else {
        console.log('Telegram deals post with photo to ' + chat_id);
        const payload = {
          chat_id: chat_id,
          photo: photo,
          caption: text
        };
        if (thread_id) {
          payload.message_thread_id = Number(thread_id);
        }

        const requestOptions = {
          method: "POST",
          headers: myHeaders,
          body: JSON.stringify(payload)
        };
        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, requestOptions);
        const result = await response.json();
        if (!result.ok) {
          console.error('Telegram deal photo send error:', result);
        } else if (result.result && result.result.message_id) {
          telegram.lastMessageId = result.result.message_id;
          telegram.lastChatId = chat_id;
        }
        return result.ok;
      }
    } catch (e) {
      console.error('Telegram fetch error:', e.message);
      return false;
    }
  } catch (e) {
    console.error('Telegram poster error:', e.message);
    return false;
  }
}

/**
 * Edit an existing Telegram message caption or text
 */
async function editTelegramMessage(chat_id, message_id, text, token = "") {
  if (!token) token = TelegramBotKey;
  if (!chat_id || !message_id) return false;

  if (chat_id === '@dealsequity' || chat_id === '-1004332585915') {
    return false;
  }

  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    // Try editing caption first (photos have captions)
    let res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({ chat_id, message_id: Number(message_id), caption: text })
    });
    let data = await res.json();
    if (data.ok) return true;

    // Fallback to editing text if caption failed
    res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({ chat_id, message_id: Number(message_id), text })
    });
    data = await res.json();
    return data.ok;
  } catch (e) {
    console.error('Telegram editMessage error:', e.message);
    return false;
  }
}

/**
 * Send an update alert message (optionally replying to previous deal message)
 */
async function sendTelegramUpdateAlert(chat_id = "@dealshubglobal", text = "", token = "", reply_to_message_id = null) {
  if (!token) token = TelegramBotKey;
  if (!text) return false;
  if (chat_id === '@dealsequity' || chat_id === '-1004332585915') return false;

  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const payload = { chat_id, text };
    if (reply_to_message_id) {
      payload.reply_to_message_id = Number(reply_to_message_id);
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.ok;
  } catch (e) {
    console.error('Telegram update alert send error:', e.message);
    return false;
  }
}

module.exports = {
  telegram,
  editTelegramMessage,
  sendTelegramUpdateAlert
};
