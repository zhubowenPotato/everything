@echo off
call "%~dp0..\_lib\launch-app.bat" time-tracking "Time Tracking"
exit /b %errorlevel%
