$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

$targetFolder = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
$parentFolder = "$env:LOCALAPPDATA\Android\Sdk"
$zipFile = Join-Path $env:TEMP 'platform-tools.zip'
$url = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'

Write-Host 'Downloading Android platform-tools (adb)...'
New-Item -ItemType Directory -Force -Path $parentFolder | Out-Null
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host 'Extracting platform-tools...'
Expand-Archive -Path $zipFile -DestinationPath $parentFolder -Force
Remove-Item $zipFile -Force

$adbExe = Join-Path $targetFolder 'adb.exe'
if (Test-Path $adbExe) {
    Write-Host "ADB installed successfully at: $adbExe" -ForegroundColor Green
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($userPath -split ';' -notcontains $targetFolder) {
        $newPath = $userPath.TrimEnd(';') + ";$targetFolder"
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Host "Added $targetFolder to User PATH." -ForegroundColor Green
    }
} else {
    Write-Error "Failed to find adb.exe after extraction."
}
