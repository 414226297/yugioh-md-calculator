@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required for the source checkout. Use the Windows x64 portable ZIP to run without Node.js.
  pause
  exit /b 1
)
node scripts\launch.mjs
if errorlevel 1 pause
