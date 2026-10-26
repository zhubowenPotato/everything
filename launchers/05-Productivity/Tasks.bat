@echo off
call "%~dp0..\_lib\launch-app.bat" tasks "Tasks"
exit /b %errorlevel%
