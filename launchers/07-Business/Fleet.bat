@echo off
call "%~dp0..\_lib\launch-app.bat" fleet "Fleet"
exit /b %errorlevel%
