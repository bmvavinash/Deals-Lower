const { TelegramBotKey } = require("../config/constants");

async function telegram(photo="",chat_id="@dealshubglobal",text="details",token="") {
  if(token == ""){
    token = TelegramBotKey;
  }
try{
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    // console.log("telegram photo is ",photo)
    // console.log("telegram chat_id is ",chat_id)
    // console.log("telegram text is ",text)

    let chatid = chat_id
   
try{
    if(photo == ""){
      console.log('Telegram without photo')
      var raw = JSON.stringify({
        chat_id: chat_id,
        text: text
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw
      };
      await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        requestOptions
      )
      .then((response) => response.text())
      .then((result) => {console.log("success",result)
      console.log('re api 2nd');
      output = JSON.stringify(result).includes("false");
      })
      .catch((error) => console.log("error", error));

    }
    else{
      console.log('Telegram with photo')
      var raw = JSON.stringify({
        chat_id: chat_id,
        photo: photo,
        caption: text
      });
      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw
      };
      await fetch(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        requestOptions
      )
      .then((response) => response.text())
      .then((result) => {console.log("success",result)
      output = JSON.stringify(result).includes("false");
      })
      .catch((error) => console.log("error", error));
    }
  }
catch(e){
console.log(e);
}
}
catch(e){console.log(e);}
}

module.exports = {
  telegram
};
// exports.telegram = telegram;