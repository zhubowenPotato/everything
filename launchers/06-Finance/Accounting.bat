@echo off
call "%~dp0..\_lib\launch-app.bat" accounting "Accounting"
exit /b %errorlevel%
