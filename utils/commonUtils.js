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
    if (!value || typeof value !== 'string') {
        return { isValid: false, value: "" };
    }

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
        value: !isNaN(numericValue) && numericValue > 0 ? numericValue : "", // Return numeric value if valid, else empty string
        cleanedValue: numericValueString || strippedValue // Partially cleaned or raw stripped value
    };
}


function validateDiscount(value) {
    if (value == null) return { isValid: false, value: "" };
    // const cleanedDigitsOnly = String(value).replace(/[^\d]/g, "");
    const cleanedDigitsOnly = String(value).normalize().replace(/[^\d]/g, "");
    const discount = cleanedDigitsOnly.length ? parseInt(cleanedDigitsOnly, 10) : NaN;
    return {
        isValid: !isNaN(discount) && discount > 0,
        value: !isNaN(discount) ? discount : ""
    };
}

// Function to extract ASIN from data-csa-c-item-id attribute
function extractAsin(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Extracting ASIN from:", value);
    
    // Extract ASIN from format like "amzn1.asin.1.B0F4DG9ZH5"
    const asinMatch = value.match(/amzn1\.asin\.\d+\.([A-Z0-9]{10})/);
    if (asinMatch) {
        logger.debug("ASIN extracted:", asinMatch[1]);
        return {
            isValid: true,
            value: asinMatch[1]
        };
    }
    
    // Try alternative format if the first one doesn't work
    const altMatch = value.match(/([A-Z0-9]{10})/);
    if (altMatch) {
        logger.debug("ASIN extracted (alternative):", altMatch[1]);
        return {
            isValid: true,
            value: altMatch[1]
        };
    }
    
    logger.debug("No ASIN found in:", value);
    return { isValid: false, value: "" };
}

// Function to extract actual product URL from Amazon's sponsored link format
function extractProductUrl(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Extracting product URL from:", value);
    
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
            logger.debug("Decoded URL:", decodedUrl);
            
            if (decodedUrl.includes('/dp/')) {
                const fullUrl = decodedUrl.startsWith('http') ? decodedUrl : `https://www.amazon.in${decodedUrl}`;
                return {
                    isValid: true,
                    value: fullUrl
                };
            }
        } catch (error) {
            logger.warn("Error decoding URL:", { error: String(error) });
        }
    }
    
    logger.debug("No product URL found in:", value);
    return { isValid: false, value: "" };
}

// Function to extract brand name from product title
function extractBrand(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Extracting brand from:", value);
    
    // Common brand patterns - extract the first word before any special characters or spaces
    const brandMatch = value.match(/^([A-Za-z]+)/);
    if (brandMatch) {
        const brand = brandMatch[1];
        logger.debug("Brand extracted:", brand);
        return {
            isValid: true,
            value: brand
        };
    }
    
    logger.debug("No brand found in:", value);
    return { isValid: false, value: "" };
}

// Function to clean ratings count by removing parentheses
function validateRatingsCount(value) {
    if (!value) return { isValid: false, value: "" };
    
    // Extract only the numeric part from strings like '646 Ratings' or '4.5 out of 5 stars'
    const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    const count = match ? parseFloat(match[0]) : NaN;
    
    // If it's a rating (like 4.5), return as is
    if (count >= 0 && count <= 5) {
        return {
            isValid: true,
            value: count,
            cleanedValue: match[0]
        };
    }
    
    // If it's a count (like 646), return as is
    if (count > 5) {
        return {
            isValid: true,
            value: count,
            cleanedValue: match[0]
        };
    }
    
    // Remove parentheses and clean the text for other cases
    const cleanedValue = value.replace(/[()]/g, '').trim();
    return {
        isValid: cleanedValue.length > 0,
        value: cleanedValue
    };
}

// Function to extract discount percentage from text like "(35% off)"
function validateDiscountPercentage(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Extracting discount from:", value);
    
    // Extract percentage from text like "(35% off)"
    const discountMatch = value.match(/\((\d+)%\s*off\)/);
    if (discountMatch) {
        const discount = parseInt(discountMatch[1], 10);
        logger.debug("Discount extracted:", discount);
        return {
            isValid: true,
            value: discount
        };
    }
    
    logger.debug("No discount found in:", value);
    return { isValid: false, value: "" };
}

// Function to validate bought in past month text and filter out M.R.P
function validateBoughtInPastMonth(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Validating bought in past month:", value);
    
    // Check if it contains "bought in past month" pattern
    if (value.includes("bought in past month")) {
        logger.debug("Valid bought in past month text:", value);
        return {
            isValid: true,
            value: value
        };
    }
    
    // If it's M.R.P or other text, return empty string
    logger.debug("Not a bought in past month text:", value);
    return { isValid: false, value: "" };
}

// Function to validate original price with debug logging
function validateOriginalPrice(value) {
    if (!value) return { isValid: false, value: "" };
    
    logger.debug("Validating original price:", value);
    
    // Use the existing validatePrice function but with debug logging
    const result = validatePrice(value);
    logger.debug("Original price validation result:", result);
    
    return result;
}

function validateText(value) {
    if (!value || typeof value !== 'string') {
        return { isValid: false, value: "" };
    }
    // FUTURE REQUIREMENT: Replace "&amp;" with "&", normalize spaces, and remove hyphens
    // let cleanedValue = value.replace(/&amp;/g, "&").replace(/\s+/g, " ").replace(/-/g, "").trim();
    
    // CURRENT REQUIREMENT: Replace "&amp;" with "&" and remove all white spaces
    let cleanedValue = value.replace(/&amp;|\s/g, "").replace(/-/g, "").trim();
    
    return {
        isValid: cleanedValue.length > 0,
        value: cleanedValue
    };
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

                message += `\n\n🛒 Buy Here : https://lowerdeal.com/p/${product?.productCode}\n\n`;
            } else {
                message += `\n\n🛒 Buy Here : https://lowerdeal.com/p/${product?.id}\n\n`;

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
    let productCode = searchParams.get("pid") || "";
    return productCode;
}


function getAsin(url) {
    let start;
    let asin;

    // Check for "/dp/"
    start = url.indexOf("/dp/");
    if (start !== -1) {
        start += 4; // Length of "/dp/" is 4
        asin = url.substr(start, 10);
        // Ensure a delimiter or end after the ASIN
        if (
            url.charAt(start + 10) === '?' ||
            url.charAt(start + 10) === '/' ||
            url.charAt(start + 10) === '#' ||
            start + 10 === url.length
        ) {
            logger.debug("ASIN from /dp/:", asin);
            return asin;
        } else if (asin.length === 10) {
            logger.warn("ASIN URL Error but product key exists => Bug to be fixed => Immediate Check", { url });
            return "";
        }
    }

    // Check for "/gp/product/"
    start = url.indexOf("/gp/product/");
    if (start !== -1) {
        start += 13; // Length of "/gp/product/" is 13
        asin = url.substr(start, 10);
        // Ensure a delimiter or end after the ASIN
        if (
            url.charAt(start + 10) === '?' ||
            url.charAt(start + 10) === '/' ||
            url.charAt(start + 10) === '#' ||
            start + 10 === url.length
        ) {
            logger.debug("ASIN from /gp/product/:", asin);
            return asin;
        }
    }

    // Fallback: robust regex extraction for typical Amazon product URLs
    const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[\/?#]|$)/i);
    if (match) {
        logger.debug("ASIN extracted via regex:", match[1]);
        return match[1].toUpperCase();
    }
    logger.warn("ASIN URL Error", { url });
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

// Banner validation functions
function validateBannerUrl(url, allowedDomains = []) {
    if (!url) return { isValid: false, value: "" };
    
    // Check if URL is valid
    try {
        const urlObj = new URL(url);
        
        // Check if domain is allowed
        if (allowedDomains.length > 0) {
            const domain = urlObj.hostname;
            const isAllowed = allowedDomains.some(allowed => domain.includes(allowed));
            if (!isAllowed) {
                return { isValid: false, value: "", reason: "Domain not allowed" };
            }
        }
        
        return { isValid: true, value: url };
    } catch (error) {
        return { isValid: false, value: "", reason: "Invalid URL" };
    }
}

function validateBannerContent(altText, title, excludedKeywords = []) {
    if (!altText && !title) return { isValid: false, value: "" };
    
    const text = (altText || title || "").toLowerCase();
    
    // Check for excluded keywords
    for (const keyword of excludedKeywords) {
        if (text.includes(keyword.toLowerCase())) {
            return { isValid: false, value: "", reason: `Contains excluded keyword: ${keyword}` };
        }
    }
    
    // Check for percentage patterns (commission, fee, etc.)
    const percentagePatterns = [
        /\d+%\s*(?:commission|fee|earning)/i,
        /commission\s*\d+%/i,
        /fee\s*\d+%/i,
        /earning\s*\d+%/i
    ];
    
    for (const pattern of percentagePatterns) {
        if (pattern.test(text)) {
            return { isValid: false, value: "", reason: "Contains affiliate percentage pattern" };
        }
    }
    
    return { isValid: true, value: altText || title };
}

async function validateBannerImage(url, minWidth = 300, minHeight = 150, maxWidth = 1200, maxHeight = 400) {
    if (!url) return { isValid: false, value: "" };
    
    try {
        // Basic URL validation
        const urlObj = new URL(url);
        
        // For now, validate URL format and basic dimensions from URL patterns
        // In production, you might want to make a HEAD request to check actual image dimensions
        return { isValid: true, value: url };
    } catch (error) {
        return { isValid: false, value: "", reason: "Invalid image URL" };
    }
}

// Function to categorize banners based on content and context
function categorizeBanner(altText, title, url, platform) {
    if (!altText && !title) return { category: 'category', priority: 4 };
    
    const text = (altText || title || "").toLowerCase();
    const urlText = url.toLowerCase();
    
    // Check for hero banners (usually large, prominent banners)
    const heroKeywords = ['hero', 'main', 'primary', 'featured', 'banner'];
    if (heroKeywords.some(keyword => text.includes(keyword) || urlText.includes(keyword))) {
        return { category: 'hero', priority: 1 };
    }
    
    // Check for promotional banners
    const promoKeywords = ['sale', 'offer', 'deal', 'discount', 'save', 'off'];
    if (promoKeywords.some(keyword => text.includes(keyword))) {
        return { category: 'promotional', priority: 2 };
    }
    
    // Check for seasonal banners
    const seasonalKeywords = ['seasonal', 'festival', 'holiday', 'christmas', 'diwali', 'eid'];
    if (seasonalKeywords.some(keyword => text.includes(keyword))) {
        return { category: 'seasonal', priority: 3 };
    }
    
    // Default to category
    return { category: 'category', priority: 4 };
}

// Function to check if element is a product carousel (should be excluded)
function isProductCarousel(element, selectors) {
    try {
        // Check for product-related keywords in alt text or nearby text
        const altText = element.getAttribute('alt') || '';
        const text = altText.toLowerCase();
        
        const productKeywords = [
            'product', 'item', 'goods', 'merchandise', 'inventory',
            'add to cart', 'buy now', 'shop now', 'view details',
            'price', 'discount', 'offer', 'deal'
        ];
        
        return productKeywords.some(keyword => text.includes(keyword));
    } catch (error) {
        return false;
    }
}

function generateBannerId(platform, category = "banner", timestamp = null) {
    const time = timestamp || new Date().getTime();
    const date = new Date(time).toISOString().split('T')[0];
    const uniqueId = Math.random().toString(36).substring(2, 8);
    return `${platform}-${category}-${date}-${uniqueId}`;
}

function generateBannerTimestamp() {
    return new Date().toISOString();
}

/**
 * Extract product code from URL for different platforms
 * @param {string} url - Product URL
 * @param {string} storeKey - Platform identifier (amazon, flipkart, myntra, ajio)
 * @returns {Object} - { isValid: boolean, value: string }
 */
function getCode(url, storeKey) {
    if (!url || typeof url !== 'string') {
        return { isValid: false, value: "" };
    }
    
    try {
        let productCode = "";
        
        switch (storeKey.toLowerCase()) {
            case 'amazon':
                // Extract ASIN from Amazon URL
                const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
                if (asinMatch) {
                    productCode = asinMatch[1];
                }
                break;
                
            case 'flipkart':
                // Extract PID from Flipkart URL
                const pidMatch = url.match(/pid=([A-Z0-9]+)/);
                if (pidMatch) {
                    productCode = pidMatch[1];
                }
                break;
                
            case 'myntra':
                // Extract product code from Myntra URL
                const myntraMatch = url.match(/\/(\d+)\/buy/);
                if (myntraMatch) {
                    productCode = myntraMatch[1];
                }
                break;
                
            case 'ajio':
                // Extract product code from Ajio URL
                const ajioMatch = url.match(/\/p\/(\d+)_/);
                if (ajioMatch) {
                    productCode = ajioMatch[1];
                }
                break;
                
            default:
                // Try generic patterns
                const genericMatch = url.match(/\/([A-Z0-9]{8,})\/?/);
                if (genericMatch) {
                    productCode = genericMatch[1];
                }
                break;
        }
        
        if (productCode) {
            return { isValid: true, value: productCode };
        } else {
            return { isValid: false, value: "" };
        }
        
    } catch (error) {
        console.error('Error extracting product code:', error);
        return { isValid: false, value: "" };
    }
}

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
    validateDiscountPercentage,
    validateBoughtInPastMonth,
    validateOriginalPrice,
    validateBannerUrl,
    validateBannerContent,
    validateBannerImage,
    generateBannerId,
    generateBannerTimestamp,
    categorizeBanner,
    isProductCarousel,
    getCode
};
