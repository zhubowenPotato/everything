@echo off
call "%~dp0..\_lib\launch-app.bat" expense "Expenses"
exit /b %errorlevel%
