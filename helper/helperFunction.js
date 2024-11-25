const { By } = require("selenium-webdriver");

/**
 * Extract text dynamically based on selector type.
 * @param {WebElement} element - The web element to extract text from.
 * @param {string} type - Selector type (e.g., className, xpath, tag).
 * @param {string} selector - The selector string.
 * @returns {Promise<string>} Extracted text or default value.
 */
async function extractText(element, type, selector) {
    try {
        const childElement = await element.findElement(By[type](selector));
        return await childElement.getText();
    } catch (error) {
        // Log a warning and return default "N/A" for missing elements
        console.warn(`Error extracting text using ${type} (${selector}):`, error.message);
        return "N/A";
    }
}

module.exports = { extractText };
