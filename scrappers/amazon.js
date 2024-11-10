const amazonConfig = require("../config/amazonConfig");
const flipkartConfig = require("../config/flipkartConfig");
const { amazonLinkGenerator } = require("../affiliate/amazonLinkGenerator");
// const { getExtrapeUrl } = require("../affiliate/extrapeUrlGenerator");
const { By, Key, Builder, Button, until } = require("selenium-webdriver");
const { getAsin, getFlipkartProductId, getAjioCode, getMyntraCode } = require("../utils/commonUtils");
const { getExtrapeUrl } = require("../affiliate/extrape");
const ajioConfig = require("../config/ajioConfig");
const myntraConfig = require("../config/myntraConfig");

async function scrapeProduct(url, platform, driver, text = "", keyExist = false) {
  // Load the appropriate config
  const config = platform === "amazon" ? amazonConfig : platform === "flipkart" ? flipkartConfig : platform === "ajio" ? ajioConfig : platform === "myntra" ? myntraConfig : null;
  if (!config) {
    console.log(`Config for ${platform} is missing`);
    return {};
  }

  let product = {};
  try {
    // Extract price, discount, etc., using the generic function
    try { product.price = String(await extractAttribute(driver, config.price)) || ""; } catch (e) { console.log("price error", e) }
    try { product.discount = String(await extractAttribute(driver, config.discount)) || ""; } catch (e) { console.log("discount error", e) }

    // Product code extraction based on platform
    if (platform === "amazon") {
      product.productCode = getAsin(url) || "";
    } else if (platform === "flipkart") {
      try {
        product.productCode = getFlipkartProductId(url) || ""
        // const parsedUrl = new URL(url);
        // const searchParams = new URLSearchParams(parsedUrl.search);
        // product.productCode = searchParams.get("pid") || "";
      } catch (e) {
        console.log("asin error so skipping the product")
        //  return {};
      }
      // }
      // else {
      //   product.productCode = asin;
      // }
      // catch(e){
      //   console.log("Asin New Url Extract Error")
      // }
    } else if (platform === "ajio") {
      product.productCode = getAjioCode(url);
    } else if (platform === "myntra") {
      product.productCode = getMyntraCode(url);
    }
    if (platform === "myntra") {
      try { imageElement = await extractAttribute(driver, config?.photo) || ""; } catch (e) { console.log("photo error") }
      // const imageElement = document.querySelector(".image-grid-image");

      // Extract the URL from the background-image style attribute
      try { product.photo = imageElement.match(/url\("(.*?)"\)/)[1]; } catch (e) { console.log("Image Extract Error in Myntra ", e); }

      // Output the single image URL
      // console.log(imageUrl);
      // const imageUrls = config.images.map(image => {
      //   const style = image.getAttribute("style");
      //   return style.match(/url\("(.*?)"\)/)[1]; // Extracts URL from the style attribute

      // });
      // try{ product.photo = imageUrls[0] } catch(e) { console.log("Myntra Image Error")}
      // try{ product.images = imageUrls; } catch(e) { console.log("Myntra Multiple Image Error")} 
    } else {

      try { product.photo = await extractAttribute(driver, config?.photo) || ""; } catch (e) { console.log("photo error") }
    }
    try { product.urltext = await extractAttribute(driver, config?.productText) || ""; } catch (e) { console.log("productText error") }
    try { product.productText = text || "" } catch (e) { console.log("url Text error") }
    if (!keyExist) {

      product.category = {}
      try { product.category.mainCategory = await extractAttribute(driver, config?.category?.mainCategory) || ""; } catch (e) { console.log("mainCategory error") }
      try { product.category.c1 = await extractAttribute(driver, config?.category?.c1) || ""; } catch (e) { console.log("c1 error") }
      try { product.category.c2 = await extractAttribute(driver, config?.category?.c2) || ""; } catch (e) { console.log("c2 error") }
      try { product.category.c3 = await extractAttribute(driver, config?.category?.c3) || ""; } catch (e) { console.log("c3 error") }
      try { product.category.c4 = await extractAttribute(driver, config?.category?.c4) || ""; } catch (e) { console.log("c4 error") }
      try { product.category.c5 = await extractAttribute(driver, config?.category?.c5) || ""; } catch (e) { console.log("c5 error") }
      try { product.description = {} } catch (e) { console.log("=  error") }
      try { product.description.d1 = await extractAttribute(driver, config?.description?.d1) || ""; } catch (e) { console.log("d1 error") }
      try { product.description.d2 = await extractAttribute(driver, config?.description?.d2) || ""; } catch (e) { console.log("d2 error") }
      try { product.description.d3 = await extractAttribute(driver, config?.description?.d3) || ""; } catch (e) { console.log("d3 error") }
      try { product.description.d4 = await extractAttribute(driver, config?.description?.d4) || ""; } catch (e) { console.log("d4 error") }
      try { product.description.d5 = await extractAttribute(driver, config?.description?.d5) || ""; } catch (e) { console.log("d5 error") }
      try { product.description.d6 = await extractAttribute(driver, config?.description?.d6) || ""; } catch (e) { console.log("d6 error") }
      try { product.description.d7 = await extractAttribute(driver, config?.description?.d7) || ""; } catch (e) { console.log("d7 error") }
      try { product.description.d8 = await extractAttribute(driver, config?.description?.d8) || ""; } catch (e) { console.log("d8 error") }
      try { product.description.d9 = await extractAttribute(driver, config?.description?.d9) || ""; } catch (e) { console.log("d9 error") }
      // product?.brand = await extractAttribute(driver, config?.brand);
    }
    if (product?.photo != "") {


      if (product && product?.links && product.links.avinashbmv != "") {

      } else {

        product.links = {};
        try { product.links.avinashbmvINR = ""; } catch (e) { console.log("avinashbmvINR Error", e) }
        if (platform === "amazon") {
          try {
            product.links.avinashbmv = await amazonLinkGenerator(driver) || "";
            product.links.avinashbmvINR = "";
          } catch (e) { console.log("Amazon link generation error") }
        } else {
          try {
            product.links.avinashbmv = await getExtrapeUrl(driver, url) || "";
            product.links.avinashbmvINR = "";
          } catch (e) { console.log("Generic link generation error") }
        }
      }
    }





    // try { product.links.avinashbmv = await amazonLinkGenerator(driver) || ""; } catch (e) { console.log("link generation error") }
    // }
    else {
      console.log("No Photo hence skipping the link generation")
    }
    // Log product or further processing
    // console.log("Product is ", product);
    return product;
  } catch (e) { console.log("Error in scrap Product ", e); }
}

async function extractAttribute(driver, attributeConfig) {
  let lastConfig = null; // Track only the final failed config if all fail

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
            // console.log("Validation failed for:", config?.selector, config?.links);
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
    // console.log("Validation failed for the last config:", lastConfig?.selector, config?.links);
  } else {
    console.log("All xpaths failed or validation failed for all xpaths."); // #ToDo Need to remove
  }
  return null;
}

module.exports = {
  scrapeProduct,
};

// Other functions...
