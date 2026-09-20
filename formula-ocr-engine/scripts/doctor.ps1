param(
  [switch]$Json,
  [int]$Port = 8502
)

$ErrorActionPreference = 'Stop'
$engineRoot = Split-Path -Parent $PSScriptRoot
$uvVersion = (& uv --version 2>$null) -join ''
$pythonVersion = (& uv run --directory $engineRoot python -c "import platform; print(platform.python_version())" 2>$null) -join ''
$drive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($engineRoot).Substring(0, 1))
$portInUse = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
$paddleModel = Join-Path $env:USERPROFILE '.paddlex/official_models/PP-FormulaNet-S'
$mfdModel = Join-Path $env:USERPROFILE '.cache/huggingface/hub/models--breezedeus--pix2text-mfd-1.5'
$packages = & uv run --directory $engineRoot python -c "import importlib.util,json; ok=False; err=None
try:
 import cv2
 ok=hasattr(cv2,'IMREAD_COLOR') and hasattr(cv2,'setNumThreads')
except Exception as exc: err=str(exc)
print(json.dumps({'paddle':bool(importlib.util.find_spec('paddleocr')),'detection':bool(importlib.util.find_spec('cnstd')),'opencv':ok,'opencvError':err}))"
$installed = $packages | ConvertFrom-Json
$gpu = [bool](Get-Command nvidia-smi -ErrorAction SilentlyContinue)
$cpuName = $env:PROCESSOR_IDENTIFIER
if ([string]::IsNullOrWhiteSpace($cpuName)) {
  $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name).Trim()
}
$result = [ordered]@{
  status = if ($pythonVersion -match '^3\.11\.' -and $installed.opencv) { 'ok' } else { 'error' }
  uv = $uvVersion
  python = $pythonVersion
  bindHost = '127.0.0.1'
  port = $Port
  portInUse = $portInUse
  cpu = $cpuName
  nvidiaGpu = $gpu
  freeDiskBytes = [int64]$drive.Free
  models = [ordered]@{
    formula = if (Test-Path -LiteralPath $paddleModel) { 'cached' } elseif ($installed.paddle) { 'not_downloaded' } else { 'not_installed' }
    detection = if (Test-Path -LiteralPath $mfdModel) { 'cached' } elseif ($installed.detection) { 'not_downloaded' } else { 'not_installed' }
    document = 'disabled'
  }
  opencv = if ($installed.opencv) { 'ok' } else { 'broken' }
}

if ($Json) {
  $result | ConvertTo-Json -Depth 4 -Compress
} else {
  $result | Format-List
}

if ($result.status -ne 'ok') { exit 1 }
