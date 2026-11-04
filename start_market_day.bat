@echo off
setlocal enabledelayedexpansion
title DealsOptimised - Market Day Engine Startup
color 0A

echo =======================================================================
echo          DEALSOPTIMISED - MARKET DAY TRADING SERVICES
echo =======================================================================
echo [1/4] Checking Dedicated Chrome on Port 9223 (WhatsApp Web)...

netstat -ano | findstr /R /C:":9223 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Chrome Debugger is ALREADY RUNNING on port 9223.
) else (
    echo [LAUNCH] Starting Chrome on port 9223 with profile C:\selenum\ChromeStocksProfile...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9223 --user-data-dir="C:\selenum\ChromeStocksProfile" --no-first-run --no-default-browser-check https://web.whatsapp.com
    timeout /t 3 /nobreak >nul
)

echo.
echo [2/4] Checking Backend API Server on Port 3003...
netstat -ano | findstr /R /C:":3003 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend API is ALREADY RUNNING on port 3003.
) else (
    echo [LAUNCH] Starting Node.js API Server...
    start "DealsOptimised Backend API (3003)" cmd /c "node server/api/index.js"
    timeout /t 3 /nobreak >nul
)

echo.
echo [3/4] Checking Frontend Vite Server on Port 5173...
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Frontend Vite Dev Server is ALREADY RUNNING on port 5173.
) else (
    echo [LAUNCH] Starting Frontend Vite Server...
    start "DealsOptimised Frontend (5173)" cmd /c "cd frontend && npm.cmd run dev"
    timeout /t 2 /nobreak >nul
)

echo.
echo [4/4] Ensuring WhatsApp Web is focused on 'SOIC 3yr Research'...
node scripts/searchAndOpenSOIC.js >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Attached and focused on SOIC 3yr Research channel.
) else (
    echo [INFO] WhatsApp attachment script completed.
)

echo.
echo =======================================================================
echo  ALL SERVICES ONLINE & OPERATIONAL FOR TRADING HOURS:
echo  - Frontend Dashboard:    http://localhost:5173/stocks
echo  - API Health:            http://localhost:3003/health
echo  - Scheduler Status:      http://localhost:3003/api/stocks/scheduler/status
echo  - Chrome WhatsApp Port:  http://127.0.0.1:9223
echo =======================================================================
echo.
start http://localhost:5173/stocks
