// function validatePrice(value) {
//     let cleanedValue = value.replace(/₹|,|\s|&nbsp;|-/g, "").trim();
//     const price = parseInt(cleanedValue, 10);
//     return {
//         isValid: !isNaN(price) && price > 0,
//         value: price
//     };
// }
const constants = require('../config/constants.js');
const config = require('../config/config.js');

const { users } = require("../config/users");
// const { logger } = require('../logger/logger.js');

const { getModuleLogger } = require("../logger/logger");


const logger = getModuleLogger('commonUtils');
const { By } = require('selenium-webdriver');

function validatePrice(value) {
    // Remove any HTML tags
    const strippedValue = value.replace(/<[^>]*>/g, "").trim();

    // Remove common currency symbols like Rs., ₹, $, etc.
    const cleanedValue = strippedValue.replace(/^(Rs\.|₹|[$])[\s]*/g, "").trim();

    // Remove non-numeric characters except for digits, commas, and period (decimal point)
    const numericValueString = cleanedValue.replace(/[^0-9,.]/g, "").trim();

    // Ensure that we only get the part before the first decimal
    const valueBeforeDecimal = numericValueString.split('.')[0].trim();

    // Remove commas before parsing
    const valueWithoutCommas = valueBeforeDecimal.replace(/,/g, "");

    // Parse the cleaned value as an integer
    const numericValue = parseInt(valueWithoutCommas, 10);

    return {
        isValid: !isNaN(numericValue) && numericValue > 0, // Check if valid numeric price
        value: isNaN(numericValue) ? value : numericValue, // Return numeric value if valid, else raw value
        cleanedValue: numericValueString || strippedValue // Partially cleaned or raw stripped value
    };
}


function validateDiscount(value) {
    let cleanedValue = value.replace(/%|\s|&nbsp;|-/g, "").trim();
    const discount = parseInt(cleanedValue, 10);
    return {
        isValid: discount > 0,
        value: discount
    };
}

// Function to extract ASIN from data-csa-c-item-id attribute
function extractAsin(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Extracting ASIN from:", value); // Debug log
    
    // Extract ASIN from format like "amzn1.asin.1.B0F4DG9ZH5"
    const asinMatch = value.match(/amzn1\.asin\.\d+\.([A-Z0-9]{10})/);
    if (asinMatch) {
        console.log("ASIN extracted:", asinMatch[1]); // Debug log
        return {
            isValid: true,
            value: asinMatch[1]
        };
    }
    
    // Try alternative format if the first one doesn't work
    const altMatch = value.match(/([A-Z0-9]{10})/);
    if (altMatch) {
        console.log("ASIN extracted (alternative):", altMatch[1]); // Debug log
        return {
            isValid: true,
            value: altMatch[1]
        };
    }
    
    console.log("No ASIN found in:", value); // Debug log
    return { isValid: false, value: "N/A" };
}

// Function to extract actual product URL from Amazon's sponsored link format
function extractProductUrl(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Extracting product URL from:", value); // Debug log
    
    // If it's already a direct product URL
    if (value.includes('/dp/') && !value.includes('/sspa/')) {
        return {
            isValid: true,
            value: value.startsWith('http') ? value : `https://www.amazon.in${value}`
        };
    }
    
    // Extract from sponsored link format
    const urlMatch = value.match(/url=([^&]+)/);
    if (urlMatch) {
        try {
            const decodedUrl = decodeURIComponent(urlMatch[1]);
            console.log("Decoded URL:", decodedUrl); // Debug log
            
            if (decodedUrl.includes('/dp/')) {
                const fullUrl = decodedUrl.startsWith('http') ? decodedUrl : `https://www.amazon.in${decodedUrl}`;
                return {
                    isValid: true,
                    value: fullUrl
                };
            }
        } catch (error) {
            console.log("Error decoding URL:", error); // Debug log
        }
    }
    
    console.log("No product URL found in:", value); // Debug log
    return { isValid: false, value: "N/A" };
}

// Function to extract brand name from product title
function extractBrand(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Extracting brand from:", value); // Debug log
    
    // Common brand patterns - extract the first word before any special characters or spaces
    const brandMatch = value.match(/^([A-Za-z]+)/);
    if (brandMatch) {
        const brand = brandMatch[1];
        console.log("Brand extracted:", brand); // Debug log
        return {
            isValid: true,
            value: brand
        };
    }
    
    console.log("No brand found in:", value); // Debug log
    return { isValid: false, value: "N/A" };
}

// Function to clean ratings count by removing parentheses
function validateRatingsCount(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    // Remove parentheses and clean the text
    const cleanedValue = value.replace(/[()]/g, '').trim();

    return {
        isValid: cleanedValue.length > 0,
        value: cleanedValue
    };
}

// Function to extract discount percentage from text like "(35% off)"
function validateDiscountPercentage(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Extracting discount from:", value); // Debug log
    
    // Extract percentage from text like "(35% off)"
    const discountMatch = value.match(/\((\d+)%\s*off\)/);
    if (discountMatch) {
        const discount = parseInt(discountMatch[1], 10);
        console.log("Discount extracted:", discount); // Debug log
        return {
            isValid: true,
            value: discount
        };
    }
    
    console.log("No discount found in:", value); // Debug log
    return { isValid: false, value: "N/A" };
}

// Function to validate bought in past month text and filter out M.R.P
function validateBoughtInPastMonth(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Validating bought in past month:", value); // Debug log
    
    // Check if it contains "bought in past month" pattern
    if (value.includes("bought in past month")) {
        console.log("Valid bought in past month text:", value); // Debug log
        return {
            isValid: true,
            value: value
        };
    }
    
    // If it's M.R.P or other text, return N/A
    console.log("Not a bought in past month text:", value); // Debug log
    return { isValid: false, value: "N/A" };
}

// Function to validate original price with debug logging
function validateOriginalPrice(value) {
    if (!value) return { isValid: false, value: "N/A" };
    
    console.log("Validating original price:", value); // Debug log
    
    // Use the existing validatePrice function but with debug logging
    const result = validatePrice(value);
    console.log("Original price validation result:", result); // Debug log
    
    return result;
}

function validateText(value) {
    // Replace "&amp;" with "&" and remove all white spaces
    let cleanedValue = value.replace(/&amp;|\s/g, "").replace(/-/g, "").trim();
    return cleanedValue;
}

function getAjioCode(url) {
    const match = url.match(/\/p\/([^/?]+)/);
    return match ? match[1] : null;
}


//   function getMyntraImages(images) {
//     const imageUrls = images.map(image => {
//         const style = image.getAttribute("style");
//         return style.match(/url\("(.*?)"\)/)[1]; // Extracts URL from the style attribute
//     });

//   }

function getMyntraCode(url) {
    const match = url.match(/\/(\d+)\//);
    return match ? match[1] : null;
}

// console.log("Myntra Code is ",getMyntraCode("https://www.myntra.com/kurtas/kalini/kalini-ethnic-motif-printed-high-slit-kurta/24793420/buy"))

// utils/messageProcessor.js
function extractLinksAndText(text) {
    // if (typeof text?.caption !== 'string') return { skip: true, links: [], plainText: '' };

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let links = [];
    let plainText = "";
    if (urlRegex && urlRegex != "") {
        try {

            links = text.match(urlRegex) || [];
        } catch (e) {
            console.log("URL Regex Error");
        }
    }
    try {

        plainText = text.replace(urlRegex, '').trim();
        // links = text.match(urlRegex) || [];
    } catch (e) {
        console.log("URL Regex Error");
    }
    // Add a flag to indicate whether to skip processing if no links are found
    const skip = links.length === 0;

    return { skip, links, plainText };
}

function getUserDetails(username, key = null) {
    if (users[username]) {
        // Return specific key if provided, otherwise return the whole object
        return key ? users[username][key] : users[username];
    } else {
        console.warn(`User with username "${username}" not found.`);
        return null;
    }
}

function formatProductInfo(product, tag = "", username = "dealsglobalhub", link = "", shortUrl = "") {
    let messagePrefix = "";

    // product?.productText + `\n\nhttps://dealshubglobal.com/p/${product?.id}`

    // Determine the message prefix based on the discount range
    if (product.discount > 85) {
        messagePrefix = "🔥🔥 Low Price Alert! \n";
    } else if (product.discount > 75) {
        messagePrefix = "💥 Offer! \n";
    }
    if (product.discount > 50) {
        messagePrefix += `${product?.discount}% off 🎉\n`;
    }

    let title;
    if (product?.urltext != "") {
        title = product?.urltext;
    } else if (product?.productText != "") {
        title = product?.productText;
    }
    title = shortenProductText(title);

    // Construct the message
    let message = `${messagePrefix}${title} \n\n✅ Deal price: ₹${product.price}`; //
    // let message = `${messagePrefix}${product.productText} \n\n➡️ Deal price: ₹${product.price}`; //Telegram Text

    // Append additional text if the discount is 50% or less
    if (product.discount && product.discount != null && product.discount != 'null') {
        message += `\n➡️ Discount: ${product.discount}%`;
    }

    // Append link and hashtags
    try {
        // if(tag==""){
        if (username.includes("dealsglobalhub")) {
            // if(product?.productCode!="" && product?.storeType == "Amazon"){
            if (product?.productCode != "") {

                message += `\n\n🛒 Buy Here : https://dealshubglobal.com/p/${product?.productCode}\n\n`;
            } else {
                message += `\n\n🛒 Buy Here : https://dealshubglobal.com/p/${product?.id}\n\n`;

            }
        } else if (product?.storeType == "Amazon" && product?.productCode != "" && tag != "") {
            if (tag != "") {
                message += `\n\n🛒 Buy Here : https://www.amazon.in/dp/${product?.productCode}?tag=${tag}\n\n`;
            } else {
                return "";
            }
        } else {
            //skipping others products other than Amazon 
            message += `\n\n🛒 Buy Here : ${shortUrl}\n\n`;
        }
    }
    catch (e) {

    }
    // message += `\n\nBuy Here : https://dealshubglobal.com/p/${product?.id}\n\n` ;

    if (product.discount > 85) {
        message += "⚡️⚡️ **Price Dropped** 📉\n";
    }

    // Append storeType as hashtag
    message += `#${product.storeType} `;





    let finalCategory = product?.category?.mainCategory || product?.category?.c1;

    if (finalCategory && finalCategory.trim() !== "") {

        // Normalize the category
  const normalizedCategory = normalizeCategory(finalCategory);
  // Map to a generic category (e.g. "home" regardless of "home_kitchen" or "home_accessories")
  const genericCategory = getGenericCategory(normalizedCategory);

  // Append hashtag only if generic category is non-empty
  message += `#${genericCategory} `;

  // Append corresponding emoji
  const emoji = getEmojiForCategory(genericCategory);
  if (emoji) {
    message += emoji;
  }
}


    //     finalCategory = decodeHtmlEntities(finalCategory).replace(/\s+/g, ' ').trim(); // sanitize

    //     message += `#${finalCategory} `;

    //     const emoji = getEmojiForCategory(finalCategory);
    //     if (emoji) {
    //         message += `${emoji}`;
    //     }
    // }







    // Append category hashtags properly
    //   if (product?.category?.mainCategory != "") {
    //     message += `#${product?.category?.mainCategory} `;
    //   } else if (product?.category?.c1 != "") {
    //     message += `#${product?.category?.c1} `;

    //     // Add catchy emoji based on category
    //   message += getEmojiForCategory(product?.category?.mainCategory || product?.category?.c1);
    //   }

    // 💥 Bank Offer : ₹1,000 Instant Discount With ICICI, ONECARD Credit Card Txn
    // 💥🎁 😱 🔥🚀
    // ✅💸 📨 
    // 🛒

    //     ✔️Offer Price:₹363
    // 🛍

    /*
    Mamaearth MEGA SALE 🔥🔥
    
    ➡️ Offer: Buy for Rs.699 & Get 2 product FREE worth Rs.1298
    
    ✅ Use code: MEGAOFFER
    
    👉 Link: 
    
    🚨Freebies on order above Rs.699 👉 Get Perfume Aqua - 50ml + Hydra-Matte Crayon Lipstick - 2.4g  [Worth Rs.129😎
    
    🔴 Note: Get Additional 5% Prepaid Discount
    */


    // ❌Regular Price:₹721

    return message;
}

function normalizeCategory(category = "") {
    if (!category || typeof category !== "string") return "";
    let norm = decodeHtmlEntities(category);
    // Replace '&' with '_' to avoid differences like "Home&Kitchen" vs "Home&Accessories"
    norm = norm.replace(/&/g, "_");
    // Normalize spaces
    norm = norm.replace(/\s+/g, ' ').trim();
    return norm.toLowerCase();
}


// Utility: Map normalized category to a generic category
function getGenericCategory(category = "") {
    if (!category) return "";

    // Here you can extend the conditions as per your requirements.
    const lower = category.toLowerCase();

    if (lower.includes("home")) {
        return "home";
    } else if (lower.includes("fashion")) {
        return "fashion";
    } else if (lower.includes("beauty")) {
        return "beauty";
    } else if (lower.includes("electronic")) {
        return "electronics";
    } else if (lower.includes("mobile")) {
        return "mobile";
    } else if (lower.includes("grocery")) {
        return "grocery";
    } else if (lower.includes("toy")) {
        return "toys";
    } else if (lower.includes("book")) {
        return "books";
    } else if (lower.includes("footwear")) {
        return "footwear";
    } else if (lower.includes("appliance")) {
        return "appliance";
    } else if (lower.includes("health")) {
        return "health";
    }

    // Default: return the normalized category if no generic match is found
    logger.info("Category not found in generic mapping, returning original category:", category);
    return category;
}



function decodeHtmlEntities(text = "") {
    if (!text || typeof text !== "string") return text;

    const entities = {
        '&amp;': '&',
        '&nbsp;': ' ',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#96;': '`',
        '&#x3D;': '=',
    };

    return text.replace(/&[a-zA-Z0-9#]+;/g, match => entities[match] || match);
}

function getEmojiForCategory(category = "") {
    if (!category || typeof category !== "string") return "";

    const categoryMap = {
        "fashion": "👗🧥",
        "beauty": "💄🧴",
        "electronics": "💻📱",
        "home": "🏠🛋️",
        "kitchen": "🍳🥣",
        "mobile": "📱",
        "grocery": "🛒🥦",
        "toys": "🧸🎯",
        "books": "📚",
        "footwear": "👟👠",
        "appliance": "🔌🌀",
        "health": "💊🩺",
    };

    
  // Look up in the map using the generic category
  return categoryMap[category] || "🛍️"; // default fallback if none is found
}

//     const lowerCategory = category.toLowerCase();

//     for (const keyword in categoryMap) {
//         if (lowerCategory.includes(keyword)) {
//             return categoryMap[keyword];
//         }
//     }

//     return "🛍️"; // default fallback
// }





// Utility: Shorten text if needed (you already have this)
// function shortenProductText(text) {
//     const limit = 120;
//     return text.length > limit ? text.slice(0, limit) + "..." : text;
//   }

// Utility: Get emoji based on category
//   function getEmojiForCategory(category = "") {
//     const categoryMap = {
//       "Fashion": "👗🧥",
//       "Beauty": "💄🧴",
//       "Electronics": "💻📱",
//       "Home": "🏠🛋️",
//       "Kitchen": "🍳🥣",
//       "Mobile": "📱",
//       "Grocery": "🛒🥦",
//       "Toys": "🧸🎯",
//       "Books": "📚",
//       "Footwear": "👟👠",
//       "Appliances": "🔌🌀",
//       "Health": "💊🩺",
//     };

//     return categoryMap[category] ? categoryMap[category] : "🛍️"; // default fallback
//   }

function validateMRP(value) {
    // Same logic as validatePrice
    return validatePrice(value);
}

function validateRatingsCount(value) {
    // Extract only the numeric part from strings like '646 Ratings'
    const match = value.replace(/,/g, '').match(/\d+/);
    const count = match ? parseInt(match[0], 10) : NaN;
    return {
        isValid: !isNaN(count) && count > 0,
        value: isNaN(count) ? value : count,
        cleanedValue: match ? match[0] : value
    };
}

// Function to read URLs from a text file and process them
async function extrapeLogin(driver) {
    try {
        await driver.get("https://www.extrape.com/login");
        try {
            const emailField = await driver.findElement(By.id('outlined'));
            await emailField.click();
            await emailField.sendKeys(constants.extraPeUsername);
        } catch (error) {
            console.error("Error entering email:", error);
        }
        try { //login for email
            const loginButton = await driver.findElement(By.xpath('//*[@id="root"]/div/div/div/div[2]/div[2]/div[4]/button'));
            await loginButton.click();
        } catch (error) {
            console.error("Error clicking the login button:", error);
        }
        try { // button for password
            const loginButton = await driver.findElement(By.xpath('//*[@id="root"]/div/div/div/div[2]/div[2]/div[4]/div[3]/button'));
            await loginButton.click();
        } catch (error) {
            console.error("Error clicking the login button:", error);
        }
        try {
            const passwordField = await driver.findElement(By.id("outlined"));
            await passwordField.click();
            await passwordField.sendKeys(constants.extraPePassword);
        } catch (error) {
            console.error("Error entering password:", error);
        }
        try {
            const loginButton = await driver.findElement(By.xpath('//*[@id="root"]/div/div/div/div[2]/div[2]/div[5]/button'));
            await loginButton.click();
        } catch (error) {
            console.error("Error clicking the login button:", error);
        }
    } catch (outerError) {
        console.error("Error logging into Extrape:", outerError);
    }

}
async function readUrlsFromTxtUtils(filePath, processUrl) {
    try {
        const fileStream = fs.createReadStream(filePath);

        // Create a readline interface to process the file line by line
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity, // Recognize all instances of CR LF as a single line break
        });

        for await (const line of rl) {
            // Call the function to process each URL
            await processUrl(line.trim());
        }
    } catch (e) {
        console.error("Error reading the file:", e);
    }
}


function getformattedDate(url) {

    const date = new Date();

    // Get the year, month, and day from the date object
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed, add 1 to get the correct month
    const day = String(date.getDate()).padStart(2, "0");

    // Format the date as YYYY-MM-DD
    let formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}

function getFlipkartProductId(url) {
    const parsedUrl = new URL(url);
    const searchParams = new URLSearchParams(parsedUrl.search);
    productCode = searchParams.get("pid") || "";
    return productCode;

}


function getAsin(url) {
    let start;
    let asin;

    // Check for "/gp/product/"

    // Check for "/dp/"
    start = url.indexOf("/dp/");
    if (start !== -1) {
        start += 4; // Length of "/dp/" is 4
        asin = url.substr(start, 10);
        // Ensure there's a "?" or the end of the URL after the ASIN
        if (url.charAt(start + 10) === '?' || start + 10 === url.length || url.charAt(start + 10) === '/') { // asin.length == 10 => check it
            console.log("ASIN from /dp/:", asin);
            return asin;
        } else if (asin.length == 10) {
            console.log("ASIN URL Error but product key exists => Bug to be fixed => Immediate Check", url);
            return "";
        }
    }

    start = url.indexOf("/gp/product/");
    if (start !== -1) {
        start += 13; // Length of "/gp/product/" is 13
        asin = url.substr(start, 10);
        // Ensure there's a "?" or the end of the URL after the ASIN
        if (url.charAt(start + 10) === '?' || start + 10 === url.length) {
            console.log("ASIN from /gp/product/:", asin);
            return asin;
        }
    }
    console.log("ASIN URL Error", url);
    return "";
}

function getAsinOld(url) {
    let start = url.indexOf("/dp/") + 4;
    if (start == 3) {
        start = url.indexOf("/gp/") + 4;
    }
    if (start != 3) {
        console.log("new asin is ", url.substr(start, 10));
        asin = url.substr(start, 10)
        return asin;
    } else {
        console.log("Asin URL Error ", url);
        return "";
    }
}
function shortenProductText(productText) {
    // List of symbols to trim at or after (including paired brackets)
    const symbols = [',', '|', '.', ']', ')'];

    // Special handling for paired brackets: (), []
    const pairedSymbols = { '(': ')', '[': ']' };

    // Initialize minIndex as the length of the text
    let minIndex = productText.length;

    // Loop through each symbol and find the first occurrence
    symbols.forEach(symbol => {
        let index = productText.indexOf(symbol);
        if (index !== -1 && index < minIndex) {
            minIndex = index;
        }
    });

    // Handle paired symbols like () and []
    Object.keys(pairedSymbols).forEach(openingBracket => {
        let openIndex = productText.indexOf(openingBracket);
        if (openIndex !== -1 && openIndex < minIndex) {
            let closingBracket = pairedSymbols[openingBracket];
            let closeIndex = productText.indexOf(closingBracket, openIndex);
            if (closeIndex !== -1) {
                // Include the closing bracket in the trim
                minIndex = closeIndex + 1;
            }
        }
    });

    // If a symbol was found, trim the text
    if (minIndex !== productText.length) {
        productText = productText.substring(0, minIndex);
    }

    return productText.trim(); // Return the trimmed text, removing extra spaces
}

// Example product text
// let productText = "Elements of Programming Interviews (The Insiders' Guide) | Book for coding interviews.";
// let shortenedText = shortenProductText(productText);

// console.log("Shortened Product Text:", shortenedText);


// Example product text
// let productText = "Elements of Programming Interviews: The Insiders' Guide | Book for coding interviews.";
// let shortenedText = shortenProductText(productText);

// console.log("Shortened Product Text:", shortenedText);


// function validateDiscount(value) {
//     let cleanedValue = value.replace(/%|\s|&nbsp;|-/g, "").trim();
//     const discount = parseInt(cleanedValue, 10);
//     return {
//         isValid: discount > 0,
//         value: discount
//     };
// }

module.exports = {
    validatePrice,
    formatProductInfo,
    validateDiscount,
    validateText,
    validateMRP,
    validateRatingsCount,
    shortenProductText,
    getAsin,
    getFlipkartProductId,
    getformattedDate,
    readUrlsFromTxtUtils,
    extrapeLogin,
    extractLinksAndText,
    getAjioCode,
    getMyntraCode,
    getUserDetails,
    decodeHtmlEntities,
    getEmojiForCategory,
    extractAsin,
    extractProductUrl,
    extractBrand,
    validateRatingsCount,
    validateDiscountPercentage,
    validateBoughtInPastMonth,
    validateOriginalPrice
};
