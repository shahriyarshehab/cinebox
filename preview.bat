@echo off
title CineBox GitHub Website Preview
echo ============================================================
echo Starting Local Preview of CineBox Web Application...
echo ============================================================
cd /d "%~dp0"
start http://localhost:8000
python -m http.server 8000
pause
