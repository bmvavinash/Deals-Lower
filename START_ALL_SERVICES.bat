@echo off
echo ========================================
echo   Starting All Services (HQN Worktree)
echo ========================================
echo.
echo Workspace: C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn
echo.

REM Stop existing Node processes
echo [1/4] Stopping existing services...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Existing services stopped
echo.

REM Start Backend API (Port 3001)
echo [2/4] Starting Backend API Server (Port 3001)...
cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn"
start "Backend API - Port 3001 (HQN)" cmd /k "cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn" && node server/api/index.js"
timeout /t 3 /nobreak >nul
echo ✅ Backend API Server started
echo.

REM Start Execution Monitor API (Port 3002)
echo [3/4] Starting Execution Monitor API (Port 3002)...
start "Execution Monitor API - Port 3002 (HQN)" cmd /k "cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn" && node services/executionMonitorAPI.js"
timeout /t 2 /nobreak >nul
echo ✅ Execution Monitor API started
echo.

REM Start Frontend (Port 3000)
echo [4/4] Starting Frontend Server (Port 3000)...
start "Frontend Server - Port 3000 (HQN)" cmd /k "cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn\frontend" && npm run dev"
echo ✅ Frontend Server starting
echo.

echo ========================================
echo   Services Started Successfully!
echo ========================================
echo.
echo Service URLs:
echo   Backend API:        http://localhost:3001
echo   Execution Monitor:  http://localhost:3002
echo   Frontend:           http://localhost:3000
echo.
echo Next Steps:
echo   1. Start Chrome Debugger: start_chrome_debug.bat
echo   2. Start Telegram Bot: node run_telegram_bot.js
echo   3. Close command windows to stop services
echo.
pause



