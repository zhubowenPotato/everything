@echo off
call "%~dp0..\_lib\launch-app.bat" invoicing "Invoicing"
exit /b %errorlevel%
