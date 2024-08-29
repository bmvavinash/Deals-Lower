const { Builder, By, Key, until } = require('selenium-webdriver');

async function initializeDriver() {
    let driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 10000 }); // Set implicit wait
    return driver;
}

async function searchLocation(driver, location) {
    await driver.get('https://maps.google.com/');
    let searchBox = await driver.findElement(By.id('searchboxinput'));
    await searchBox.sendKeys(location, Key.RETURN);
}

async function clickElement(driver, xpath) {
    let element = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
    await driver.wait(until.elementIsVisible(element), 10000);
    await element.click();
}

async function verifyInnerHTML(driver, xpath, expectedText) {
    let element = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
    let innerHTML = await element.getAttribute('innerHTML');
    return innerHTML.includes(expectedText);
}

async function writeReview(driver) {
    const writeReviewXPath = '//*[@id="QA0Szd"]/div/div/div[1]/div[2]/div/div[1]/div/div/div[2]/div[4]/div/button/span/span[2]';
    const fifthStarXPath = '//*[@id="kCvOeb"]/div[1]/div[3]/div[1]/div[2]/div/div[5]/svg/path';
    const postReviewXPath = '//*[@id="kCvOeb"]/div[2]/div/div[2]/div/button/span';
    const seeYourReviewsXPath = '//*[@id="yDmH0d"]/c-wiz/div/div/div/c-wiz/div/div[2]/div/div[2]/div/button/span';

    await clickElement(driver, writeReviewXPath);
    await clickElement(driver, fifthStarXPath);
    await clickElement(driver, postReviewXPath);
    await clickElement(driver, seeYourReviewsXPath);

    // Wait for 10 seconds to allow for the review to be posted
    await driver.sleep(10000);
}

async function goBackToReviews(driver) {
    const backToReviewsXPath = '//*[@id="QA0Szd"]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div/div/button[3]/div[2]/div[2]';
    await clickElement(driver, backToReviewsXPath);
}

async function selectFirstItem(driver) {
    const firstItemXPath = '//*[@id="QA0Szd"]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div[1]/div[3]/div/a';
    await clickElement(driver, firstItemXPath);
    await driver.sleep(2000); // Wait for 2-3 seconds for the item to be selected
}

async function googlemaps() {
    let driver = await initializeDriver();

    try {
        await searchLocation(driver, 'Your Location'); // Replace 'Your Location' with the desired location

        // Check the innerHTML of the Reviews button
        const reviewsButtonXPath = '//*[@id="QA0Szd"]/div/div/div[1]/div[2]/div/div[1]/div/div/div[3]/div/div/button[2]/div[2]/div[2]';
        let isReviewsTab = await verifyInnerHTML(driver, reviewsButtonXPath, 'Reviews');
        if (isReviewsTab) {
            await clickElement(driver, reviewsButtonXPath);
        } else {
            console.log('Reviews tab not found!');
            return;
        }

        await writeReview(driver);
        await goBackToReviews(driver);

        await selectFirstItem(driver);
    } finally {
        await driver.quit();
    }
}

googlemaps().catch(console.error);
