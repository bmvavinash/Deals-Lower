@echo off
title Lowerdeal Local Daemon
echo ====================================================
echo Starting Lowerdeal Local Scraper Daemon...
echo System: %COMPUTERNAME% (%OS%)
echo ====================================================
cd /d "%~dp0"
node scripts\localDaemon.js --role all
pause
