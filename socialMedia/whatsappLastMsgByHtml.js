const { Builder, By, until } = require('selenium-webdriver');

async function whatsappLastMessageByHtml(driver) {

    try {
        console.log("Waiting for elements with role='row' to be located...");

        // Wait for the page to load and rows to be visible
        await driver.wait(until.elementsLocated(By.css('div[role="row"]')), 10000); // 10 seconds timeout

        console.log("Rows located, fetching rows...");

        // Get all div elements with role="row"
        let rows = await driver.findElements(By.css('div[role="row"]'));
        console.log(`Number of rows found: ${rows.length}`);

        // Iterate in reverse to find the last non-empty row
        for (let i = rows.length - 1; i >= 0; i--) {
            console.log(`Checking row ${i + 1} of ${rows.length}...`);

            try {
                // Locate the timestamp using the `copyable-text` div
                let timeElement = await rows[i].findElement(By.css('div.copyable-text'));
                let time = await timeElement.getAttribute('data-pre-plain-text'); // Extract the timestamp

                // Locate the message content inside the 'span[dir="ltr"]' parent
                let messageContainer = await rows[i].findElement(By.css('span[dir="ltr"]'));
                let messageText = await messageContainer.getText(); // Get the combined text of the message
                
                console.log('Raw message content:', messageText);

                // Extract timestamp and clean it up
                let timeMatch = time.match(/\[(.*?)\]/); // Extracts the time part from [hh:mm am, dd/mm/yyyy]
                if (timeMatch) {
                    console.log('Timestamp extracted:', timeMatch[1].trim());

                    // If the message is empty, skip
                    if (messageText.trim() === '') {
                        console.log('No message content found, skipping...');
                        continue;
                    }

                    console.log('Message extracted:', messageText.trim());

                    // Extract details from the message
                    let details = extractDetails(messageText);

                    // Return the details along with timestamp
                    return {
                        ...details,
                        timestamp: timeMatch[1].trim()
                    };
                }

            } catch (err) {
                console.log(`Error in row ${i + 1}:`, err.message);
            }
        }

        console.log("Finished processing rows.");
        return { message: null, timestamp: null }; // Return null values if no message/timestamp found

    } catch (err) {
        console.log('Error occurred:', err);
        return { message: null, timestamp: null }; // Return null values in case of error
    }
}

// Function to extract details from the message
function extractDetails(message) {
    const details = {};

    const stockMatch = message.match(/Stock:\s*([A-Za-z]+)/);
    const durationMatch = message.match(/Duration:\s*(\d+-\d+\s*days)/);
    const lowPriceMatch = message.match(/Recommended Price:\s*₹(\d+)-(\d+)/);
    const targetMatch = message.match(/Target:\s*₹(\d+)/);
    const stoplossMatch = message.match(/Stoploss:\s*₹(\d+)/);

    if (stockMatch) {
        details.stock = stockMatch[1];
    }
    if (durationMatch) {
        details.duration = durationMatch[1];
    }
    if (lowPriceMatch) {
        details.lowPrice = parseFloat(lowPriceMatch[1]);
        details.highPrice = parseFloat(lowPriceMatch[2]);
    }
    if (targetMatch) {
        details.target = parseFloat(targetMatch[1]);
    }
    if (stoplossMatch) {
        details.stoploss = parseFloat(stoplossMatch[1]);
    }

    return details;
}

module.exports = whatsappLastMessageByHtml;
