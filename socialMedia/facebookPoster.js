async function facebook(product, access_token, text) {
  let res;
  try {
    if (text.includes("&nbsp;")) {
      text = text.replaceAll("&nbsp;", "");
    }
    if (text.includes("#")) {
      text = text.replaceAll("#", "");
    }

    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    // access_token =
    //   "EAAKw6ZAutPZBoBOZBGh82ktkgeGMqoEsM0NzF7UhF3Td3GJpxs1PqBGZBsDq9eXdXJtd9bf1IZAp0xpRwdlmFJy6sLFYN830bbFqgdjcp3f7joaBAVl3Fhl8WF82XxVgaJZAfRGESqlyYtlWUweMczdgQAiDLUSdIomUsJVI12z0lKvKmQhnXMWNpwe0biVi3lhyJ1fjrl5lEZBTEqniBi09hIZD";
    try {
      var raw = JSON.stringify({
        photo: product?.photo,
        text: text,
        // link: link,
      });

      //working url for image and caption
      // https://graph.facebook.com/109973278731533/photos?url=https://i.postimg.cc/gk6KnpXp/Avi-Deals.png&caption=Amazon Deals on https://affiliiate-app.firebaseapp.com&EAADQM9ltnuYBAEcukShIVEsTQPHNqOmeSZBkoXqH2S3NCACs3pr1F5ikbA8yGlWKdqqYDxqHhgwKvzHc6AdKZAjUZCcPQpmz57OGKBzyNuDA2nudYux6F53MY8vhoHnKDhEI62i1d711qjQyrWZADXBWZBt4sr1n6nTFGOomP2srSAmU2m3ZBjWC9TQ1nKlXcZCmxP9kcGTZBBYQeyAgDI5BLmnavkpM4tblKKZBtIZCwQzth2Ld85ZAAmV

      var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
      };
      let fblink = `https://graph.facebook.com/me/photos?url=${product?.photo}&caption=${text}&access_token=${access_token}`;
      // console.log("all1app facebook data");
      console.log("Facebook Link is " + fblink);
      // let chatid = "@all1appweb"
      await fetch(
        `https://graph.facebook.com/me/photos?url=${product?.photo}&caption=${text}&access_token=${access_token}`,

        requestOptions
        // `https://graph.facebook.com/me/feeds/photos?url=${photo}&caption=${text}&${access_token}`,

        //without image and with link
        // `https://graph.facebook.com/109973278731533/feed?message=${text}&link=${link}&access_token=EAAKw6ZAutPZBoBACFnTTOYlNiHqV4gHVW8oN0vsQ22tsiBPvDswVZCMWwrCQ3KGL6yh2LBsCmD5voVH7PoHKMAZBgGgK8e0G47Njo5oaODjOjADrDwaDs3h7HduSBQ2j8LmPCUNRYPcfnq5QdmrgVp9AtmWwjdBvTJMyCtJZC2FySOKbKjgKJs7kzYI4SSCnfHDCrgaj8vjDDJjr6UK1f`,
        // `https://graph.facebook.com/109973278731533/photos?url=${photo}&caption=${text}&${access_token}`,
        // access_token=
        // &link=${link}
        // "https://graph.facebook.com/v16.0/me/",
        // `https://api.telegram.org/bot5759815900:AAH-Xd2wQhU4JBhNOF26bfu-plI8oGaU9qQ/sendPhoto?chat_id=${chatid}&photo?=https://m.media-amazon.com/images/I/71Ohf7QA+9L._SL1500_.jpg/sendMessage?chat_id=${chatid}`,
      )
        .then((response) => response.text())
        .then((result) => {
          console.log("success for Facebook", result);
          res = result
          //   console.log('hai'+JSON.stringify(result).includes("false"));
          console.log("re api 2nd");
          output = JSON.stringify(result).includes("false");
        })
        .catch((error) => console.log("error", error));

      if (output) {
        await fetch(
          `https://graph.facebook.com/me/photos?url=${product?.photo}&caption=${text}&access_token=${access_token}`,
          requestOptions
        )
          .then((response) => response.text())
          .then((result) => {
            console.log("success", result);
            res = result
            //   console.log('hai'+JSON.stringify(result).includes("false"));
            output = JSON.stringify(result).includes("false");
          })
          .catch((error) => console.log("error", error));
      }
      // }
    } catch (e) {
      console.log(e);
    }
    return res;
    // return `https://graph.facebook.com/me/photos?url=${photo}&caption=${text}&access_token=${access_token}`;
    // return `https://graph.facebook.com/me/feeds/photos?url=${photo}&caption=${text}&${access_token}`;
  } catch (e) {console.log(e);}
}
// exports.facebook = facebook;
module.exports = {
  facebook,
};
