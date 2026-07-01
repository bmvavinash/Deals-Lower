@echo off
echo Starting Chrome with remote debugging and persistent profile...
echo.
echo Make sure to:
echo 1. Login to Amazon Associates in this Chrome instance
echo 2. Keep this Chrome window open while running the application
echo 3. The application will connect to this Chrome instance via port 9222
echo.

REM Start Chrome with remote debugging and persistent profile in incognito
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="C:\selenum\ChromeProfile" ^
  --incognito ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-background-timer-throttling ^
  --disable-backgrounding-occluded-windows ^
  --disable-renderer-backgrounding ^
  --disable-blink-features=AutomationControlled

echo Chrome started successfully!
echo.
echo Next steps:
echo 1. Login to Amazon Associates in the opened Chrome window
echo 2. Run the application: node index.js
echo 3. The application will use this Chrome instance for Amazon link generation
echo.
timeout /t 3 >nul

