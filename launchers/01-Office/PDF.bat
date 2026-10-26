@echo off
call "%~dp0..\_lib\launch-app.bat" pdf "PDF"
exit /b %errorlevel%
