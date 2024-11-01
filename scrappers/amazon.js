const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
const amazonConfig = require("../config/amazonConfig");
const { By, Key, Builder, Button, until } = require("selenium-webdriver");
const { getAsin } = require("../utils/commonUtils");

async function scrapeAmazonProduct(url, text = "", driver, keyExist=false) {
  // driver.get(url);
  try {
    let product = {};

    try { product.price = String(await extractAttribute(driver, amazonConfig?.price)) || ""; } catch (e) { console.log("price error", e) }
    try { product.discount = String(await extractAttribute(driver, amazonConfig?.discount)) || ""; } catch (e) { console.log("discount error", e) }
    
    try {
      
      // let start = url.indexOf("/dp/") + 4
      // console.log("new asin is ", url.substr(start, 10));
      // asin = url.substr(start, 10)
      asin = getAsin(url);
      if(asin.length != 10){
        try {
           product.productCode = await extractAttribute(driver, amazonConfig?.asin) || ""; 
          } catch (e) {
           console.log("asin error so skipping the product") 
           return {};
          }
      }
      else {
        product.productCode = asin;
      }
    }
    catch(e){
      console.log("Asin New Url Extract Error")
    }
    if(!keyExist){
      try { product.photo = await extractAttribute(driver, amazonConfig?.photo) || ""; } catch (e) { console.log("photo error") }
      try { product.urltext = await extractAttribute(driver, amazonConfig?.productText) || ""; } catch (e) { console.log("productText error") }
      try { product.productText = text || "" } catch (e) { console.log("url Text error") }
      
      product.category = {}
      try { product.category.mainCategory = await extractAttribute(driver, amazonConfig?.category?.mainCategory) || ""; } catch (e) { console.log("mainCategory error") }
      try { product.category.c1 = await extractAttribute(driver, amazonConfig?.category?.c1) || ""; } catch (e) { console.log("c1 error") }
      try { product.category.c2 = await extractAttribute(driver, amazonConfig?.category?.c2) || ""; } catch (e) { console.log("c2 error") }
      try { product.category.c3 = await extractAttribute(driver, amazonConfig?.category?.c3) || ""; } catch (e) { console.log("c3 error") }
      try { product.category.c4 = await extractAttribute(driver, amazonConfig?.category?.c4) || ""; } catch (e) { console.log("c4 error") }
      try { product.category.c5 = await extractAttribute(driver, amazonConfig?.category?.c5) || ""; } catch (e) { console.log("c5 error") }
      try { product.description = {} } catch (e) { console.log("=  error") }
      try { product.description.d1 = await extractAttribute(driver, amazonConfig?.description?.d1) || ""; } catch (e) { console.log("d1 error") }
      try { product.description.d2 = await extractAttribute(driver, amazonConfig?.description?.d2) || ""; } catch (e) { console.log("d2 error") }
      try { product.description.d3 = await extractAttribute(driver, amazonConfig?.description?.d3) || ""; } catch (e) { console.log("d3 error") }
      try { product.description.d4 = await extractAttribute(driver, amazonConfig?.description?.d4) || ""; } catch (e) { console.log("d4 error") }
      try { product.description.d5 = await extractAttribute(driver, amazonConfig?.description?.d5) || ""; } catch (e) { console.log("d5 error") }
      try { product.description.d6 = await extractAttribute(driver, amazonConfig?.description?.d6) || ""; } catch (e) { console.log("d6 error") }
      try { product.description.d7 = await extractAttribute(driver, amazonConfig?.description?.d7) || ""; } catch (e) { console.log("d7 error") }
      try { product.description.d8 = await extractAttribute(driver, amazonConfig?.description?.d8) || ""; } catch (e) { console.log("d8 error") }
      try { product.description.d9 = await extractAttribute(driver, amazonConfig?.description?.d9) || ""; } catch (e) { console.log("d9 error") }
      // product?.brand = await extractAttribute(driver, amazonConfig?.brand);
      product.links = {};
      if(product?.photo != ""){

        try { product.links.avinashbmv = await amazonLinkGenerator(driver) || ""; } catch (e) { console.log("link generation error") }
      }
      else {
        console.log("No Photo hence skipping the link generation")
      }
    }
    // Log product or further processing
    // console.log("Product is ", product);
    return product;
  } catch (e) { console.log("Error in scrap Product ", e); }
}

async function extractAttribute(driver, attributeConfig) {
  let lastConfig; // Variable to store the last config
  try {
    for (let config of attributeConfig) {
      try {
        let element;
        // console.log("selector is ",config.selector)
        if (config.type === "xpath") {
          element = await driver.findElement(By.xpath(config.selector));
        } else if (config.type === "id") {
          element = await driver.findElement(By.id(config.selector));
        } else if (config.type === "className") {
          element = await driver.findElement(By.className(config.selector));
        }
        // let element = await driver.findElement(By[type](selector)); // check later #todo
        const attributeToExtract = config.attribute || "innerHTML";
        let rawValue = await element.getAttribute(attributeToExtract);

        // Use validator directly from utils
        if (config.validator) {
          const validationResult = config.validator(rawValue);
          if (!validationResult.isValid) {
            lastConfig = config; // Update lastConfig for the failed config
            // if(config.) //#ToDo for logging only for last config Path
            // console.log("Validation failed for:", config?.selector, amazonConfig?.links);
            continue; // Skip to the next selector if validation fails
          }
          return validationResult.value; // Use modified value
        }
        // if (config.type === "id") {
        //   console.log();
        // }

        return rawValue.trim(); // Return raw value if no validator is provided
      } catch (error) {
        lastConfig = config; // Update lastConfig for the failed config
        // if (config.type === "id") {
        //   console.log("Error is ", error);
        // }
        // console.log("Error finding element or validating:", config.selector, error);
        // Optionally log the error or handle it as needed
      }
    }
  }
  catch (e) {
    console.log("Error in attribute config ", e)
  }

  // Log information only for the last config after the loop
  if (lastConfig) {
    // console.log("Validation failed for the last config:", lastConfig?.selector, amazonConfig?.links);
  } else {
    console.log("All xpaths failed or validation failed for all xpaths."); // #ToDo Need to remove
  }
  return null;
}

module.exports = {
  scrapeAmazonProduct,
};

// Other functions...
