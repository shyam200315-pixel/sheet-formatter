@echo off
title Sheet Formatter Backend API (Port 3000)
cd /d "%~dp0backend"
echo ========================================================
echo   Sheet Formatter Backend API Server (Port 3000)
echo   Connecting to Neon Cloud Database...
echo ========================================================
node dist/main.js
pause

