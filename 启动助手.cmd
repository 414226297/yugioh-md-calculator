@echo off
cd /d "%~dp0"
set "MD_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%MD_NODE%" (
  "%MD_NODE%" scripts\launch.mjs
) else (
  node scripts\launch.mjs
)
if errorlevel 1 pause
