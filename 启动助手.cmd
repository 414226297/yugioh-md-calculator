@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto electron_runtime
node scripts\launch.mjs
if errorlevel 1 pause
exit /b

:electron_runtime
if not exist "node_modules\electron\dist\electron.exe" goto missing_runtime
set "ELECTRON_RUN_AS_NODE=1"
"node_modules\electron\dist\electron.exe" scripts\launch.mjs
if errorlevel 1 pause
exit /b

:missing_runtime
echo Runtime not found. Install project dependencies or use the Windows x64 portable ZIP.
pause
exit /b 1
