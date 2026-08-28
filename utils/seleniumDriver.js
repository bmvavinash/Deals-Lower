const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
// require('chromedriver');

/**
 * Returns true when the WebDriver session can execute commands.
 */
async function isDriverSessionValid(driver) {
  if (!driver || typeof driver.getCurrentUrl !== 'function') {
    return false;
  }
  try {
    await driver.getCurrentUrl();
    return true;
  } catch {
    return false;
  }
}

async function createHeadlessChromeDriver() {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1920,1080');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.addArguments('--disable-infobars');
  options.addArguments('--lang=en-US');
  options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  options.excludeSwitches(['enable-automation']);

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    await driver.executeScript('Object.defineProperty(navigator, "webdriver", {get: () => undefined})');
  } catch {
    // non-fatal
  }
  return driver;
}

async function connectDebuggerChromeDriver(debuggerAddress = 'localhost:9222') {
  const options = new chrome.Options();
  options.debuggerAddress(debuggerAddress);
  return chrome.Driver.createSession(options);
}

const net = require('net');

function isPortOpen(port, host = '127.0.0.1', timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      status = true;
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      socket.destroy();
    });

    socket.on('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

/**
 * Prefer an existing Chrome on debugger port; fall back to headless Chrome.
 */
async function createChromeDriver(options = {}) {
  const preferDebugger = options.preferDebugger !== false;
  const debuggerAddress = options.debuggerAddress || process.env.CHROME_DEBUGGER_ADDRESS || 'localhost:9222';

  if (preferDebugger) {
    try {
      const parts = debuggerAddress.split(':');
      const host = parts[0] || '127.0.0.1';
      const port = parseInt(parts[1] || '9222', 10);
      const isDebuggerOpen = await isPortOpen(port, host);
      
      if (isDebuggerOpen) {
        const debuggerDriver = await connectDebuggerChromeDriver(debuggerAddress);
        if (await isDriverSessionValid(debuggerDriver)) {
          return { driver: debuggerDriver, mode: 'debugger', debuggerAddress };
        }
        try {
          await debuggerDriver.quit();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      // fall through to headless
    }
  }

  const headlessDriver = await createHeadlessChromeDriver();
  if (await isDriverSessionValid(headlessDriver)) {
    return { driver: headlessDriver, mode: 'headless' };
  }

  try {
    await headlessDriver.quit();
  } catch {
    // ignore
  }

  throw new Error('Failed to create a valid Chrome WebDriver session (debugger and headless both failed)');
}

module.exports = {
  isDriverSessionValid,
  createChromeDriver,
  createHeadlessChromeDriver,
  connectDebuggerChromeDriver
};
