@echo off
echo Starting Frontend Dashboard System...
echo.

echo [1/2] Starting API Server on port 3001...
start "API Server" cmd /k "node server/api/index.js"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend on port 3000...
cd frontend
start "Frontend Dev Server" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo System Started!
echo ========================================
echo Frontend: http://localhost:3000
echo API: http://localhost:3001
echo.
echo Press any key to exit this window...
pause >nul


















