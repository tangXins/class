# Green/portable ZIP builder: compress release\win-unpacked into a ZIP.
# Why not the single-file portable EXE: it self-extracts ~90MB to TEMP on
# EVERY launch (13~30s). The ZIP is extracted once; later launches take ~0.7s.
# The .portable marker makes the main process store data next to the exe.
# Note: keep this file ASCII-only (PS 5.1 reads BOM-less scripts as ANSI);
# Chinese names are read from package.json (UTF-8) or built from char codes.
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $root 'release'
$pkg = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$topDirName = $pkg.build.productName
$version = $pkg.version
$suffix = -join ([char[]](0x7EFF, 0x8272, 0x514D, 0x5B89, 0x88C5))  # green-no-install
$unpacked = Join-Path $releaseDir 'win-unpacked'
$outZip = Join-Path $releaseDir ("{0}-{1}-{2}.zip" -f $topDirName, $suffix, $version)

if (-not (Test-Path (Join-Path $unpacked "$topDirName.exe"))) {
  Write-Error "win-unpacked not found, run electron-builder first"
  exit 1
}

# 1. portable marker (content is irrelevant; main.js only checks existence)
[System.IO.File]::WriteAllText((Join-Path $unpacked '.portable'), 'portable marker', [System.Text.UTF8Encoding]::new($false))

# 2. junction so the ZIP's top folder is the product name, not "win-unpacked"
$junction = Join-Path $releaseDir $topDirName
if (Test-Path -LiteralPath $junction) { [System.IO.Directory]::Delete($junction, $false) }
New-Item -ItemType Junction -Path $junction -Target $unpacked | Out-Null

try {
  if (Test-Path $outZip) { Remove-Item $outZip -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $junction, $outZip,
    [System.IO.Compression.CompressionLevel]::Optimal, $true
  )
} finally {
  if (Test-Path -LiteralPath $junction) { [System.IO.Directory]::Delete($junction, $false) }
}

$sizeMB = [math]::Round((Get-Item $outZip).Length / 1MB, 1)
Write-Host ("[green-zip] done: {0} ({1} MB)" -f (Split-Path $outZip -Leaf), $sizeMB)
