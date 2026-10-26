@echo off
call "%~dp0..\_lib\launch-app.bat" property-management "Property Management"
exit /b %errorlevel%
