@echo off
REM Batch file to run bulk updates immediately on Windows
REM This script provides easy access to common bulk update operations

echo ==========================================
echo    Immediate Bulk Update Runner (Windows)
echo ==========================================
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Change to the script directory
cd /d "%~dp0"

REM Check if the main script exists
if not exist "runBulkUpdatesNow.js" (
    echo ERROR: runBulkUpdatesNow.js not found in current directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

:MENU
echo ==========================================
echo    Bulk Update Options
echo ==========================================
echo.
echo 1. Run ALL platforms (Full bulk update)
echo 2. Run Amazon only
echo 3. Run Flipkart only
echo 4. Run Myntra only
echo 5. Run Ajio only
echo 6. Run Amazon Electronics only
echo 7. Run Amazon Fashion only
echo 8. Run Amazon Home & Kitchen only
echo 9. Custom platform and category
echo 10. Dry run (show what would be executed)
echo 11. Help
echo 0. Exit
echo.
set /p choice="Enter your choice (0-11): "

if "%choice%"=="1" goto RUN_ALL
if "%choice%"=="2" goto RUN_AMAZON
if "%choice%"=="3" goto RUN_FLIPKART
if "%choice%"=="4" goto RUN_MYNTRA
if "%choice%"=="5" goto RUN_AJIO
if "%choice%"=="6" goto RUN_AMAZON_ELECTRONICS
if "%choice%"=="7" goto RUN_AMAZON_FASHION
if "%choice%"=="8" goto RUN_AMAZON_HOME
if "%choice%"=="9" goto RUN_CUSTOM
if "%choice%"=="10" goto RUN_DRY
if "%choice%"=="11" goto RUN_HELP
if "%choice%"=="0" goto EXIT

echo Invalid choice. Please try again.
echo.
goto MENU

:RUN_ALL
echo.
echo Running ALL platforms bulk update...
echo This may take a long time (1-3 hours depending on data volume)
echo.
set /p confirm="Are you sure? (y/N): "
if /i not "%confirm%"=="y" goto MENU
node runBulkUpdatesNow.js
goto END

:RUN_AMAZON
echo.
echo Running Amazon bulk update...
node runBulkUpdatesNow.js amazon
goto END

:RUN_FLIPKART
echo.
echo Running Flipkart bulk update...
node runBulkUpdatesNow.js flipkart
goto END

:RUN_MYNTRA
echo.
echo Running Myntra bulk update...
node runBulkUpdatesNow.js myntra
goto END

:RUN_AJIO
echo.
echo Running Ajio bulk update...
node runBulkUpdatesNow.js ajio
goto END

:RUN_AMAZON_ELECTRONICS
echo.
echo Running Amazon Electronics bulk update...
node runBulkUpdatesNow.js amazon electronics
goto END

:RUN_AMAZON_FASHION
echo.
echo Running Amazon Fashion bulk update...
node runBulkUpdatesNow.js amazon fashion
goto END

:RUN_AMAZON_HOME
echo.
echo Running Amazon Home & Kitchen bulk update...
node runBulkUpdatesNow.js amazon home-kitchen
goto END

:RUN_CUSTOM
echo.
echo Custom bulk update options:
echo.
set /p platform="Enter platform (amazon, flipkart, myntra, ajio): "
set /p category="Enter category (or leave blank for all categories): "
set /p targetdb="Enter target database (deals, productdeals, test) [deals]: "
set /p sourcetype="Enter source type (website, telegram, api) [website]: "

if "%targetdb%"=="" set targetdb=deals
if "%sourcetype%"=="" set sourcetype=website

if "%category%"=="" (
    echo.
    echo Running %platform% bulk update...
    node runBulkUpdatesNow.js %platform% --target-db %targetdb% --source-type %sourcetype%
) else (
    echo.
    echo Running %platform% %category% bulk update...
    node runBulkUpdatesNow.js %platform% %category% --target-db %targetdb% --source-type %sourcetype%
)
goto END

:RUN_DRY
echo.
echo Running dry run for Amazon...
node runBulkUpdatesNow.js --dry-run amazon
echo.
echo Running dry run for all platforms...
node runBulkUpdatesNow.js --dry-run
goto END

:RUN_HELP
echo.
node runBulkUpdatesNow.js --help
echo.
goto MENU

:END
echo.
echo ==========================================
echo    Operation completed
echo ==========================================
echo.
set /p again="Run another operation? (y/N): "
if /i "%again%"=="y" goto MENU

:EXIT
echo.
echo Goodbye!
pause


