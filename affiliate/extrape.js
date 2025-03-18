const { By, until } = require('selenium-webdriver');
const { extrapeLogin } = require('../utils/commonUtils');

async function getExtrapeUrl(driver, url) {
    let updatedLink = '';

    await driver.get("https://www.extrape.com/link-converter");
    try {
        // try {
        //     link = await driver.getCurrentUrl();
        // } catch(e) {
        //     console.log("Url Generation Error")
        // }
        // Step 1: Click on the first element and enter URL
        try {
            const urlField = await driver.findElement(By.xpath('//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[1]/div/div[2]/textarea'));
            await urlField.click();
            await urlField.sendKeys(url);
        } catch (error) {
            console.error("Error entering URL:", error);
            try{
                await extrapeLogin(driver);
            }
            catch(e){
                console.log("Error in Extrape Login1");
            }

            // try{
            //     const closeButton = await driver.findElement(By.xpath('/html/body/div[5]/div[3]/div[1]/div[2]/svg/path'));
            //     await closeButton.click();
            // }    
            // catch(e){
            //     console.log("Error in Extrape Login2");
            // }
            // try{

            // }catch(e) {
            //     console.error("Error removing using x in Extrape");
            // }
            await driver.actions()
              .keyDown(Key.ESCAPE)
              .keyUp(Key.ESCAPE)
              .perform()

              try {
                const urlField = await driver.findElement(By.xpath('//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[1]/div/div[2]/textarea'));
                await urlField.click();
                await urlField.sendKeys(url);
            } catch (error) {
                console.log("2nd Time Extrape Error");
            }
        }

        // Step 2: Click the button to generate the link
        try {
            const generateButton = await driver.findElement(By.xpath('//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[1]/div/div[3]/div/div[2]/button'));
            await generateButton.click();
        } catch (error) {
            console.error("Error clicking the generate button:", error);
        }

        // Step 3: Wait for the updated link to be available and retrieve its text
        try {
            const linkOutputField = await driver.findElement(By.xpath('//*[@id="simple-tabpanel-0"]/div/span/div[2]/div[2]/div/div[2]/textarea'));
            await driver.wait(async function() {
                updatedLink = await linkOutputField.getAttribute('innerHTML');
                return updatedLink && updatedLink.trim() !== '';  // Wait until it's non-empty
            }, 50000);  // Adjust timeout as needed (e.g., 10 seconds)
        } catch (error) {
            console.error("Error retrieving the updated link:", error);
        }

    } catch (outerError) {
        console.error("Unexpected error in enterUrlAndGetUpdatedLink:", outerError);
    }

    return updatedLink;
}

module.exports = {
    getExtrapeUrl
};
