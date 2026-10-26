@echo off
call "%~dp0..\_lib\launch-app.bat" cad "CAD"
exit /b %errorlevel%
