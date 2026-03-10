@echo off
title Video Converter Pro
echo.
echo  ========================================
echo   Video Converter Pro - Starting...
echo  ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo  Installing dependencies...
    echo.
    call npm install
    echo.
)

:: Start the application
echo  Launching application...
call npx electron .
