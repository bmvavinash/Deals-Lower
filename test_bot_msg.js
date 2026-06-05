const { processBotMessage, setDriver } = require('./dataSources/autoTelegramAll'); 
const { createChromeDriver } = require('./utils/seleniumDriver'); 
async function test() { 
  console.log('Initializing WebDriver...'); 
  const { driver } = await createChromeDriver(); 
  setDriver(driver); 
  console.log('Simulating Telegram message...'); 
  await processBotMessage({ 
    chat: { title: 'Test Group', username: 'testuser' }, 
    text: 'Check out this deal! https://www.amazon.in/dp/B0CS2SVZWC', 
    message_id: 12345 
  }); 
  console.log('Waiting for processing to finish...'); 
  await new Promise(r => setTimeout(r, 180000)); 
  console.log('Done.'); 
  process.exit(0); 
} 
test().catch(console.error);
