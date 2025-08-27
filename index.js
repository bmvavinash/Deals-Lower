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
const { getTelegramDealLink, continuouslyProcessBotMessages } = require("./dataSources/telegram");
const { getSpeedDeals } = require("./dataSources/speedDeals");
const Zerodha = require("./Stock/Portal/Zerodha");
const zerodhaHoldings = require("./Stock/Portal/zerodhaHoldings");
const whatsappLastMessage = require("./socialMedia/whatsappLastMsg");
const whatsappLastMessageByHtml = require("./socialMedia/whatsappLastMsgByHtml");
const tableExtract = require("./XAlpha/tableExtract");
const { processAllInstruments } = require("./dataSources/stock");
const { readUrlsFromTxt } = require("./dataSources/textFile");
const { initializeBot, continuousProcess } = require("./dataSources/autoTelegramAll");
const extractFacebookToken = require("./socialMedia/extractFacebookToken");
const { bannerScheduler } = require("./scheduler/bannerScheduler");

require("events").EventEmitter.defaultMaxListeners = 20;



let type = constants.type // deploy in all places
let source = constants.source // deploy in all places
let postflag = false;

// async function openAmazonWebsite(link) {
async function openAmazonWebsite() {

  require("chromedriver");

  var chrome = require("selenium-webdriver/chrome");

  let options = await new chrome.Options();

  let product = {}


  // Add headless mode
  // options.addArguments("--headless"); // Enable headless mode
  // options.addArguments("--disable-gpu"); // Recommended for Windows
  // // options.addArguments("--no-sandbox"); // Recommended for Linux
  // options.addArguments("--disable-dev-shm-usage"); // Prevent resource issues in some systems



  options.debuggerAddress("localhost:9222");

  //CHROME
  driver = await chrome.Driver.createSession(options);
  let env = constants.env


  if (source == "deals") {

    switch (type) {
      case "general":
        switch (constants.generaltype) {
          case "telegramFile":
            await getTelegramDealLink(driver);
            break;
          case "urlsFile":
            await readUrlsFromTxt(driver);
            break;
          case "telegramBot":
            await continuouslyProcessBotMessages();
            // await continuousProcess(driver);
            // await initializeBot(driver);
            break;
        }
        console.log("returning in general")
        break;
      case "productlinks":
        await runExcelFunction();
        break;
      case "textfilelinks":
        await readUrlsFromTxt();
        break;
      case "telegrambot":
        await initializeBot(driver);
        break;
      case "speedDeals":
        await getSpeedDeals();
        break;
      case "banners":
        // Start banner extraction scheduler
        await bannerScheduler.start();
        console.log("Banner scheduler started");
        break;
      default:
        console.log("Invalid type specified");
    }
  }
  else if (source == "stocks") {

    await processAllInstruments(driver);
    // await Zerodha(driver);
    // await zerodhaHoldings(driver);

    // await tableExtract(driver);

    // await whatsappLastMessage(driver);
    // await whatsappLastMessageByHtml(driver);
    // let { message, timestamp } = await whatsappLastMessageByHtml(driver);
    // if (message && timestamp) {
    //   console.log("in index")
    //   console.log('Last message:', message);
    //   console.log('Timestamp:', timestamp);
    // } else {
    //     console.log('No message or timestamp found.');
    // } 

    // let details = await whatsappLastMessageByHtml(driver);
    // console.log("Details in index are :",details);

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
  console.log("returning in index")
  throw new Error("Script terminated.");
  // return null;
  // exit();
  // process.exit(1); // halts all asynchronous operations so use sleep 

}

// link = "https://amzn.eu/d/8309kez"
// link = "https://fkrt.co/OGiA5g"



openAmazonWebsite();
// await getTelegramDealLink();
// getTelegramDealLink();




