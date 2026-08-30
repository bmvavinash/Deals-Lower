const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser to test Web Push...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('http://localhost:3000', ['notifications']);

        const page = await browser.newPage();
        
        // Listen to console logs
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('firebase') || text.includes('FCM') || text.includes('Notification') || text.includes('token') || text.includes('error')) {
                console.log(`[PAGE LOG] ${text}`);
            }
        });

        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        console.log('Finding notification bell...');
        // Wait for bell icon
        await page.waitForSelector('svg[data-testid="NotificationsIcon"]', { timeout: 10000 });
        
        console.log('Clicking notification bell...');
        await page.click('svg[data-testid="NotificationsIcon"]');
        
        // Wait for the Enable Push button
        console.log('Waiting for "Enable Push" button in popover...');
        try {
            await page.waitForFunction(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(b => b.textContent.includes('Enable Push'));
            }, { timeout: 5000 });
            
            console.log('Clicking "Enable Push"...');
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const enableBtn = buttons.find(b => b.textContent.includes('Enable Push'));
                if (enableBtn) enableBtn.click();
            });
            
            // Wait 10 seconds to let Firebase do its thing
            await new Promise(r => setTimeout(r, 10000));
        } catch (e) {
            console.log('Could not find Enable Push button. Maybe already enabled or error?', e.message);
        }

        await browser.close();
        console.log('Test completed.');
    } catch (e) {
        console.error('Test failed:', e);
    }
})();
