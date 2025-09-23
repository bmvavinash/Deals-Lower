const amazonConfig = require("../config/amazonConfig");
const { By, Key, Builder, Button, until } = require("selenium-webdriver");

async function amazonLinkGenerator( driver) {
    let l=1
    try{
        // First check if user is logged in by looking for the Get Link button
        try {
          await driver.findElement(By.id("amzn-ss-get-link-button")).click();
          console.log("Get Link button clicked successfully");
        } catch (getLinkError) {
          console.log("Get Link button not found - checking if user is logged in");
          
          // Check if this is an excluded product
          try {
            const excludedProductAlert = await driver.findElement(By.css(".amzn-ss-asin-alert-text-content"));
            if (excludedProductAlert) {
              console.log("Excluded Product detected - this product is not eligible for Amazon Associates Program");
              return ""; // Return empty string for excluded products
            }
          } catch (excludedCheckError) {
            console.log("No excluded product alert found");
          }
          
          // Check if user needs to login
          try {
            const loginPrompt = await driver.findElement(By.css("[data-action='sign-in']"));
            if (loginPrompt) {
              console.log("User not logged in - Amazon Associates requires authentication");
              return ""; // Return empty string if not logged in
            }
          } catch (loginCheckError) {
            console.log("No login prompt found");
          }
          
          // If we reach here, the product might be excluded or there's an authentication issue
          console.log("Unable to generate Amazon affiliate link - product may be excluded or authentication required");
          return "";
        }
      }
      catch(e) {
        console.log("Error in Amazon link generation:", e.message);
        
        // Check if this is an excluded product
        try {
          const excludedProductAlert = await driver.findElement(By.css(".amzn-ss-asin-alert-text-content"));
          if (excludedProductAlert) {
            console.log("Excluded Product detected - this product is not eligible for Amazon Associates Program");
            return ""; // Return empty string for excluded products
          }
        } catch (excludedCheckError) {
          console.log("No excluded product alert found, proceeding with normal flow");
        }
        
        try {
          await driver.findElement(By.xpath('//*[@id="aod-close"]/span/span/i')).click();
        } catch(e) {
          console.log("Error in Cart Popup close",e);
        }
      
    }
  // let popupIsVisible = await driver.wait(until.elementIsVisible("a-popover-content-2"));
  // console.log("popupIsVisible is "+popupIsVisible);
  // if(!popupIsVisible){
  //   await driver.findElement(By.id("amzn-ss-text-link")).click();
  //   await driver.findElement(By.id("amzn-ss-text-link")).click();
  // }
  try{
      await driver.findElement(By.id("amzn-ss-text-link")).click();
  }
  catch(e){console.log(e);}
  // await driver.wait(until.elementLocated(By.id("a-popover-content-2")),5000);//,Key.RETURN
  await driver.sleep(100);
  try {
    await driver.findElement(By.id("a-autoid-1-announce")).click();
    //   await driver.sleep(1500);
    //   await driver.sleep(1500);
    console.log("Direct Try Announce");
  } catch (e) {
    console.log("Calling Text Link Catch");
    await driver.findElement(By.id("amzn-ss-text-link")).click();
    await driver.sleep(1200);
    // await driver.findElement(By.id("a-autoid-1-announce")).click();
    try {
      console.log("Calling Text Link try inside catch");
      await driver.findElement(By.id("a-autoid-1-announce")).click();
      await driver.sleep(1200);
    } catch (e) {
      console.log("Calling Text Link Catch inside catch");
      await driver.findElement(By.id("amzn-ss-text-link")).click();
      await driver.sleep(1200);
      try {
        await driver.findElement(By.id("a-autoid-1-announce")).click();
      } catch (e) {
        console.log("inside catch");
        await driver
          .actions()
          // .keyDown(Key.SHIFT)
          .keyDown(Key.CONTROL)
          .keyDown(Key.F4)
          .keyUp(Key.F4)
          .keyUp(Key.CONTROL)
          // .keyDown(Key.TAB)
          .perform();
        
      }
      await driver.sleep(1200);
      // await driver.sleep(1000);
    }
  }
  count = l;
  while (count-- != 0) {
    // if(l==0){
    //     await driver.actions()
    //     .sendKeys(Key.UP)
    //     .sendKeys(Key.RETURN)
    //     .perform();
    // }
    // else if(l>0){
    //   console.log("count is "+count);
    //   console.log("l value is "+l);
    await driver
      .actions()
      // .sendKeys(Key.UP) //bmvavinash
      .sendKeys(Key.UP) //bmvavinash
      // .sendKeys(Key.UP) //bmvavinash
      // .keyDown(Key.UP)pricenum
      // .keyUp(Key.UP)
      .sendKeys(Key.RETURN)
      // .sendKeys(Key.TAB)

      // Associate Extra Tab Remove
      // .keyDown(Key.TAB)
      // .keyUp(Key.TAB)
      // .sendKeys(Key.RETURN)
      .perform();
    // }
    // else{
    //     await driver.actions()
    //     .sendKeys(Key.RETURN)
    //     .perform();
    // }
  } //while loop

  await driver.sleep(1200);
  // await driver.sleep(200);
  await driver.findElement(By.id("amzn-ss-get-link-btn-text-announce")).click();
  await driver.sleep(1200);
  // await driver.sleep(200);

  // let datas = await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).getAttribute("src");
  // if (datas == "") {
  //     console.log('empty text box')
  //     await driver.findElement(By.id("amzn-ss-get-link-btn-text-announce")).click();
  //     try {
  //         await driver.findElement(By.id("amzn-ss-get-link-btn-text-announce")).click();
  //         console.log('empty text box 2nd')
  //     }
  //     catch (e) {
  //         console.log(e);
  //     }

  //     // await driver.findElement(By.id("amzn-ss-get-link-btn-text-announce")).click();
  //     //   await driver.sleep(200);
  // }
  // let datasnew = await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).getAttribute("src");
  await driver.sleep(1200);
  await driver
    .findElement(By.id("amzn-ss-text-shortlink-textarea"))
    .getAttribute("innerHTML")
    .then(
      function (webElement) {
        urlvalue1 = webElement;
        console.log("Link Success " + urlvalue1);
        if (urlvalue1 == "") {
          // await driver.sleep(1000);
          console.log("empty url so Calling again");
          l -= 1;
        }
      },
      function (err) {
        console.log("Link Err" + err);
      }
    );
  // if(datasnew == null){
  //   await driver.wait(until.elementLocated(By.id("amzn-ss-text-shortlink-textarea")),5000).getAttribute("src");
  // }
  try {
    await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).click();
  } catch (e) {console.log(e);}
  try {
    await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).click();
  } catch (e) {console.log(e);}
  // console.log('Instead of Copy ' +datasnew)

  // linkdata = await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).getAttribute("src");
  // console.log('Link Value is '+linkdata)

  // await driver.actions()
  // .keyDown(Key.CONTROL)
  // .sendKeys('a')
  // .keyUp(Key.CONTROL)
  // .perform()
  // await driver.actions()
  // .keyDown(Key.CONTROL)
  // .sendKeys('c')
  // .keyUp(Key.CONTROL)
  // .perform()

  // await driver.findElement(By.id("amzn-ss-tracking-id-dropdown-text")).getAttribute("src");
  // await driver.findElement(By.id("amzn-ss-tracking-id-dropdown-text")).click();
  try {
    await driver.findElement(By.id("amzn-ss-text-shortlink-textarea")).click();
  } catch (e) {console.log(e);}
  return urlvalue1;
}

module.exports = {
    amazonLinkGenerator
};