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

module.exports = {
  telegram
};
