@echo off
call "%~dp0..\_lib\launch-app.bat" signatures "Signatures"
exit /b %errorlevel%
