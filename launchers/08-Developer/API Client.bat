@echo off
call "%~dp0..\_lib\launch-app.bat" api-client "API Client"
exit /b %errorlevel%
