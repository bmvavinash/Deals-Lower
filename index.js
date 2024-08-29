const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct } = require("./scrappers/amazon")
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { postDeals } = require("./postdeals");
const { firebase } = require("googleapis/build/src/apis/firebase");
const { firebaseget } = require("./database/firebaseget");
const { firebasepost } = require("./database/firebasepost");

const constants = require('./config/constants');
const config = require('./config/config');
const { getTelegramDealLink } = require("./dataSources/telegram");
const { getSpeedDeals } = require("./dataSources/speedDeals");


let type=constants.type // deploy in all places
let postflag = false;

// async function openAmazonWebsite(link) {
async function openAmazonWebsite() {

  require("chromedriver");

  var chrome = require("selenium-webdriver/chrome");

  let options = await new chrome.Options();

  let product={}
  



  options.debuggerAddress("localhost:9222");

  //CHROME
  driver = await chrome.Driver.createSession(options);
  let env=constants.env

  

  switch (type) {
    case "general":
      await getTelegramDealLink(driver);
      break;
    case "productlinks":
      await runExcelFunction();
      break;
    case "speedDeals":
      await getSpeedDeals();
      break;
    default:
      console.log("Invalid type specified");
  }

 

  // if(product.discount > 75){
  //   if(env=="prod"){
  //     telegram(photo, "@dealshubglobal2", t1);
      
  //   } else if(env=="stage") {
  //     telegram(photo, "", t1);
      
  //   }
  //   whatsapp("DSyvXzBJuax5uJ6MFylXJk",text);
  //   fbdata = facebook(photo, link, itemText);
  // }
  // else{
  //   if(env=="prod"){
  //     telegram(photo, "@dealshubglobal", t1);
      
  //   } else if(env=="stage") {
  //     telegram(photo, "@all1apptest", t1);
      
  //   }
  //   whatsapp("Kzl4DB4yCXzJaaCP0Lrf1G",text);
  // }
  
  

}

// link = "https://amzn.eu/d/8309kez"
// link = "https://fkrt.co/OGiA5g"



  openAmazonWebsite();
// await getTelegramDealLink();
// getTelegramDealLink();




