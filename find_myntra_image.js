const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function findMyntraImageSelector() {
  let driver;
  try {
    let options = new chrome.Options();
    options.debuggerAddress("localhost:9222");
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    console.log("Navigating to Myntra product...");
    await driver.get("https://www.myntra.com/jeans/roadster/roadster-men-black-carrot-fit-mid-rise-clean-look-stretchable-jeans/11631306/buy");
    
    // Wait for a few seconds to let page load
    await driver.sleep(5000);

    console.log("Looking for images...");
    const elements = await driver.executeScript(`
      const images = [];
      // Get all img tags
      document.querySelectorAll('img').forEach(img => {
        if (img.src && img.src.includes('assets.myntassets.com')) {
          images.push({ type: 'img', class: img.className, src: img.src });
        }
      });
      // Get all elements with background-image
      document.querySelectorAll('.image-grid-image').forEach(el => {
        images.push({ 
          type: 'image-grid-image', 
          inlineStyle: el.getAttribute('style'), 
          computedBg: window.getComputedStyle(el).backgroundImage 
        });
      });
      return images;
    `);

    console.log("Found images:");
    console.log(JSON.stringify(elements, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (driver) {
      // Don't quit to keep it alive
    }
  }
}

findMyntraImageSelector();
