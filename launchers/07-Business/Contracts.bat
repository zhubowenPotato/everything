@echo off
call "%~dp0..\_lib\launch-app.bat" contracts "Contracts"
exit /b %errorlevel%
