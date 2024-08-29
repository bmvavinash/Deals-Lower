const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

(async function example() {
    let driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(new chrome.Options().addExtensions("/path/to/your/extension.crx")) // Path to your extension
        .build();

    try {
        // Navigate to any page (the extension should be loaded)
        await driver.get("https://www.example.com");

        // Click on the extension icon to open the popup
        const extensionId = "your_extension_id"; // Replace with your extension's ID
        await driver.executeScript(`chrome.runtime.sendMessage("${extensionId}", {action: "open_popup"});`);

        // Wait for the popup to appear and switch to it
        let handles = await driver.getAllWindowHandles();
        let extensionHandle;
        for (const handle of handles) {
            await driver.switchTo().window(handle);
            let title = await driver.getTitle();
            if (title === "Your Extension Popup Title") { // Replace with the actual title of the extension popup
                extensionHandle = handle;
                break;
            }
        }

        if (extensionHandle) {
            await driver.switchTo().window(extensionHandle);
            console.log("Switched to extension popup");

            // Now you can interact with the popup using XPath
            let element = await driver.wait(until.elementLocated(By.xpath('//*[@id="your-element-id"]')), 10000);
            let text = await element.getText();
            console.log("Text from extension popup:", text);
        } else {
            console.log("Extension popup not found");
        }
    } finally {
        await driver.quit();
    }
})();
