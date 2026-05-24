async function extractAttribute(driver, attributeConfig) {
    let lastConfig; // Variable to store the last config
  
    for (let config of attributeConfig) {
      try {
        let element;
        if (config.type === "xpath") {
          element = await driver.findElement(By.xpath(config.selector));
        } else if (config.type === "id") {
          element = await driver.findElement(By.id(config.selector));
        } else if (config.type === "className") {
          element = await driver.findElement(By.className(config.selector));
        }
  
        const attributeToExtract = config.attribute || "innerHTML";
        let rawValue = await element.getAttribute(attributeToExtract);
  
        const validatorFn = config.validator || config.validate;
        if (validatorFn) {
          const validationResult = validatorFn(rawValue);
          if (!validationResult.isValid) {
            lastConfig = config; // Update lastConfig for the failed config
            continue; // Skip to the next selector if validation fails
          }
          return validationResult.value; // Use modified value
        }
  
        return rawValue.trim(); // Return raw value if no validator is provided
      } catch (error) {
        lastConfig = config; // Update lastConfig for the failed config
        // Optionally log the error or handle it as needed
      }
    }
  
    // Log information only for the last config after the loop
    if (lastConfig) {
      console.log("Validation failed for the last config:", lastConfig?.selector, amazonConfig?.links);
    } else {
      console.log("All xpaths failed or validation failed for all xpaths.");
    }
  
    return null;
  }
  