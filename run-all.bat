@echo off
setlocal
set "ROOT=%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
	echo npm not found on PATH. Install Node.js and ensure npm is available.
	pause
	exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
	echo python not found on PATH. Install Python and ensure it is available.
	pause
	exit /b 1
)

echo Launching RescueLink services...

start "RescueLink Backend" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& {Set-Location '%ROOT%Backend'; npm run dev}"
REM Both RescueLink AI and Blockchain use the shared root .venv
start "RescueLink AI" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& { $r = '%ROOT%'; if (Test-Path ($r + '.venv\Scripts\Activate.ps1')) { & ($r + '.venv\Scripts\Activate.ps1') }; Set-Location ($r + 'RescueLink AI'); python -m uvicorn api.main:app --reload --port 8000 }"
start "RescueLink Blockchain" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& { $r = '%ROOT%'; if (Test-Path ($r + '.venv\Scripts\Activate.ps1')) { & ($r + '.venv\Scripts\Activate.ps1') }; Set-Location ($r + 'Blockchain'); python -m uvicorn main:app --host 0.0.0.0 --port 8001 }"
start "RescueLink Web" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& {Set-Location '%ROOT%Frontend\Web\dispatcher_dashboard'; npm run dev}"
start "RescueLink Mobile" powershell -NoProfile -NoExit -Command "& {Set-Location '%ROOT%Frontend\Mobile'}"

start /B powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'"

echo.
echo Services launched. Browser will open shortly.
exit /b 0
