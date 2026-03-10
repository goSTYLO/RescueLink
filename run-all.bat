@echo off
set "ROOT=%~dp0"

echo Starting RescueLink services...
echo.

start "RescueLink - Backend" cmd /k "cd /d "%ROOT%Backend" && npm run dev"
start "RescueLink - AI" cmd /k "cd /d "%ROOT%RescueLink AI" && call "%ROOT%venv\Scripts\activate.bat" && python -m uvicorn api.main:app --reload --port 8000"
start "RescueLink - Blockchain" cmd /k "cd /d "%ROOT%Blockchain" && python -m uvicorn main:app --host 0.0.0.0 --port 8001"

echo.
echo All services started in separate windows.
echo - Backend: http://localhost:3000
echo - AI: http://localhost:8000
echo - Blockchain: http://localhost:8001
echo.
pause
