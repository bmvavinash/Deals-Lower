const chrome = require('selenium-webdriver/chrome');
const { Builder, By } = require('selenium-webdriver');

async function test() {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    
    // We don't want to close the user's browser, so we'll just connect and execute.
    let driver = await chrome.Driver.createSession(options);
    
    try {
        await driver.get('https://kite.zerodha.com/holdings');
        
        // Wait for table to load
        await driver.sleep(3000);
        
        let rows = await driver.findElements(By.css('table tbody tr'));
        let tableData = [];
        
        if (rows.length === 0) {
            console.log("No table rows found. Are you logged in to Kite?");
            return;
        }

        let headers = await driver.findElements(By.css('table thead tr th'));
        let headerTexts = [];
        for (let h of headers) {
            headerTexts.push(await h.getText());
        }

        for (let row of rows) {
            let cells = await row.findElements(By.css('td'));
            let rowData = {};
            for (let i = 0; i < cells.length; i++) {
                if(headerTexts[i]) {
                    rowData[headerTexts[i]] = await cells[i].getText();
                }
            }
            tableData.push(rowData);
        }
        
        console.log(JSON.stringify(tableData.slice(0, 5), null, 2)); // Print first 5 rows to not flood logs
        console.log("Total rows extracted:", tableData.length);
    } catch(e) {
        console.error("Error connecting to Kite or extracting data:", e.message);
    } finally {
        await driver.quit();
    }
}
test();
