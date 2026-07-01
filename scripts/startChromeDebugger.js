const { spawn } = require('child_process');

console.log("Starting Chrome Debugger in background with automation bypass flags...");
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = [
  '--remote-debugging-port=9222',
  '--user-data-dir=C:\\selenum\\ChromeProfile',
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
