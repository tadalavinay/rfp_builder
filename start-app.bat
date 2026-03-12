@echo off
title RFP Response Library
echo ============================================
echo   RFP Response Library - Starting Server...
echo ============================================
echo.

cd /d "%~dp0dist"

echo Server running at: http://localhost:8000
echo.
echo DO NOT CLOSE THIS WINDOW while using the app.
echo Press Ctrl+C to stop the server when done.
echo.

start http://localhost:8000

python -m http.server 8000
