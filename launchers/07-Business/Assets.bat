@echo off
call "%~dp0..\_lib\launch-app.bat" assets "Assets"
exit /b %errorlevel%
