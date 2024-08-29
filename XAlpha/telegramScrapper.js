const puppeteer = require('puppeteer');

async function scrapeChannel(channelUrl) {
    // Connect Puppeteer to the existing Chrome instance with remote debugging enabled
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
    const page = await browser.newPage();

    await page.goto(channelUrl, { waitUntil: 'networkidle2' });

    // Log in to Telegram web (if required)
    // You might need to handle the login process here

    const messages = await page.evaluate(() => {
        const messageNodes = document.querySelectorAll('.tgme_widget_message_text');
        const messages = [];
        messageNodes.forEach(node => messages.push(node.innerText));
        return messages;
    });

    await browser.disconnect(); // Do not close the browser, just disconnect Puppeteer
    return messages;
}

(async () => {
    const channelUrl = 'https://web.telegram.org/k/#@bonercto'; // Replace with the actual channel URL
    const messages = await scrapeChannel(channelUrl);

    console.log('Scraped messages:', messages);
})();
