# Copy the built Android APK to release/ with a versioned Chinese name.
# Kept ASCII-only (PS 5.1 reads BOM-less scripts as ANSI); the Chinese
# product name comes from package.json (UTF-8).
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$productName = $pkg.build.productName
$version = $pkg.version
$releaseDir = Join-Path $root 'release'

$debugApk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
$releaseApk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'

if (-not (Test-Path $releaseDir)) {
  New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

$copied = 0
foreach ($apk in @($debugApk, $releaseApk)) {
  if (-not (Test-Path $apk)) { continue }
  $variant = if ($apk -like '*debug*') { 'debug' } else { 'release' }
  # release variant keeps app-release.apk; debug gets the friendly product name
  if ($variant -eq 'debug') {
    $destName = "{0}-{1}.apk" -f $productName, $version
  } else {
    $destName = "{0}-{1}-{2}.apk" -f $productName, $version, $variant
  }
  $dest = Join-Path $releaseDir $destName
  if (Test-Path $dest) { Remove-Item $dest -Force }
  Copy-Item $apk $dest -Force
  $sizeMB = [math]::Round((Get-Item $dest).Length / 1MB, 1)
  Write-Host ("[copy-apk] {0} -> release/{1} ({2} MB)" -f (Split-Path $apk -Leaf), $destName, $sizeMB)
  $copied++
}

if ($copied -eq 0) {
  Write-Host "[copy-apk] no APK found under android/app/build/outputs/apk/ - run gradlew assembleDebug first"
  exit 1
}
