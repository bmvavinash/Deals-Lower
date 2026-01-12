const { By, until, Key } = require('selenium-webdriver');
const { extrapeLogin } = require('../utils/commonUtils');

/**
 * Get Extrape affiliate URL with timeout and non-blocking error handling
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} url - Product URL to convert
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} - Extrape affiliate URL or empty string on failure
 */
async function getExtrapeUrl(driver, url, timeout = 30000) {
    let updatedLink = '';
    const startTime = Date.now();

    try {
        // Navigate to Extrape link converter with timeout
        await Promise.race([
            driver.get("https://www.extrape.com/link-converter"),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 10000))
        ]).catch(err => {
            console.error("[extrape] Navigation timeout or error:", err.message);
            return '';
        });

        // Check if we've exceeded total timeout
        if (Date.now() - startTime > timeout) {
            console.warn("[extrape] Timeout before starting extraction");
            return '';
        }

        // Step 1: Try multiple selectors for URL input field
        let urlField = null;
        const urlSelectors = [
            { type: 'xpath', selector: '//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[1]/div/div[2]/textarea' },
            { type: 'css', selector: 'textarea[placeholder*="URL"], textarea[placeholder*="url"]' },
            { type: 'css', selector: 'textarea' },
        ];

        for (const selectorConfig of urlSelectors) {
            try {
                if (selectorConfig.type === 'xpath') {
                    urlField = await driver.findElement(By.xpath(selectorConfig.selector));
                } else {
                    urlField = await driver.findElement(By.css(selectorConfig.selector));
                }
                if (urlField) break;
            } catch (e) {
                continue;
            }
        }

        if (!urlField) {
            // Try login as fallback
            try {
                await extrapeLogin(driver);
                // Retry finding URL field after login
                for (const selectorConfig of urlSelectors) {
                    try {
                        if (selectorConfig.type === 'xpath') {
                            urlField = await driver.findElement(By.xpath(selectorConfig.selector));
                        } else {
                            urlField = await driver.findElement(By.css(selectorConfig.selector));
                        }
                        if (urlField) break;
                    } catch (e) {
                        continue;
                    }
                }
            } catch (loginError) {
                console.warn("[extrape] Login failed, continuing without Extrape URL");
                return '';
            }
        }

        if (urlField) {
            try {
                await urlField.click();
                await urlField.clear();
                await urlField.sendKeys(url);
            } catch (error) {
                console.warn("[extrape] Error entering URL:", error.message);
                return '';
            }
        } else {
            console.warn("[extrape] Could not find URL input field");
            return '';
        }

        // Check timeout before proceeding
        if (Date.now() - startTime > timeout) {
            console.warn("[extrape] Timeout after entering URL");
            return '';
        }

        // Step 2: Click generate button with multiple selector attempts
        const generateSelectors = [
            { type: 'xpath', selector: '//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[1]/div/div[3]/div/div[2]/button' },
            { type: 'css', selector: 'button:contains("Generate"), button:contains("Convert")' },
            { type: 'css', selector: 'button[type="submit"]' },
        ];

        let generateButton = null;
        for (const selectorConfig of generateSelectors) {
            try {
                if (selectorConfig.type === 'xpath') {
                    generateButton = await driver.findElement(By.xpath(selectorConfig.selector));
                } else {
                    generateButton = await driver.findElement(By.css(selectorConfig.selector));
                }
                if (generateButton) break;
            } catch (e) {
                continue;
            }
        }

        if (generateButton) {
            try {
                await generateButton.click();
            } catch (error) {
                console.warn("[extrape] Error clicking generate button:", error.message);
                return '';
            }
        } else {
            console.warn("[extrape] Could not find generate button");
            return '';
        }

        // Check timeout before waiting for result
        if (Date.now() - startTime > timeout) {
            console.warn("[extrape] Timeout after clicking generate");
            return '';
        }

        // Step 3: Wait for output with timeout
        const remainingTime = timeout - (Date.now() - startTime);
        if (remainingTime <= 0) {
            return '';
        }

        const outputSelectors = [
            { type: 'xpath', selector: '//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[2]/div/div[2]/textarea' },
            { type: 'css', selector: 'textarea[readonly]' },
        ];

        let linkOutputField = null;
        for (const selectorConfig of outputSelectors) {
            try {
                if (selectorConfig.type === 'xpath') {
                    linkOutputField = await driver.findElement(By.xpath(selectorConfig.selector));
                } else {
                    linkOutputField = await driver.findElement(By.css(selectorConfig.selector));
                }
                if (linkOutputField) break;
            } catch (e) {
                continue;
            }
        }

        if (linkOutputField) {
            try {
                await driver.wait(async function() {
                    updatedLink = await linkOutputField.getAttribute('value') || await linkOutputField.getAttribute('innerHTML') || '';
                    return updatedLink && updatedLink.trim() !== '';
                }, Math.min(remainingTime, 15000)); // Max 15 seconds wait
            } catch (error) {
                console.warn("[extrape] Timeout or error retrieving updated link:", error.message);
            }
        }

    } catch (outerError) {
        console.warn("[extrape] Unexpected error:", outerError.message);
    }

    return updatedLink || '';
}

module.exports = {
    getExtrapeUrl
};
