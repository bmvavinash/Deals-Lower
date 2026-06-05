const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
    let options = new chrome.Options();
    options.addArguments('--headless');
    let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.get('https://www.flipkart.com/homlex-4-ft-x-6-acrylic-carpet/p/itm3671973887974?pid=CPGHNA7SHW3ZJMHY');
    
    const res = await driver.executeScript(`
        return Array.from(document.querySelectorAll('div, span, h1'))
            .filter(el => el.textContent.includes('223') || el.textContent.includes('HOMLEX 4 ft'))
            .map(el => \`\${el.tagName.toLowerCase()} class="\${el.className}" text="\${el.textContent.trim().substring(0,30)}"\`)
            .join('\\n');
    `);
    
    console.log(res);
    await driver.quit();
})();
