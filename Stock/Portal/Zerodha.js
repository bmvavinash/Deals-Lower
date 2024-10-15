const { Builder, By, Key, until } = require('selenium-webdriver');
const constants = require("../../config/constants");
const zerodhaHoldings = require("./zerodhaHoldings");
const getTOTP = require('../../utils/auth_utils/totp');

async function Zerodha(driver) {
    try {
        const secret = constants.kiteKey; // Example secret key
        await driver.get('https://kite.zerodha.com/holdings');
        await driver.findElement(By.id('password')).sendKeys(constants.kitePassword);
        await driver.findElement(By.xpath('//*[@id="container"]/div[2]/div/div/form/div[3]/button')).click();
        const totp = await getTOTP(secret);
        console.log(totp)
        console.log(typeof(totp))
        // await driver.sleep(1000);
        const totpInputField = await driver.findElement(By.id('userid')); // Update this selector as per the input field
        await totpInputField.sendKeys(totp);

        const continueButton = await driver.findElement(By.xpath('//button[text()="Continue"]'));
        await continueButton.click();
        await zerodhaHoldings(driver);
    }
    catch(e){
        console.log("Already Logged In")
        await zerodhaHoldings(driver);
    }  
}
module.exports = Zerodha
// export default Zerodha;