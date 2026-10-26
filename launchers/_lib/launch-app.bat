@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "APP_DIR=%~1"
set "APP_NAME=%~2"
if not defined APP_DIR goto :usage
if not defined APP_NAME set "APP_NAME=%APP_DIR%"
for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
set "TARGET=%ROOT%\src\%APP_DIR%"
title Everything - %APP_NAME%
cd /d "%TARGET%"
if errorlevel 1 goto :missing

where node >nul 2>nul
if errorlevel 1 goto :nonode
where npm >nul 2>nul
if errorlevel 1 goto :nonpm
if not exist "package.json" goto :missing
if defined EVERYTHING_LAUNCH_DRY_RUN (
  echo [DRY RUN] %APP_NAME% -^> %TARGET%
  exit /b 0
)

if not exist "node_modules" (
  echo.
  echo Installing dependencies for %APP_NAME%...
  echo This is only needed the first time.
  echo.
  if exist "package-lock.json" (
    call npm ci --no-audit --no-fund
  ) else (
    call npm install --no-audit --no-fund
  )
  if errorlevel 1 goto :installfail
)

echo.
echo Starting %APP_NAME%...
echo Folder: %TARGET%
echo The browser will open automatically. Press Ctrl+C in this window to stop.
echo.
set "OPEN_OPTION="
if not defined EVERYTHING_LAUNCH_NO_BROWSER set "OPEN_OPTION=-- --open"
set "PORT_OPTION="
if defined EVERYTHING_LAUNCH_PORT set "PORT_OPTION=--port %EVERYTHING_LAUNCH_PORT%"
if defined EVERYTHING_LAUNCH_PORT echo Port: %EVERYTHING_LAUNCH_PORT%
call npm run dev %OPEN_OPTION% %PORT_OPTION%
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo Development server exited with code %EXITCODE%.
  if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
)
exit /b %EXITCODE%

:usage
echo Usage: launch-app.bat ^<src-folder^> ^<display-name^>
if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
exit /b 2

:missing
echo.
echo [ERROR] App folder or package.json not found:
echo   %TARGET%
echo.
if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
exit /b 1

:nonode
echo.
echo [ERROR] Node.js was not found.
echo Install Node.js 22.12 or newer, then run this file again.
echo.
if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
exit /b 1

:nonpm
echo.
echo [ERROR] npm was not found.
echo Install Node.js 22.12 or newer, then run this file again.
echo.
if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
exit /b 1

:installfail
echo.
echo [ERROR] Dependency installation failed for %APP_NAME%.
echo.
if not defined EVERYTHING_LAUNCH_NO_PAUSE pause
exit /b 1
