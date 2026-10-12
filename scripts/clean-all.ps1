$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "1. Cleaning Android build artifacts (gradlew clean)..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat clean
Set-Location ..

Write-Host "2. Clearing Metro, Haste & Babel caches..." -ForegroundColor Yellow
Remove-Item -Path "$env:TEMP\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\haste-map-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "android\.gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "android\app\build" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "3. Uninstalled old app from connected ADB devices..." -ForegroundColor Yellow
adb uninstall com.nexity.app 2>$null

Write-Host "`nAll caches, old builds, and artifacts have been completely cleaned!" -ForegroundColor Green
