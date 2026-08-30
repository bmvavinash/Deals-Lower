const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log("Starting Chrome Debugger in background with automation bypass flags...");

const getChromePathAndProfile = () => {
  const platform = os.platform();
  let chromePath = process.env.CHROME_PATH;
  if (!chromePath) {
    if (platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          break;
        }
      }
    } else if (platform === 'darwin') {
      chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
      // Linux
      const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          break;
        }
      }
    }
  }
  
  if (!chromePath) {
    chromePath = platform === 'win32' ? 'chrome.exe' : 'google-chrome';
  }

  let userDataDir = process.env.CHROME_USER_DATA;
  if (!userDataDir) {
    userDataDir = platform === 'win32' ? 'C:\\selenum\\ChromeProfile' : path.join(os.homedir(), '.selenium/ChromeProfile');
  }

  return { chromePath, userDataDir };
};

const { chromePath, userDataDir } = getChromePathAndProfile();
console.log(`Resolved chromePath: "${chromePath}"`);
console.log(`Resolved userDataDir: "${userDataDir}"`);

const args = [
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-blink-features=AutomationControlled'
];

const child = spawn(chromePath, args, {
  detached: true,
  stdio: 'ignore'
});

child.unref();
console.log("Chrome Debugger spawned successfully in background.");
process.exit(0);
