param(
  [int]$Port = 8502
)

$ErrorActionPreference = 'Stop'
$engineRoot = Split-Path -Parent $PSScriptRoot
Push-Location $engineRoot
try {
  $env:FORMULA_OCR_PORT = [string]$Port
  & uv run formula-ocr-engine
  if ($LASTEXITCODE -ne 0) { throw "Formula OCR engine exited with code $LASTEXITCODE" }
} finally {
  Pop-Location
}
