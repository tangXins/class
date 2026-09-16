# =====================================================================
# make-portable.ps1
# Build a single-file portable launcher with the NSIS compiler already
# cached by electron-builder (no new dependency).
#   - win-unpacked is embedded (LZMA solid) into one exe
#   - first run extracts to %LOCALAPPDATA%\ClassManager\runtime-<ver>
#   - later runs start directly (~0.7s), old runtimes are cleaned
# Script source is ASCII-only; Chinese product names come from package.json.
# =====================================================================
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $pkg.version
$product = $pkg.build.productName
$relDir = Join-Path $root 'release'
$unpacked = Join-Path $relDir 'win-unpacked'

if (-not (Test-Path $unpacked)) {
  Write-Host '[portable] release\win-unpacked not found, skipping'
  exit 0
}
$mainExe = Join-Path $unpacked ($product + '.exe')
if (-not (Test-Path $mainExe)) {
  Write-Host '[portable] main executable not found in win-unpacked, skipping'
  exit 0
}

# ---- locate the real makensis.exe from electron-builder cache ----
# NOTE: nsis-*/makensis.exe (root) is a tiny shim that does not support the
# full command set; use nsis-*/Bin/makensis.exe (the real compiler).
$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\nsis'
$makensis = $null
if (Test-Path $cache) {
  $makensis = Get-ChildItem $cache -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like '*\Bin\makensis.exe' } |
    Sort-Object FullName | Select-Object -First 1
  if (-not $makensis) {
    $makensis = Get-ChildItem $cache -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue |
      Sort-Object { $_.Length } -Descending | Select-Object -First 1
  }
}
if (-not $makensis) {
  Write-Host '[portable] makensis.exe not found in electron-builder cache, skipping'
  exit 0
}

# ---- paths passed to makensis (Unicode build accepts Chinese argv) ----
$iconPath = Join-Path $root 'build\icon.ico'
$tmpOut = "portable-$ver.exe"
$tmpOutPath = Join-Path $relDir $tmpOut
if (Test-Path $tmpOutPath) { Remove-Item $tmpOutPath -Force }

# ---- NSIS (Unicode true) requires the UTF-8 .nsi to carry a BOM ----
$nsiSrc = Join-Path $root 'scripts\portable.nsi'
$nsiTmp = Join-Path $env:TEMP 'cm-portable-build.nsi'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
$nsiText = [System.IO.File]::ReadAllText($nsiSrc, $utf8NoBom)
[System.IO.File]::WriteAllText($nsiTmp, $nsiText, $utf8Bom)

Write-Host "[portable] compiling $tmpOut with $($makensis.FullName) ..."
$start = Get-Date
Push-Location $root
try {
  & $makensis.FullName "/DSRCDIR=$unpacked" "/DVERSION=$ver" "/DOUTDIR=$relDir" "/DOUTFILE=$tmpOut" "/DICON=$iconPath" '/V1' $nsiTmp
  if ($LASTEXITCODE -ne 0) { throw "makensis failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

# ---- rename ASCII temp name to Chinese product name ----
# "bian xie ban" = portable edition, built from char codes to keep this file ASCII
$suffix = [string]([char]0x4FBF) + [string]([char]0x643A) + [string]([char]0x7248)
$finalName = "$product-$suffix-$ver.exe"
$finalPath = Join-Path $relDir $finalName
if (Test-Path $finalPath) { Remove-Item $finalPath -Force }
Rename-Item -LiteralPath $tmpOutPath -NewName $finalName

$mb = [math]::Round((Get-Item -LiteralPath $finalPath).Length / 1MB, 1)
$secs = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
Write-Host "[portable] OK -> $finalName ($mb MB, $secs s)"
