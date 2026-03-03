# Run this in PowerShell: .\pub_get.ps1
$env:Path = "C:\Program Files\Git\bin;C:\flutter\bin;" + $env:Path
& "C:\flutter\bin\flutter.bat" pub get
