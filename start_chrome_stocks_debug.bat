@echo off
echo Starting Dedicated Chrome for Stocks / WhatsApp 2 on Port 9223...
echo.
echo 1. Uses an independent profile folder: C:\selenum\ChromeStocksProfile
echo 2. Port 9223 will NOT collide with your existing Port 9222 Chrome.
echo 3. Persistent profile (no incognito) so WhatsApp Web login remains saved permanently.
echo.

REM Create target directory if it does not exist
if not exist "C:\selenum\ChromeStocksProfile" mkdir "C:\selenum\ChromeStocksProfile"

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9223 ^
  --user-data-dir="C:\selenum\ChromeStocksProfile" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-background-timer-throttling ^
  --disable-backgrounding-occluded-windows ^
  --disable-renderer-backgrounding

echo Chrome Stocks Profile started on port 9223!
echo Next: Open https://web.whatsapp.com and scan QR code with your second number.
timeout /t 3 >nul
