Param(
  [switch]$SkipBackend,
  [switch]$SkipWeb,
  [switch]$SkipMobile,
  [switch]$SkipAI,
  [switch]$SkipBlockchain
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$results = @()

function Add-Result {
  param(
    [string]$Suite,
    [string]$Status,
    [string]$Details
  )

  $script:results += [PSCustomObject]@{
    Suite = $Suite
    Status = $Status
    Details = $Details
  }
}

function Run-Step {
  param(
    [string]$Suite,
    [string]$Command,
    [string]$WorkingDirectory
  )

  Write-Host "`n[$Suite] $Command" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
      Add-Result -Suite $Suite -Status 'FAILED' -Details "Exit code $LASTEXITCODE"
      return $false
    }
    Add-Result -Suite $Suite -Status 'PASSED' -Details 'OK'
    return $true
  }
  catch {
    Add-Result -Suite $Suite -Status 'FAILED' -Details $_.Exception.Message
    return $false
  }
  finally {
    Pop-Location
  }
}

function Test-HttpEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 4
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
  }
  catch {
    return $false
  }
}

Write-Host "== RescueLink Master Integration Runner ==" -ForegroundColor Green

if (-not $SkipBackend) {
  Write-Host "`n--- Backend Integration Phase ---" -ForegroundColor Yellow
  Run-Step -Suite 'backend:test:security' -Command 'npm run test:security' -WorkingDirectory (Join-Path $root 'Backend') | Out-Null
  Run-Step -Suite 'backend:test:rbac' -Command 'npm run test:rbac' -WorkingDirectory (Join-Path $root 'Backend') | Out-Null
  Run-Step -Suite 'backend:test:location' -Command 'npx jest tests/location.integration.test.js --detectOpenHandles --forceExit' -WorkingDirectory (Join-Path $root 'Backend') | Out-Null

  if (Test-HttpEndpoint -Url 'http://localhost:3000/health') {
    Run-Step -Suite 'backend:test:live-api' -Command 'node tests/integration.test.js' -WorkingDirectory (Join-Path $root 'Backend') | Out-Null
  }
  else {
    Add-Result -Suite 'backend:test:live-api' -Status 'SKIPPED' -Details 'Backend not running on http://localhost:3000'
  }
}
else {
  Add-Result -Suite 'backend' -Status 'SKIPPED' -Details 'Skipped by flag'
}

if (-not $SkipWeb) {
  Write-Host "`n--- Web Integration Phase ---" -ForegroundColor Yellow
  Run-Step -Suite 'web:test' -Command 'npm test' -WorkingDirectory (Join-Path $root 'Frontend/Web/dispatcher_dashboard') | Out-Null
}
else {
  Add-Result -Suite 'web' -Status 'SKIPPED' -Details 'Skipped by flag'
}

if (-not $SkipMobile) {
  Write-Host "`n--- Mobile Integration Phase ---" -ForegroundColor Yellow
  $mobileRoot = Join-Path $root 'Frontend/Mobile'
  if (Test-Path (Join-Path $mobileRoot 'test')) {
    Run-Step -Suite 'mobile:test' -Command 'flutter test' -WorkingDirectory $mobileRoot | Out-Null
  }
  else {
    Add-Result -Suite 'mobile:test' -Status 'SKIPPED' -Details 'No Frontend/Mobile/test directory yet'
  }
}
else {
  Add-Result -Suite 'mobile' -Status 'SKIPPED' -Details 'Skipped by flag'
}

if (-not $SkipAI) {
  Write-Host "`n--- AI Integration Phase ---" -ForegroundColor Yellow
  Run-Step -Suite 'ai:test:fallback-rules' -Command 'python -m unittest discover -s "RescueLink AI/test" -p "test_fallback_rules.py"' -WorkingDirectory $root | Out-Null

  if (Test-HttpEndpoint -Url 'http://localhost:8000/health') {
    Run-Step -Suite 'ai:test:endpoints' -Command 'python "RescueLink AI/test/test_ai_endpoints.py" --base-url "http://127.0.0.1:8000"' -WorkingDirectory $root | Out-Null
  }
  else {
    Add-Result -Suite 'ai:test:endpoints' -Status 'SKIPPED' -Details 'AI service not running on http://localhost:8000'
  }
}
else {
  Add-Result -Suite 'ai' -Status 'SKIPPED' -Details 'Skipped by flag'
}

if (-not $SkipBlockchain) {
  Write-Host "`n--- Blockchain Integration Phase ---" -ForegroundColor Yellow
  if (Test-HttpEndpoint -Url 'http://localhost:8001/health') {
    Run-Step -Suite 'blockchain:test' -Command 'npm test' -WorkingDirectory (Join-Path $root 'Blockchain/tests') | Out-Null
  }
  else {
    Add-Result -Suite 'blockchain:test' -Status 'SKIPPED' -Details 'Blockchain service not running on http://localhost:8001'
  }
}
else {
  Add-Result -Suite 'blockchain' -Status 'SKIPPED' -Details 'Skipped by flag'
}

Write-Host "`n=== Integration Summary ===" -ForegroundColor Green
$results | Format-Table -AutoSize

$failedCount = ($results | Where-Object { $_.Status -like 'FAILED*' }).Count
if ($failedCount -gt 0) {
  Write-Host "`nMaster integration run completed with failures: $failedCount" -ForegroundColor Red
  exit 1
}

Write-Host "`nMaster integration run completed (no failed executed suites)." -ForegroundColor Green
exit 0
