@echo off
call "%~dp0..\_lib\launch-app.bat" email "Email"
exit /b %errorlevel%
