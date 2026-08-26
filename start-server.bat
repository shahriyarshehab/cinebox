@echo off
title CineBox Local Server
echo ==============================================
echo   🎬 Starting CineBox Local Development Server
echo ==============================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Node.js...
    start http://localhost:3000
    node server.js
    pause
    exit /b
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting server with Python...
    start http://localhost:3000
    python server.py
    pause
    exit /b
)

echo [ERROR] Neither Node.js nor Python was detected on your system.
echo Please install Node.js or Python to run the local server.
pause
