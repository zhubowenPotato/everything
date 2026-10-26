@echo off
call "%~dp0..\_lib\launch-app.bat" sudoku "Sudoku"
exit /b %errorlevel%
