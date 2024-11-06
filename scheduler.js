const { Builder, By, Key, until } = require("selenium-webdriver");
const { scrapeAmazonProduct, scrapeProduct } = require("./scrappers/amazon");
const { scrapeFlipkartProduct } = require("./scrappers/flipkart");
const { getAccessToken } = require("./database/getAccessToken");
const { telegram } = require("./socialMedia/telegramPoster");
const { whatsapp } = require("./socialMedia/whatsappPoster");
const { postDeals } = require("./postdeals");
const { firebase } = require("googleapis/build/src/apis/firebase");
const { firebaseget } = require("./database/firebaseget");
const { firebasepost } = require("./database/firebasepost");


const constants = require('./config/constants.js');
const config = require('./config/config.js');

require("chromedriver");
const chrome = require("selenium-webdriver/chrome");
const firebasePut = require("./database/firebaseput.js");
const { shortenProductText, getAsin, getformattedDate, getFlipkartProductId } = require("./utils/commonUtils.js");
const updateProduct = require("./database/firebaseDB/firebaseUpdate.js");
const { productStatus } = require("./config/const.js");
const fs = require("fs").promises;

async function getProductDetails(driver, link, text = "",len=0,access_token="", data={}, todayData={}) {

  let postflag = false;
  let keyExist = false;
  let postStatus = ""
  try{

  const date = new Date();
  if(len==0 || data=={}){
    data,len=await firebaseget();
  }
  if(todayData=={}){
    data,len=await firebaseget(true);
  }

  // Get the year, month, and day from the date object
  // const year = date.getFullYear();
  // const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed, add 1 to get the correct month
  // const day = String(date.getDate()).padStart(2, '0');

  // // Format the date as YYYY-MM-DD
  // const todayDate = `${year}-${month}-${day}`;
  const todayDate = getformattedDate();
  await driver.get(link);
  link = await driver.getCurrentUrl();
  if (link.includes("amazon")) {
    let asin = getAsin(link);

    
    if (todayData.hasOwnProperty(asin)) {
      console.log("Updated Product today hence skipping the flow !");
      return productStatus.PRODUCT_POSTED_TODAY;
    }
    if (data.hasOwnProperty(asin)) {
      console.log("Product Key exists!");
      keyExist = true

      // return true; //Need to check whether posted today or not
    } else {
      console.log("Product Key does not exist.");
      keyExist = false
    }
    // if(asin.includes(data)) {
    //   return true; //#todo make it to string
    // }
    product = await scrapeProduct(link, "amazon", driver,text,  keyExist);
    product.storeType = "Amazon";
    product.links.avinashbmvINR = "";

  } else if (link.includes("flipkart")) {

    let productCode = getFlipkartProductId(link);

    if (todayData.hasOwnProperty(productCode)) {
      console.log("Updated Product today hence skipping the flow !");
      return productStatus.PRODUCT_POSTED_TODAY;
    }
    if (data.hasOwnProperty(productCode)) {
      console.log("Product Key exists!");
      keyExist = true

      // return true; //Need to check whether posted today or not
    } else {
      console.log("Product Key does not exist.");
      keyExist = false
    }
    product = await scrapeProduct(link, "flipkart", driver, text, keyExist);
    product.storeType = "Flipkart";
  }
  product.date = String(todayDate);
  product.datetime = Date.now();
  product.id = len;
  product.idlen = len;
  product.idlength = len;
  product.isDeal = false
  product.isOffer = false
  product.productType = "Affiliate";
  product.shortText = shortenProductText(product.urltext);

  let env = constants.env

  // console.log("Product is ", product);

  if (product?.price > 0 && product?.links?.avinashbmv && product?.links?.avinashbmv != "") {
    // postflag = await firebasepost(product, access_token, env);
    postflag = await updateProduct(product?.productCode || product?.id , product, access_token, env);
    console.log("Postflag is ", postflag)
    // postflag = await firebasePut(product, access_token, env);
    if (postflag.status == 201) {
      // id+=1;
      len += 1;
      postStatus = productStatus.PRODUCT_CREATED;
      // i--;
    } else if (postflag.status==200) {
      postStatus = productStatus.PRODUCT_UPDATED_SUCCESSFULLY;
    } else if (postflag.status==301) {
      postflag = false;
      postStatus = productStatus.PRODUCT_POSTED_TODAY;
    }else {
      access_token = await getAccessToken(env);
      console.log("Regenerating access token");
      postflag = await firebasepost(product, access_token, env);
      if (postflag) {
        // id+=1;
        len += 1;
      } else {
        // console.log("Need to skip channel deals");
      }
    }
    if(postflag){
        postDeals(driver, product);
    }
    else {
        // console.log("Post Flag is false ",product?.links?.avinashbmv)
        console.log("\nPost Flag is false ",link)
      }
    }
    else{
    console.log("\nFirebase Post Invalid details: ",link)

  }
  return postStatus;
  // return postflag
}
    catch(e){
      console.log("error in scheduler: ",e)
      return productStatus.PRODUCT_ERROR
  }
  // finally {
  // }
}
module.exports = {
  getProductDetails,
};
