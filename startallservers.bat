@echo off
echo ========================================
echo   Starting All Servers (HQN Worktree)
echo ========================================
echo.
echo Workspace: C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn
echo.

REM Change to the workspace directory
cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn"

REM Stop existing Node processes
echo [1/3] Stopping existing Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Existing processes stopped
echo.

REM Start Backend API Server (Port 3001)
echo [2/3] Starting Backend API Server (Port 3001)...
start "Backend API - Port 3001 (HQN)" cmd /k "cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn" && echo Starting Backend API on port 3001... && node server/api/index.js"
timeout /t 5 /nobreak >nul
echo ✅ Backend API Server started
echo.

REM Start Frontend Server (Port 5173)
echo [3/3] Starting Frontend Server (Port 5173)...
start "Frontend Server - Port 5173 (HQN)" cmd /k "cd /d "C:\Users\avina\.cursor\worktrees\DealsOptimised\hqn\frontend" && echo Starting Frontend on port 5173... && npm run dev"
timeout /t 3 /nobreak >nul
echo ✅ Frontend Server starting
echo.

echo ========================================
echo   Services Started Successfully!
echo ========================================
echo.
echo Service URLs:
echo   Backend API:  http://localhost:3001
echo   Frontend UI:  http://localhost:5173
echo.
echo Next Steps:
echo   1. Wait for both servers to fully start (check the windows)
echo   2. Open http://localhost:5173 in your browser
echo   3. Close command windows to stop services
echo.
echo Checking server status...
timeout /t 3 /nobreak >nul

REM Check if servers are running
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if %errorlevel% == 0 (
    echo ✅ Backend API (Port 3001) is LISTENING
) else (
    echo ⚠️  Backend API (Port 3001) may not be ready yet
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel% == 0 (
    echo ✅ Frontend Server (Port 5173) is LISTENING
) else (
    echo ⚠️  Frontend Server (Port 5173) may not be ready yet - wait a few more seconds
)

echo.
pause





