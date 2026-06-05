const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function extractAttribute(driver, attributeConfig) {
    for (let config of attributeConfig) {
        try {
            let element;
            if (config.type === 'xpath') {
                element = await driver.findElement(By.xpath(config.selector));
            } else if (config.type === 'css') {
                element = await driver.findElement(By.css(config.selector));
            }
            const attributeToExtract = config.attribute || "innerHTML";
            let rawValue = await element.getAttribute(attributeToExtract);
            
            console.log(`Success with ${config.selector} -> raw: ${rawValue}`);
            return rawValue.trim();
        } catch (e) {
            console.log(`Failed on ${config.selector}: ${e.message}`);
        }
    }
    return null;
}

async function run() {
    let driver;
    try {
        let options = new chrome.Options();
        options.addArguments('--headless=new');
        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        await driver.get("https://www.flipkart.com/homlex-4-ft-x-6-acrylic-carpet/p/itm3671973887974?pid=CPGHNA7SHW3ZJMHY");
        await driver.sleep(5000);
        
        const photoConfig = [
            { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/div/img', attribute: 'src' },
            { type: 'xpath', selector: '//*[@id="container"]/div/div[3]/div[1]/div[1]/div[1]/div/div[1]/div[2]/div[1]/div[2]/img', attribute: 'src' },
            { type: 'xpath', selector: '(//img[contains(@src, "rukminim2.flixcart.com/image")])[1]', attribute: 'src' }
        ];
        console.log("Photo: ", await extractAttribute(driver, photoConfig));
    } finally {
        if (driver) await driver.quit();
    }
}
run();
