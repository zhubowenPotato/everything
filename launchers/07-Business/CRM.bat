@echo off
call "%~dp0..\_lib\launch-app.bat" crm "CRM"
exit /b %errorlevel%
