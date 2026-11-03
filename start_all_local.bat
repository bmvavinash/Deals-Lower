@echo off
title Lowerdeal Local Development Environment
echo ====================================================
echo Starting Lowerdeal Local Servers...
echo 1. Deals API Server (Port 3003)
echo 2. Deals Dashboard UI (Port 5173)
echo 3. Local Scraper Daemon (commandsQueue runner)
echo ====================================================

cd /d "%~dp0"

echo Starting Deals API Server on Port 3003...
start "Deals API Server (3003)" cmd /k "node server\api\index.js"

timeout /t 3 /nobreak >nul

echo Starting Deals Dashboard UI on Port 5173...
start "Deals Dashboard UI (5173)" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Local Scraper Daemon...
start "Local Scraper Daemon" cmd /k "node scripts\localDaemon.js --role all"

echo ====================================================
echo All local servers launched in separate windows!
echo - Dashboard: http://localhost:5173
echo - API Server: http://localhost:3003
echo ====================================================
pause
