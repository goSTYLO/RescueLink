@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_release.ps1" -Mode run %*
exit /b %ERRORLEVEL%
