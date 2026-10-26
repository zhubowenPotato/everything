@echo off
call "%~dp0..\_lib\launch-app.bat" projects "Projects"
exit /b %errorlevel%
