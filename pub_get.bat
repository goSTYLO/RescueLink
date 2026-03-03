@echo off
set "PATH=C:\Program Files\Git\bin;C:\flutter\bin;%PATH%"
cd /d "%~dp0Frontend\Mobile"
flutter pub get
pause
