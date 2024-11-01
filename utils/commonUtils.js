function validatePrice(value) {
    let cleanedValue = value.replace(/₹|,|\s|&nbsp;|-/g, "").trim();
    const price = parseInt(cleanedValue, 10);
    return {
        isValid: !isNaN(price) && price > 0,
        value: price
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
function validateText(value) {
    // Replace "&amp;" with "&" and remove all white spaces
    let cleanedValue = value.replace(/&amp;|\s/g, "").replace(/-/g, "").trim();
    return cleanedValue;
}


function formatProductInfo(product,tag="") {
    let messagePrefix = "";

    // product?.productText + `\n\nhttps://dealshubglobal.com/p/${product?.id}`
  
    // Determine the message prefix based on the discount range
    if (product.discount > 85) {
      messagePrefix = "🔥🔥 LOOT! \n";
    } else if (product.discount > 75) {
      messagePrefix = "Offer! \n";
    } if (product.discount > 50) {
      messagePrefix += `${product?.discount}% off on `;
    }

    product.urltext = shortenProductText(product.urltext);
    
    // Construct the message
    let message = `${messagePrefix}${product.urltext} \n\n➡️ Deal price: ₹${product.price}`; //
    // let message = `${messagePrefix}${product.productText} \n\n➡️ Deal price: ₹${product.price}`; //Telegram Text
    
    // Append additional text if the discount is 50% or less
    if (product.discount <= 50) {
      message += `\ndiscount is ${product.discount}%`;
    }
    
    // Append link and hashtags
    try{
        if(tag==""){
            message += `\n\nBuy Here : https://dealshubglobal.com/p/${product?.productCode}\n\n` ;
        } else {
            message += `\n\nBuy Here : https://www.amazon.in/dp/${product?.productCode}?tag=${tag}\n\n` ;

        }
    }
    catch(e) {

    }
    // message += `\n\nBuy Here : https://dealshubglobal.com/p/${product?.id}\n\n` ;
    
    if (product.discount > 85) {
      message +="⚡️⚡️**Price Dropped** \n"
    }
    message+=`#${product.storeType}`
    if (product?.category?.mainCategory!=""){
      `#${product?.category?.mainCategory}`
    } 
    // 💥 Bank Offer : ₹1,000 Instant Discount With ICICI, ONECARD Credit Card Txn
    // 💥💥
    // 🛒

//     ✔️Offer Price:₹363
// 🛍

/*
Mamaearth MEGA SALE 🔥🔥

➡️ Offer: Buy for Rs.699 & Get 2 product FREE worth Rs.1298

✅ Use code: MEGAOFFER

👉 Link: https://extp.in/yMQpJm

🚨Freebies on order above Rs.699 👉 Get Perfume Aqua - 50ml + Hydra-Matte Crayon Lipstick - 2.4g  [Worth Rs.129😎

🔴 Note: Get Additional 5% Prepaid Discount
*/


// ❌Regular Price:₹721
  
    return message;
  }

  // Function to read URLs from a text file and process them
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
        if (url.charAt(start + 10) === '?' || start + 10 === url.length) {
            console.log("ASIN from /dp/:", asin);
            return asin;
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
    if(start == 3) {
        start = url.indexOf("/gp/") + 4;
    }
    if(start != 3) {
        console.log("new asin is ", url.substr(start, 10));
        asin = url.substr(start, 10)
        return asin;
    } else {
        console.log("Asin URL Error ",url);
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


function validateDiscount(value) {
    let cleanedValue = value.replace(/%|\s|&nbsp;|-/g, "").trim();
    const discount = parseInt(cleanedValue, 10);
    return {
        isValid: discount > 0,
        value: discount
    };
}

module.exports = {
    validatePrice,
    formatProductInfo,
    validateDiscount,
    validateText,
    shortenProductText,
    getAsin,
    getformattedDate,
    readUrlsFromTxtUtils
};
