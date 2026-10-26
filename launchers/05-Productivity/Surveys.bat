@echo off
call "%~dp0..\_lib\launch-app.bat" survey "Surveys"
exit /b %errorlevel%
