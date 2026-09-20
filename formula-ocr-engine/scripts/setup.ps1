param(
  [switch]$WithDetection
)

$ErrorActionPreference = 'Stop'
$engineRoot = Split-Path -Parent $PSScriptRoot
Push-Location $engineRoot
try {
  $arguments = @('sync', '--python', '3.11', '--extra', 'paddle')
  if ($WithDetection) {
    $arguments += @(
      '--extra', 'pix2text',
      '--reinstall-package', 'opencv-python',
      '--reinstall-package', 'opencv-contrib-python'
    )
  }
  & uv @arguments
  if ($LASTEXITCODE -ne 0) { throw "uv sync failed with exit code $LASTEXITCODE" }
  Write-Output 'Formula OCR engine environment is ready.'
} finally {
  Pop-Location
}
