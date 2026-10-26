@echo off
call "%~dp0..\_lib\launch-app.bat" documents "Documents"
exit /b %errorlevel%
