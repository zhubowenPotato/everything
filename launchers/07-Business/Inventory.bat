@echo off
call "%~dp0..\_lib\launch-app.bat" inventory "Inventory"
exit /b %errorlevel%
