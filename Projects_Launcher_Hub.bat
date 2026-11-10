@echo off
title DealsOptimised - Multi-Project Command Hub
color 0B

:: ============================================================================
:: CENTRAL PROJECT PATHS CONFIG (Add/Edit All Your Projects in One Place)
:: ============================================================================
set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE_9222=C:\selenum\ChromeProfile"
set "PROFILE_9223=C:\selenum\ChromeStocksProfile"

set "PROJ_STOCKS_DIR=C:\Users\anila\.gemini\antigravity\worktrees\DealsOptimised\stocks_telegram_insights_extraction"
set "PROJ_DEALS_DIR=C:\Users\anila\DealsOptimised"
set "PROJ_AFFILIATE_DIR=C:\Users\anila\Projects\Affiliate"
set "PROJ_FACELESS_DIR=C:\Users\anila\Projects\Faceless"

if /I "%~1"=="stocks-all" goto :opt_stocks_all
if /I "%~1"=="9223" goto :opt_chrome_9223
if /I "%~1"=="9222" goto :opt_chrome_9222
if /I "%~1"=="api" goto :opt_stocks_api
if /I "%~1"=="ui" goto :opt_stocks_ui

:menu
cls
echo ============================================================================
echo                  UNIFIED MULTI-PROJECT LAUNCHER HUB
echo ============================================================================
echo   1. Start Stocks / Equity API Server       (Port 3003)
echo   2. Start Chrome 9223 (WhatsApp + Sheets)  (Profile: ChromeStocksProfile)
echo   3. Start Stocks Frontend UI               (Port 5173)
echo   4. Start FULL Market Stack (Chrome 9223 + API 3003 + Frontend 5173)
echo   --------------------------------------------------------------------------
echo   5. Start Chrome 9222 (Deals Automation)   (Profile: ChromeProfile)
echo   6. Start DealsOptimised Core Engine       (node index)
echo   7. Start Affiliate Frontend App           (C:\Users\anila\Projects\Affiliate)
echo   8. Open Faceless Project Shell            (C:\Users\anila\Projects\Faceless)
echo   0. Exit
echo ============================================================================
set /p "choice=Select option [0-8]: "

if "%choice%"=="1" goto :opt_stocks_api
if "%choice%"=="2" goto :opt_chrome_9223
if "%choice%"=="3" goto :opt_stocks_ui
if "%choice%"=="4" goto :opt_stocks_all
if "%choice%"=="5" goto :opt_chrome_9222
if "%choice%"=="6" goto :opt_deals_index
if "%choice%"=="7" goto :opt_affiliate
if "%choice%"=="8" goto :opt_faceless
if "%choice%"=="0" exit /b 0
goto :menu

:opt_chrome_9223
if not exist "%PROFILE_9223%" mkdir "%PROFILE_9223%"
start "Chrome 9223 (Stocks)" "%CHROME_EXE%" ^
  --remote-debugging-port=9223 ^
  --user-data-dir="%PROFILE_9223%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-background-timer-throttling ^
  --disable-backgrounding-occluded-windows ^
  --disable-renderer-backgrounding ^
  "https://web.whatsapp.com" ^
  "https://docs.google.com/spreadsheets/d/1fCXMjJSxZp8chU8q2vy94AQCEBRKtCvxo2dwJ_L6_RM/edit#gid=1944936862"
if not "%~1"=="" exit /b 0
echo Chrome 9223 started with WhatsApp + Google Sheets tabs.
timeout /t 2 >nul
goto :menu

:opt_stocks_api
start "Stocks API Server (3003)" cmd /k "cd /d "%PROJ_STOCKS_DIR%" && node server/api/index.js"
if not "%~1"=="" exit /b 0
goto :menu

:opt_stocks_ui
start "Stocks Frontend (5173)" cmd /k "cd /d "%PROJ_STOCKS_DIR%\frontend" && npm run dev"
if not "%~1"=="" exit /b 0
goto :menu

:opt_stocks_all
call :opt_chrome_9223 quiet
timeout /t 3 /nobreak >nul
call :opt_stocks_api quiet
timeout /t 2 /nobreak >nul
call :opt_stocks_ui quiet
if not "%~1"=="" exit /b 0
echo Full Market Stack launched! Dashboard: http://localhost:5173/stocks/equity
pause
goto :menu

:opt_chrome_9222
if not exist "%PROFILE_9222%" mkdir "%PROFILE_9222%"
start "Chrome 9222 (Deals)" "%CHROME_EXE%" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%PROFILE_9222%" ^
  --no-first-run ^
  --no-default-browser-check
goto :menu

:opt_deals_index
start "DealsOptimised (node index)" cmd /k "cd /d "%PROJ_DEALS_DIR%" && node index"
goto :menu

:opt_affiliate
start "Affiliate React App" cmd /k "cd /d "%PROJ_AFFILIATE_DIR%" && npm start"
goto :menu

:opt_faceless
start "Faceless Workspace" cmd /k "cd /d "%PROJ_FACELESS_DIR%" && dir"
goto :menu
