@echo off
call "%~dp0..\_lib\launch-app.bat" field-service "Field Service"
exit /b %errorlevel%
