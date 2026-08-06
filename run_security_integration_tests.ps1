Param(
  [switch]$SkipBackend,
  [switch]$SkipAI
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== RescueLink Security Test Runner ==" -ForegroundColor Cyan

if (-not $SkipBackend) {
  Write-Host "[1/2] Running backend security tests..." -ForegroundColor Yellow
  Set-Location (Join-Path $root 'Backend')
  npm test -- tests/aiService.test.js tests/fileScanService.test.js tests/uploadMiddleware.integration.test.js tests/incidentController.security.test.js
}

if (-not $SkipAI) {
  Write-Host "[2/2] Running AI fallback unit tests..." -ForegroundColor Yellow
  Set-Location $root
  python -m unittest discover -s "RescueLink AI/test" -p "test_fallback_rules.py"
}

Set-Location $root
Write-Host "All selected security tests completed." -ForegroundColor Green
