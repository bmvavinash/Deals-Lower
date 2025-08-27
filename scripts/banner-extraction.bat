@echo off
REM Banner Extraction Automation Script for Windows
REM Usage: banner-extraction.bat [command]

setlocal enabledelayedexpansion

REM Set project directory
set PROJECT_DIR=%~dp0..
cd /d "%PROJECT_DIR%"

REM Set log file
set LOG_FILE=logs\banner-extraction.log
set TIMESTAMP=%date% %time%

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Log function
:log
echo [%TIMESTAMP%] %~1 >> "%LOG_FILE%"
echo [%TIMESTAMP%] %~1
goto :eof

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    call :log "ERROR: Node.js is not installed or not in PATH"
    exit /b 1
)

REM Get command from arguments
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=extract

REM Log start
call :log "Starting banner extraction automation..."

REM Run the appropriate command
if "%COMMAND%"=="extract" (
    call :log "Running banner extraction..."
    node scripts\automateBannerExtraction.js extract
    if errorlevel 1 (
        call :log "ERROR: Banner extraction failed"
        exit /b 1
    )
) else if "%COMMAND%"=="cleanup" (
    call :log "Running banner cleanup..."
    node scripts\automateBannerExtraction.js cleanup
) else if "%COMMAND%"=="health" (
    call :log "Running health check..."
    node scripts\automateBannerExtraction.js health
) else if "%COMMAND%"=="full" (
    call :log "Running full automation cycle..."
    node scripts\automateBannerExtraction.js full
) else if "%COMMAND%"=="help" (
    echo.
    echo Banner Extraction Automation for Windows
    echo.
    echo Usage: banner-extraction.bat [command]
    echo.
    echo Commands:
    echo   extract    Run banner extraction only
    echo   cleanup    Run banner cleanup only
    echo   health     Run health check only
    echo   full       Run full automation cycle
    echo   help       Show this help
    echo.
    echo Examples:
    echo   banner-extraction.bat extract
    echo   banner-extraction.bat full
    echo   banner-extraction.bat health
    echo.
    echo For scheduling, use Windows Task Scheduler:
    echo   1. Open Task Scheduler
    echo   2. Create Basic Task
    echo   3. Set trigger (e.g., daily at 2 AM)
    echo   4. Action: Start a program
    echo   5. Program: cmd.exe
    echo   6. Arguments: /c "cd /d C:\path\to\project ^& banner-extraction.bat extract"
    echo.
) else (
    call :log "ERROR: Unknown command '%COMMAND%'"
    call :log "Use 'banner-extraction.bat help' for usage information"
    exit /b 1
)

call :log "Banner automation completed successfully"
exit /b 0 