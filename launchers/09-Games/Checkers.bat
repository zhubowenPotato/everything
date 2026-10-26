@echo off
call "%~dp0..\_lib\launch-app.bat" checkers "Checkers"
exit /b %errorlevel%
