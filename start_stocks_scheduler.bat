@echo off
title Stocks Master Scheduler (Port 9223)
echo ===============================================================
echo     Starting Stocks Master Scheduler Daemon
echo ===============================================================
echo  Port 9223: WhatsApp (every 3m) & Google Sheets (every 15m)
echo  Live CMP: Refreshed every 2m during market hours
echo  Telegram: Ingestion listener active 24/7 for reposted trades
echo ===============================================================
echo.

cd /d "%~dp0"
node scripts\runStocksScheduler.js
pause
