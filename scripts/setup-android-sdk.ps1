<#
.SYNOPSIS
  Installs the minimal Android SDK needed to build and run Nexity on a physical
  Android device over USB. No emulator, system images or Android Studio.

.DESCRIPTION
  - Downloads Android command-line tools into %LOCALAPPDATA%\Android\Sdk
  - Installs platform-tools (adb), the SDK platform, build-tools, NDK and CMake
    using the versions declared in android/build.gradle
  - Sets ANDROID_HOME and adds platform-tools to the user PATH
  - Requires JDK 17 (JAVA_HOME or java on PATH)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/setup-android-sdk.ps1
#>
[CmdletBinding()]
param(
  [string]$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$CmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip',
  [string]$CmakeVersion = '3.22.1'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-GradleExt([string]$content, [string]$name) {
  $m = [regex]::Match($content, "$name\s*=\s*`"?([\w\.\-]+)`"?")
  if (-not $m.Success) { throw "Could not read '$name' from android/build.gradle" }
  return $m.Groups[1].Value
}

function Resolve-JavaHome {
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { return $env:JAVA_HOME }
  $candidate = Get-ChildItem 'C:\Program Files\Microsoft', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^jdk-?17' } | Select-Object -First 1
  if ($candidate) { return $candidate.FullName }
  throw 'JDK 17 not found. Install it first: winget install --id Microsoft.OpenJDK.17 -e'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$gradle = Get-Content (Join-Path $projectRoot 'android\build.gradle') -Raw
$compileSdk = Get-GradleExt $gradle 'compileSdkVersion'
$buildTools = Get-GradleExt $gradle 'buildToolsVersion'
$ndk = Get-GradleExt $gradle 'ndkVersion'

$javaHome = Resolve-JavaHome
$env:JAVA_HOME = $javaHome
[Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')
Write-Host "JAVA_HOME    = $javaHome"
Write-Host "ANDROID_HOME = $SdkRoot"
Write-Host "Packages     : platform-tools, platforms;android-$compileSdk, build-tools;$buildTools, ndk;$ndk, cmake;$CmakeVersion"

$sdkManager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkManager)) {
  Write-Host 'Downloading Android command-line tools...'
  New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null
  $zip = Join-Path $env:TEMP 'android-cmdline-tools.zip'
  $tmp = Join-Path $env:TEMP 'android-cmdline-tools'
  Invoke-WebRequest -Uri $CmdlineToolsUrl -OutFile $zip
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $dest = Join-Path $SdkRoot 'cmdline-tools\latest'
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Move-Item (Join-Path $tmp 'cmdline-tools') $dest
  Remove-Item $zip, $tmp -Recurse -Force
}

Write-Host 'Accepting SDK licenses...'
$yes = (1..50 | ForEach-Object { 'y' }) -join "`n"
$yes | & $sdkManager --sdk_root="$SdkRoot" --licenses | Out-Null

$available = & $sdkManager --sdk_root="$SdkRoot" --list 2>$null
$platform = "platforms;android-$compileSdk"
if (-not ($available | Select-String -SimpleMatch "  $platform ")) { $platform = "platforms;android-$compileSdk.0" }

Write-Host "Installing SDK packages ($platform, ...). This can take a while..."
& $sdkManager --sdk_root="$SdkRoot" `
  'platform-tools' `
  $platform `
  "build-tools;$buildTools" `
  "ndk;$ndk" `
  "cmake;$CmakeVersion"
if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed with exit code $LASTEXITCODE" }

[Environment]::SetEnvironmentVariable('ANDROID_HOME', $SdkRoot, 'User')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$additions = @("$SdkRoot\platform-tools", "$SdkRoot\cmdline-tools\latest\bin", "$javaHome\bin")
foreach ($p in $additions) {
  if (($userPath -split ';') -notcontains $p) { $userPath = ($userPath.TrimEnd(';') + ";$p") }
}
[Environment]::SetEnvironmentVariable('Path', $userPath, 'User')

$sdkDirEscaped = $SdkRoot -replace '\\', '\\\\' -replace ':', '\:'
Set-Content -Path (Join-Path $projectRoot 'android\local.properties') -Value "sdk.dir=$sdkDirEscaped" -Encoding ascii

Write-Host ''
Write-Host 'Android SDK ready. Open a NEW terminal so PATH changes apply, then run: adb devices' -ForegroundColor Green
