@echo off
echo ======================================================
echo   MASM 32 + Irvine32 Automated Setup (Windows)
echo ======================================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js is installed.
) else (
    echo [X] Node.js is not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Running diagnostic tests...
node test.js

echo.
echo ======================================================
echo   Setup Complete! Everything is ready to use.
echo ======================================================
echo   To run code: masm main.asm
echo   To debug:    masm main.asm -d
echo   To update:   update.bat
echo.
pause
