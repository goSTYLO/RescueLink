# Install Android SDK platform-tools (ADB) so Flutter can detect your phone
# Run in PowerShell (right-click -> Run with PowerShell or in terminal: .\install_android_tools.ps1)

$sdkRoot = "$env:LOCALAPPDATA\Android\sdk"
$ptZip = "$env:TEMP\platform-tools-latest-windows.zip"
$ptUrl = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"

Write-Host "Downloading Android platform-tools (ADB)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ptUrl -OutFile $ptZip -UseBasicParsing

Write-Host "Extracting to $sdkRoot..." -ForegroundColor Cyan
if (-not (Test-Path $sdkRoot)) { New-Item -ItemType Directory -Path $sdkRoot -Force }
Expand-Archive -Path $ptZip -DestinationPath $sdkRoot -Force

$platformTools = "$sdkRoot\platform-tools"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notmatch [regex]::Escape($platformTools)) {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$platformTools", "User")
    Write-Host "Added platform-tools to PATH." -ForegroundColor Green
}

Remove-Item $ptZip -Force -ErrorAction SilentlyContinue
Write-Host "Done. Close and reopen your terminal, then run: adb devices" -ForegroundColor Green
Write-Host "Connect your phone via USB (USB debugging on), allow the prompt on phone." -ForegroundColor Yellow
