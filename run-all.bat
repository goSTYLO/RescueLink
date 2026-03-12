@echo off
set "ROOT=%~dp0"

where code >nul 2>&1
if errorlevel 1 (
	echo VS Code CLI not found on PATH.
	echo Open this workspace in VS Code and run:
	echo   Terminal ^> Run Task ^> Run All Services
	pause
	exit /b 1
)

echo Opening workspace and triggering Run All Services in VS Code...
code --reuse-window "%ROOT%" --command workbench.action.tasks.build >nul 2>&1

if errorlevel 1 (
	echo.
	echo VS Code opened, but automatic task start did not complete.
	echo Run one of these inside VS Code:
	echo   Ctrl+Shift+B
	echo   Terminal ^> Run Task ^> Run All Services
	pause
	exit /b 1
)

echo Services should start in integrated VS Code terminals.
echo If they do not, run Ctrl+Shift+B inside VS Code.

echo Opening Mobile terminal...
start "RescueLink Mobile" powershell -NoProfile -NoExit -Command "& {Set-Location '%ROOT%Frontend\Mobile'; Write-Host 'Mobile terminal ready. Run: flutter run' -ForegroundColor Cyan}"

exit /b 0
