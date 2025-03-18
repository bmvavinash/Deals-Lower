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

  // console.log('entered into Telegram Seperate')
  var raw = JSON.stringify({
    photo:photo,
    chat_id: chat_id,
    caption: text
});

var requestOptions = {
  method: "POST",
  headers: myHeaders,
  body: raw,
};
    if(photo == ""){
      console.log('Telegram without photo')
      await fetch(
        //   "https://api.telegram.org/bot${token}/chat_id=@all1app/sendMessage?chat_id=@all1app",
        `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatid}&text=${text}`,
// `https://api.telegram.org/bot${token}/sendPhoto?chat_id=${chatid}&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=${chatid}`,
//   "https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=@all1app",
//   `https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=${photo}/sendMessage?chat_id=@all1app`,
//   `https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=@all1app`,
requestOptions
)
.then((response) => response.text())
.then((result) => {console.log("success",result)
//   console.log('hai'+JSON.stringify(result).includes("false"));
console.log('re api 2nd');
output = JSON.stringify(result).includes("false");
})
.catch((error) => console.log("error", error));

}
else{
  console.log('Telegram with photo')
  await fetch(
    //   "https://api.telegram.org/bot${token}/chat_id=@all1app/sendMessage?chat_id=@all1app",
    `https://api.telegram.org/bot${token}/sendPhoto?chat_id=${chatid}&photo?=${photo}/sendMessage?chat_id=${chatid}`,
    // `https://api.telegram.org/bot${token}/sendPhoto?chat_id=${chatid}&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=${chatid}`,
    //   "https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=@all1app",
    //   `https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=${photo}/sendMessage?chat_id=@all1app`,
    //   `https://api.telegram.org/bot${token}/sendPhoto?chat_id=@all1app&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=@all1app`,
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