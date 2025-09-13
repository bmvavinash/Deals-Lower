@echo off
REM Log checking commands for scheduler monitoring
REM Usage: scripts\logCommands.bat [command] [options]

set COMMAND=%1
set OPTIONS=%2

if "%COMMAND%"=="stats" (
    echo 📊 Generating scheduler statistics...
    node scripts\checkSchedulerLogs.js --hours=24
    goto :end
)

if "%COMMAND%"=="monitor" (
    echo 🔍 Starting real-time monitoring...
    node scripts\checkSchedulerLogs.js --monitor
    goto :end
)

if "%COMMAND%"=="errors" (
    echo ❌ Checking for errors in last 24 hours...
    node scripts\checkSchedulerLogs.js --hours=24 | findstr /i "error"
    goto :end
)

if "%COMMAND%"=="platform" (
    if "%OPTIONS%"=="" (
        echo 🏪 Usage: scripts\logCommands.bat platform [amazon|flipkart|ajio|myntra]
        goto :end
    )
    echo 🏪 Platform-specific statistics for %OPTIONS%...
    node scripts\checkSchedulerLogs.js --platform=%OPTIONS% --hours=24
    goto :end
)

if "%COMMAND%"=="detailed" (
    echo 📋 Detailed scheduler report...
    node scripts\checkSchedulerLogs.js --hours=48
    echo.
    echo 📁 Checking log files...
    dir logs\*.log /b
    goto :end
)

if "%COMMAND%"=="reset" (
    echo 🔄 Resetting statistics...
    node -e "const { resetStats } = require('./scripts/enhancedLogging'); resetStats();"
    goto :end
)

REM Default help
echo 📚 Available commands:
echo   stats     - Show scheduler statistics (last 24 hours)
echo   monitor   - Real-time monitoring
echo   errors    - Show errors from last 24 hours
echo   platform  - Platform-specific stats (amazon, flipkart, ajio, myntra)
echo   detailed  - Detailed report with log file info
echo   reset     - Reset statistics
echo.
echo Examples:
echo   scripts\logCommands.bat stats
echo   scripts\logCommands.bat platform amazon
echo   scripts\logCommands.bat monitor

:end



