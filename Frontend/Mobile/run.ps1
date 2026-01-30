Set-Location $PSScriptRoot
Write-Host "Running Flutter app from: $PSScriptRoot" -ForegroundColor Green
flutter pub get
if ($LASTEXITCODE -eq 0) {
    flutter run
} else {
    Write-Host "Error: flutter pub get failed. Make sure Flutter is installed and in your PATH." -ForegroundColor Red
    pause
}
