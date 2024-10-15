const { Builder, By, until } = require('selenium-webdriver');

async function tableExtract(driver) {

    try {
        // Wait until the Accounts-tab is available (5th <i> tag with id 'Accounts-tab')
        // let accountsTab = await driver.findElement(By.id('Accounts-tab'));

        // Click on the Accounts-tab to load the relevant data
        // await accountsTab.click();

        // Optionally: wait for the table to be loaded after clicking
        await driver.wait(until.elementLocated(By.css('.rwd-table')), 10000); // Adjust the timeout as needed

        // If the data is inside an iframe, switch to the iframe
        // (Only switch if there's an iframe, this example assumes no iframe)
        // let iframe = await driver.findElement(By.css('iframe'));
        // await driver.switchTo().frame(iframe);  // Uncomment if iframe exists

        // Now within the Accounts-tab content, locate the table and extract data
        let headers = await driver.findElements(By.css('.rwd-table thead tr th'));
        let headerTexts = [];

        // Loop through headers to get the text
        for (let header of headers) {
            headerTexts.push(await header.getText());
        }

        // Find all table rows (excluding headers)
        let rows = await driver.findElements(By.css('.rwd-table tbody tr'));
        let tableData = [];

        // Loop through rows to extract data
        for (let row of rows) {
            let cells = await row.findElements(By.css('td'));
            let rowData = {};

            for (let i = 0; i < cells.length; i++) {
                let cellText = await cells[i].getText();

                // Check if the cell contains an image
                let imgElement = await cells[i].findElement(By.css('img')).catch(() => null);
                let imgSrc = imgElement ? await imgElement.getAttribute('src') : '';

                // Store the text and image URL if available
                rowData[headerTexts[i] || `Column ${i + 1}`] = imgSrc ? { text: cellText, image: imgSrc } : cellText;
            }

            tableData.push(rowData);
        }

        // Log the extracted table data in JSON format
        console.log(JSON.stringify(tableData, null, 2));

    } finally {
        // Quit the driver after extraction (if required)
        // await driver.quit();
    }
}

// Usage Example (Ensure to set up the driver properly before calling)
// const driver = new Builder().forBrowser('chrome').build();
// tableExtract(driver);

module.exports = tableExtract;
