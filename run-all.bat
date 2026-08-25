@echo off
setlocal
set "ROOT=%~dp0"

set "PKG_MGR="
where pnpm >nul 2>&1
if not errorlevel 1 (
	set "PKG_MGR=pnpm"
) else (
	where npm >nul 2>&1
	if not errorlevel 1 (
		set "PKG_MGR=npm"
	) else (
		echo Neither pnpm nor npm found on PATH. Install Node.js and pnpm or npm.
		pause
		exit /b 1
	)
)

where python >nul 2>&1
if errorlevel 1 (
	echo python not found on PATH. Install Python and ensure it is available.
	pause
	exit /b 1
)

echo Launching RescueLink services (excluding Blockchain)...
echo Using %PKG_MGR% for Backend and Web...

REM 1. Start Backend API (port 3000)
start "RescueLink Backend" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& {Set-Location '%ROOT%Backend'; %PKG_MGR% run dev}"

REM 2. Start RescueLink AI Service (port 8000 with virtual environment active)
start "RescueLink AI" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& { $r = '%ROOT%'; Set-Location ($r + 'RescueLink AI'); if (Test-Path '.\.venv\Scripts\Activate.ps1') { & '.\.venv\Scripts\Activate.ps1'; Write-Host 'Virtual environment activated (.venv)' -ForegroundColor Green; .\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 } elseif (Test-Path ($r + '.venv\Scripts\Activate.ps1')) { & ($r + '.venv\Scripts\Activate.ps1'); Write-Host 'Root virtual environment activated' -ForegroundColor Green; python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 } else { Write-Warning 'Virtual environment (.venv) not found! Running with system python...'; python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 } }"

REM 3. Start Web Dashboard (port 5173)
start "RescueLink Web" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -Command "& {Set-Location '%ROOT%Frontend\Web\dispatcher_dashboard'; %PKG_MGR% run dev}"

REM 4. Start Mobile Terminal
start "RescueLink Mobile" powershell -NoProfile -NoExit -Command "& {Set-Location '%ROOT%Frontend\Mobile'}"

REM 5. Open Web Dashboard in browser
start /B powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'"

echo.
echo Services launched. Browser will open shortly.
exit /b 0

