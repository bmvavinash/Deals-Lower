const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('dad-expenses');

// Get Chrome executable path based on OS
const getChromePath = () => {
  const platform = os.platform();
  if (platform === 'win32') {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  } else if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else {
    return 'google-chrome';
  }
  return null;
};

// Check if Chrome is already running on port 9222
const isChromeRunning = () => {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:9222/json', { timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
};

// Automatically start Chrome with debugging port if not running
const ensureChromeRunning = async () => {
  const isRunning = await isChromeRunning();
  
  if (isRunning) {
    logger.info('Chrome is already running on port 9222');
    return true;
  }

  logger.info('Chrome not running on port 9222, starting Chrome automatically...');
  
  const chromePath = getChromePath();
  if (!chromePath || !fs.existsSync(chromePath)) {
    throw new Error('Chrome executable not found. Please install Google Chrome or start Chrome manually with --remote-debugging-port=9222');
  }

  const userDataDir = process.env.CHROME_USER_DATA || path.join(os.homedir(), '.chrome-debug-profile');
  const args = [
    '--remote-debugging-port=9222',
    `--user-data-dir="${userDataDir}"`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ];

  try {
    spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
      shell: false
    }).unref();

    logger.info('Chrome started with debugging port, waiting for connection...');
    
    // Wait for Chrome to be ready (max 10 seconds)
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const running = await isChromeRunning();
      if (running) {
        logger.info('Chrome is now accessible on port 9222');
        return true;
      }
    }

    throw new Error('Chrome started but did not become accessible on port 9222 within timeout');
  } catch (error) {
    logger.error('Failed to start Chrome', { error: error.message });
    throw new Error(`Failed to start Chrome: ${error.message}`);
  }
};

// Connect to Chrome instance on port 9222, auto-starting if needed
const connectToBrowser = async () => {
  try {
    // Ensure Chrome is running
    await ensureChromeRunning();
    
    // Connect to Chrome
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
    
    logger.info('Successfully connected to Chrome browser');
    return browser;
  } catch (error) {
    logger.error('Failed to connect to browser', { error: error.message });
    throw new Error(`Failed to connect to browser: ${error.message}`);
  }
};

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    logger.info('Attempting login', { username });

    const browser = await connectToBrowser();
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Navigate to login page
    await page.goto('https://hcp.csmart.in/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for login form and fill credentials
    await page.waitForSelector('input[type="text"], input[name="username"], input[id="username"]', { timeout: 10000 });
    
    // Try to find and fill username field
    const usernameSelectors = [
      'input[type="text"]',
      'input[name="username"]',
      'input[id="username"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="user" i]'
    ];

    let usernameFilled = false;
    for (const selector of usernameSelectors) {
      try {
        const usernameField = await page.$(selector);
        if (usernameField) {
          await usernameField.type(username, { delay: 50 });
          usernameFilled = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!usernameFilled) {
      throw new Error('Could not find username field');
    }

    // Find and fill password field
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]'
    ];

    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const passwordField = await page.$(selector);
        if (passwordField) {
          await passwordField.type(password, { delay: 50 });
          passwordFilled = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!passwordFilled) {
      throw new Error('Could not find password field');
    }

    // Wait a bit before submitting
    await page.waitForTimeout(1000);

    // Look for submit button and click (but don't submit if user requested not to)
    // Actually, we'll just verify the form is filled and return success
    // The user will manually submit or we can add a flag later

    logger.info('Login form filled successfully', { username });

    res.json({ 
      success: true, 
      message: 'Login form filled successfully. Please verify and submit manually.' 
    });

  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Login failed' 
    });
  }
});

// Process expenses endpoint
router.post('/process', async (req, res) => {
  try {
    const { username, password, expenses } = req.body;

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Expenses array is required' 
      });
    }

    logger.info('Processing expenses', { count: expenses.length });

    const browser = await connectToBrowser();
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Navigate to the expense entry page
    // Note: You may need to adjust this URL to the actual expense entry page
    // The user should navigate to the expense page manually after login, or provide the exact URL
    const expensePageUrl = 'https://hcp.csmart.in/'; // Update this to the actual expense page URL
    
    // Check if we're already on the expense page by looking for the table
    const hasTable = await page.evaluate(() => {
      return !!document.querySelector('.expense-table');
    });

    if (!hasTable) {
      // Try to navigate to the expense page
      await page.goto(expensePageUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for the expense table to be visible
      try {
        await page.waitForSelector('.expense-table', { timeout: 10000 });
      } catch (e) {
        logger.warn('Expense table not found. Please navigate to the expense page manually.');
        return res.status(400).json({
          success: false,
          error: 'Expense table not found. Please navigate to the expense entry page manually and try again.'
        });
      }
    }

    let processedCount = 0;
    const errors = [];

    // Process each expense row
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      
      try {
        // Find the row for this date using XPath
        const rowHandle = await page.evaluateHandle((date) => {
          const xpath = `//table[@class="expense-table"]//tbody//tr[td[1][normalize-space(text())="${date}"]]`;
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue;
        }, expense.date);

        const rowElement = await rowHandle.asElement();
        if (!rowElement) {
          logger.warn('Row not found for date', { date: expense.date });
          errors.push(`Row not found for date: ${expense.date}`);
          continue;
        }

        // Wait for the row to be visible
        await page.waitForTimeout(500);

        // Enable the row (remove disabled attribute from all inputs/selects)
        await page.evaluate((row) => {
          const selects = row.querySelectorAll('select');
          const inputs = row.querySelectorAll('input');
          [...selects, ...inputs].forEach(el => {
            el.removeAttribute('disabled');
            el.disabled = false;
          });
        }, rowElement);
        
        await page.waitForTimeout(300);

        // Set working type
        if (expense.workingType) {
          const workingTypeSelect = await rowElement.$('.working-type');
          if (workingTypeSelect) {
            await page.evaluate((select, value) => {
              const options = Array.from(select.options);
              const option = options.find(opt => 
                opt.textContent.trim() === value || opt.value === value
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, workingTypeSelect, expense.workingType);
            await page.waitForTimeout(300);
          }
        }

        // Set subtype
        if (expense.subtype) {
          const subtypeSelect = await rowElement.$('.sub-type');
          if (subtypeSelect) {
            await page.waitForTimeout(300);
            
            // Map "Field Work" to "Individual" value
            const optionValue = expense.subtype === 'Field Work' ? 'Individual' : expense.subtype;
            
            await page.evaluate((select, value) => {
              const options = Array.from(select.options);
              const option = options.find(opt => 
                opt.value === value || 
                opt.textContent.trim().includes(value) ||
                (value === 'Field Work' && opt.value === 'Individual')
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, subtypeSelect, optionValue);
            await page.waitForTimeout(300);
          }
        }

        // Set route (only if call count > 0)
        if (expense.callCount > 0 && expense.route) {
          const routeSelect = await rowElement.$('.route-select');
          if (routeSelect) {
            await page.waitForTimeout(300);
            
            // Find option with matching route text or data-route attribute
            await page.evaluate((select, routeText) => {
              const options = Array.from(select.options);
              const option = options.find(opt => {
                const routeAttr = opt.getAttribute('data-route');
                return routeAttr === routeText || 
                       opt.textContent.trim().includes(routeText) ||
                       (routeAttr && routeAttr.includes('HYDERABAD - HYDERABAD - HYDERABAD'));
              });
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, routeSelect, expense.route);
            await page.waitForTimeout(300);
          }
        }

        // Set HQ type (only if call count > 0)
        if (expense.callCount > 0 && expense.hqType) {
          const hqTypeSelect = await rowElement.$('.hq-type-select');
          if (hqTypeSelect) {
            await page.waitForTimeout(300);
            await page.evaluate((select, value) => {
              const options = Array.from(select.options);
              const option = options.find(opt => 
                opt.value === value || opt.textContent.trim().includes(value)
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, hqTypeSelect, expense.hqType);
            await page.waitForTimeout(300);
          }
        }

        processedCount++;
        logger.info('Processed expense row', { date: expense.date, index: i + 1 });

        // Small delay between rows
        await page.waitForTimeout(500);

      } catch (error) {
        logger.error('Error processing expense row', { 
          date: expense.date, 
          error: error.message 
        });
        errors.push(`Error processing ${expense.date}: ${error.message}`);
      }
    }

    res.json({ 
      success: true, 
      processedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${processedCount} out of ${expenses.length} expenses`
    });

  } catch (error) {
    logger.error('Process expenses error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process expenses' 
    });
  }
});

module.exports = router;

