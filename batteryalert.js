const { Builder, By, Key, until } = require("selenium-webdriver");
const { telegram } = require("./socialMedia/telegramPoster");

async function openAmazonWebsite() {
  
  require("chromedriver");
  const { Options } = require("selenium-webdriver/chrome");

  var chrome = require("selenium-webdriver/chrome");
  const { get } = require("selenium-webdriver/http");
  const { WebElement } = require("selenium-webdriver");
  const { telegram } = require("./telegram");
  const { whatsapp } = require("./whatsapp");
  const { facebook } = require("./facebook");
  const {
    driverLocation,
  } = require("selenium-webdriver/common/seleniumManager");

  let options = await new chrome.Options();
  options.debuggerAddress("localhost:9222");

  //CHROME
  driver = await chrome.Driver.createSession(options);

}










// Check if the browser supports the Battery Status API
if ('getBattery' in navigator) {
    navigator.getBattery().then(function(battery) {
      // Update battery status initially
      updateBatteryStatus(battery);
  
      // Update battery status whenever it changes
      battery.addEventListener('levelchange', function() {
        updateBatteryStatus(battery);
      });
  
      battery.addEventListener('chargingchange', function() {
        updateBatteryStatus(battery);
      });
    });
  } else {
    console.log('Battery Status API not supported');
  }
  
  function updateBatteryStatus(battery) {
    // Get battery level and charging status
    var batteryLevel = battery.level * 100;
    var isCharging = battery.charging;
  
    // Log or use the battery information as needed
    console.log('Battery Level: ' + batteryLevel + '%');
    console.log('Charging: ' + (isCharging ? 'Yes' : 'No'));
  
    // Check if battery level is less than 70 and not charging
    if (batteryLevel > 95 && isCharging) {
    // if (batteryLevel < 70 && !isCharging) {
      // Trigger an alert
      telegram("","@all1apptest","Recharge immediately")
      alert('Battery level is less than 70% and not charging. Please connect the charger.');
    }
  }
  