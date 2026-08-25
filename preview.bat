@echo off
title DhakaFlix GitHub Website Preview
echo ============================================================
echo Starting Local Preview of your GitHub Website...
echo ============================================================
cd /d "%~dp0"
start http://localhost:8000
python -m http.server 8000
pause
