@echo off
echo ========================================
echo   Trigger Bulk Update and Monitor
echo ========================================
echo.
echo Prerequisites:
echo   1. Backend API running (e.g. START_ALL_SERVICES.bat or: node server/api/index.js)
echo   2. Chrome 145 installed (ChromeDriver 145.0.3 is in package.json)
echo.
echo This script will:
echo   - POST /api/deals/manual-trigger (start bulk update)
echo   - Poll /api/execution/status every 15s until bulk run completes
echo.
echo For Telegram bot: run in a separate terminal: node run_telegram_bot.js
echo   (And start Chrome with remote debugging: chrome.exe --remote-debugging-port=9222)
echo.
cd /d "%~dp0"

node scripts/triggerBulkUpdateAndMonitor.js %*
if errorlevel 1 (
  echo.
  echo If "Could not trigger" appears, start the API first: node server/api/index.js
  pause
  exit /b 1
)
pause
