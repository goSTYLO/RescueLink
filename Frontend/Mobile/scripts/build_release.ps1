# Sync version from pubspec.yaml, then flutter build/run --release with --build-name and --build-number.
param(
    [ValidateSet('apk', 'appbundle', 'run')]
    [string]$Mode = 'apk'
)

$MobileRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $MobileRoot

$versionLine = & (Join-Path $PSScriptRoot "sync_app_version.ps1") -MobileRoot $MobileRoot
if (-not $versionLine) {
    Write-Error "sync_app_version.ps1 did not return a version line"
    exit 1
}
$parts = $versionLine -split '\s+', 2
$buildName = $parts[0]
$buildNumber = if ($parts.Length -gt 1) { $parts[1] } else { '1' }

function Get-SafeFilePart([string]$value) {
    return ($value -replace '[\\/:*?"<>|]', '_')
}

$artifactBase = "RescueLink_App_$(Get-SafeFilePart $buildName)_$(Get-SafeFilePart $buildNumber)"

Write-Host "Version: $buildName (build $buildNumber)"

flutter pub get
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$common = @(
    '--release',
    "--build-name=$buildName",
    "--build-number=$buildNumber"
)

switch ($Mode) {
    'apk' {
        flutter build apk @common
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        $outDir = Join-Path $MobileRoot "build\app\outputs\flutter-apk"
        $named = Join-Path $outDir "$artifactBase.apk"
        if (Test-Path $named) {
            Write-Host "APK: $named"
        } else {
            $src = Join-Path $outDir "app-release.apk"
            if (-not (Test-Path $src)) {
                Write-Error "Expected APK not found in $outDir"
                exit 1
            }
            Move-Item -LiteralPath $src -Destination $named -Force
            Write-Host "APK: $named"
        }
    }
    'appbundle' {
        flutter build appbundle @common
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        $outDir = Join-Path $MobileRoot "build\app\outputs\bundle\release"
        $src = Join-Path $outDir "app-release.aab"
        $dest = Join-Path $outDir "$artifactBase.aab"
        if (-not (Test-Path $src)) {
            Write-Error "Expected App Bundle not found: $src"
            exit 1
        }
        Move-Item -LiteralPath $src -Destination $dest -Force
        Write-Host "AAB: $dest"
    }
    'run' {
        flutter run @common
    }
}

exit $LASTEXITCODE
