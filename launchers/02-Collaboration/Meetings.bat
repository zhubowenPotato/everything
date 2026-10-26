@echo off
call "%~dp0..\_lib\launch-app.bat" meetings "Meetings"
exit /b %errorlevel%
