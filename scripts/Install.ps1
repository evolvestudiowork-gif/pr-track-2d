[CmdletBinding()]
param([string]$PythonPath = 'python')
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $packageRoot 'extension'
if (-not (Test-Path -LiteralPath (Join-Path $source 'CSXS\manifest.xml'))) {
    throw 'Khong tim thay extension. Hay giai nen day du goi PR Track truoc khi cai.'
}
Write-Host 'PR Track 2D - Premiere Pro 2026 / Windows' -ForegroundColor Green
$bundledEngine = Join-Path $source 'runtime\PRTrackEngine.exe'
$resolvedPython = $null
if (Test-Path -LiteralPath $bundledEngine) {
    Write-Host 'Kiem tra bo xu ly tich hop (khong can cai Python)...'
    $engineResponse = '{"command":"check"}' | & $bundledEngine
    if ($LASTEXITCODE -ne 0) { throw 'Bo xu ly tich hop khong khoi dong duoc. Hay giai nen lai day du goi cai.' }
    $engineInfo = $engineResponse | ConvertFrom-Json
    if ($engineInfo.type -ne 'result' -or -not $engineInfo.result.opencv) { throw 'Bo xu ly tich hop khong hop le.' }
} else {
  Write-Host 'Ban ma nguon: kiem tra Python va OpenCV...'
  try {
    $resolvedPython = (& $PythonPath -c 'import sys, cv2, numpy; assert sys.version_info >= (3,10); print(sys.executable)' | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or -not $resolvedPython) { throw 'Python/OpenCV chua san sang.' }
  } catch {
    throw 'Can Python 3.10+ (64-bit) co OpenCV va NumPy. Script nay khong tai hay cai thu vien. Co the truyen -PythonPath duong-dan-python.exe.'
  }
}

# Read only: this installer never enables unsigned-extension mode itself.
$debugMode = Get-ItemProperty -Path 'HKCU:\Software\Adobe\CSXS.12' -Name PlayerDebugMode -ErrorAction SilentlyContinue
if ($debugMode.PlayerDebugMode -ne '1') {
    throw 'Ban beta chua ky so. CEP development mode chua duoc bat. Can chap thuan rieng truoc khi thay doi thiet lap nay; bo cai khong tu thay doi registry.'
}
$extensionsRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$destination = Join-Path $extensionsRoot 'vn.prtrack.panel'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -ne 'config.json' -and $_.Name -ne '__pycache__' } | Copy-Item -Destination $destination -Recurse -Force
@{ python = $resolvedPython; bundled = (Test-Path -LiteralPath $bundledEngine) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'config.json') -Encoding UTF8
Write-Host 'Da cai PR Track 2D.' -ForegroundColor Green
Write-Host 'Dong va mo lai Premiere > Window > Extensions > PR Track 2D.'
Write-Host "Thu muc: $destination"
