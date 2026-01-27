# RescueLink AI - Microphone Testing Commands (PowerShell)
# Version: 2.1.1
# Use these commands to test the microphone recording and auto-classification features

Write-Host "=================================================="
Write-Host "RescueLink AI - Microphone Testing (PowerShell)" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""

# Check if API is running
Write-Host "Checking if API is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ API is running on http://localhost:8000" -ForegroundColor Green
} catch {
    Write-Host "❌ API is not running. Start it with:" -ForegroundColor Red
    Write-Host "   uvicorn api.main:app --reload --port 8000"
    exit 1
}

Write-Host ""
Write-Host "=================================================="
Write-Host "TEST 1: Health Check" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

Write-Host "=================================================="
Write-Host "TEST 2: Transcribe from Microphone (15 seconds)" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Write-Host "🎤 Starting 15-second microphone recording..." -ForegroundColor Yellow
Write-Host "Speak into your microphone now!"
Write-Host ""

$body = @{
    duration_seconds = 15
    sample_rate = 16000
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/v1/transcribe-mic" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json

Write-Host ""

Write-Host "=================================================="
Write-Host "TEST 3: Record + Auto-Classify (20 seconds)" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Write-Host "🎤 Starting 20-second microphone recording..." -ForegroundColor Yellow
Write-Host "Describe an emergency situation!"
Write-Host ""

$body = @{
    duration_seconds = 20
    sample_rate = 16000
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/v1/classify-mic" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json

Write-Host ""

Write-Host "=================================================="
Write-Host "TEST 4: Check API Statistics" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Invoke-WebRequest -Uri "http://localhost:8000/v1/audio/stats" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
Write-Host ""

Write-Host "=================================================="
Write-Host "✅ Testing complete!" -ForegroundColor Green
Write-Host "=================================================="
