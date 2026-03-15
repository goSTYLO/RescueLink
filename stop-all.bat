@echo off
setlocal
set "ROOT=%~dp0"

echo Stopping RescueLink services...

REM Close service windows by title
taskkill /FI "WINDOWTITLE eq RescueLink Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RescueLink AI" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RescueLink Blockchain" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RescueLink Web" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RescueLink Mobile" /F >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = [System.IO.Path]::GetFullPath('%ROOT%'); $ports = @(3000, 5173, 8000, 8001); $allProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue); $workspacePids = @($allProcesses | Where-Object { $_.Name -match '^(python|node|dart|flutter)(\.exe)?$' -and $_.CommandLine -like ('*' + $root + '*') } | Select-Object -ExpandProperty ProcessId -Unique); $portPids = @(Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); $targetPids = New-Object System.Collections.Generic.HashSet[int]; foreach ($pidValue in ($workspacePids + $portPids)) { if ($pidValue) { [void]$targetPids.Add([int]$pidValue) } }; $changed = $true; while ($changed) { $changed = $false; foreach ($process in $allProcesses) { if ($targetPids.Contains([int]$process.ParentProcessId) -and -not $targetPids.Contains([int]$process.ProcessId)) { [void]$targetPids.Add([int]$process.ProcessId); $changed = $true } } }; $pids = @($targetPids | Sort-Object); if (-not $pids -or $pids.Count -eq 0) { Write-Host 'No running RescueLink service processes found.'; exit 0 }; foreach ($pidValue in $pids) { $processName = $null; try { $processName = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pidValue) -ErrorAction Stop).Name } catch { $processName = '' }; cmd /c "taskkill /PID $pidValue /T /F" > $null 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host ('Stopped PID {0} ({1})' -f $pidValue, $processName) } elseif ([string]::IsNullOrWhiteSpace($processName)) { Write-Host ('Skipped PID {0} (already exited)' -f $pidValue) } else { Write-Host ('Failed to stop PID {0} ({1})' -f $pidValue, $processName) } }"

echo Done.
exit /b 0