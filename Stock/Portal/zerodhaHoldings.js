const { Builder, By } = require('selenium-webdriver');

async function zerodhaHoldings(driver) {

    try {
        // Navigate to the page
        // await driver.get('https://kite.zerodha.com/holdings');

        // Find all table rows (excluding headers)
        let rows = await driver.findElements(By.css('table tbody tr'));

        // Initialize an array to store the table data
        let tableData = [];

        // Extract headers once outside the loop to improve performance
        let headers = await driver.findElements(By.css('table thead tr th'));
        let headerTexts = [];
        for (let header of headers) {
            headerTexts.push(await header.getText());
        }

        // Loop through all rows
        for (let row of rows) {
            // Find all cells in the current row
            let cells = await row.findElements(By.css('td'));
            let rowData = {};

            // Loop through all cells and extract their text
            for (let i = 0; i < cells.length; i++) {
                let cellText = await cells[i].getText();
                
                // Use the pre-fetched header text
                let headerText = headerTexts[i] || `Column_${i}`;
                
                // Store the text in the rowData object
                rowData[headerText] = cellText;
            }

            // Push the rowData object to the tableData array
            tableData.push(rowData);
        }

        // Log or return the extracted data
        console.log(tableData);

    } finally {
        // Quit the driver after extraction
        // await driver.quit();
    }
}

// Replace 'your_url_here' with the actual URL of the page
// extractTableData('https://kite.zerodha.com/holdings');

module.exports = zerodhaHoldings;
