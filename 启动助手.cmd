@echo off
setlocal
pushd "%~dp0" || exit /b 1

if not exist "dist\desktop\main.js" (
    echo Build not found. Run pnpm run build first.
    goto failed
)

set "electron=node_modules\electron\dist\electron.exe"
if exist "%electron%" goto launch

rem pnpm junctions can still point to the old path after moving this folder.
set "electron="
for /d %%D in ("node_modules\.pnpm\electron@*") do (
    if exist "%%~D\node_modules\electron\dist\electron.exe" (
        if defined electron goto missing_runtime
        set "electron=%%~D\node_modules\electron\dist\electron.exe"
    )
)
if not defined electron goto missing_runtime

:launch
set "ELECTRON_RUN_AS_NODE="
set "MD_TEST_MODE="
start "" "%electron%" .
if errorlevel 1 (
    echo Electron could not start.
    goto failed
)
popd
exit /b 0

:missing_runtime
echo Electron runtime is missing or ambiguous. Reinstall dependencies or run the portable EXE.

:failed
popd
pause
exit /b 1
