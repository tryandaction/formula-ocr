param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

$ErrorActionPreference = 'Stop'
$sourceManifestPath = Join-Path $RepositoryRoot 'repair-baseline/fixtures/real-pdf-v1/manifest.json'
$source = Get-Content -Raw -LiteralPath $sourceManifestPath | ConvertFrom-Json
$cropDirectory = Join-Path $PSScriptRoot 'crops'
New-Item -ItemType Directory -Force -Path $cropDirectory | Out-Null

$port = Get-Random -Minimum 42000 -Maximum 49000
$rendererUrl = "http://127.0.0.1:$port/repair-baseline/fixtures/synthetic-formula-v1/renderer.html"
$items = @($source.samples | ForEach-Object {
  [ordered]@{
    id = $_.id
    latex = $_.groundTruthLatex
    output = (Join-Path $cropDirectory "$($_.id).png").Replace('\', '/')
  }
})
$itemsJson = $items | ConvertTo-Json -Depth 4 -Compress
$code = @"
async page => {
  const items = $itemsJson;
  await page.setViewportSize({ width: 1800, height: 600 });
  for (const item of items) {
    await page.goto('${rendererUrl}?id=' + encodeURIComponent(item.id) + '#' + encodeURIComponent(item.latex));
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' || document.documentElement.dataset.error);
    const error = await page.evaluate(() => document.documentElement.dataset.error || '');
    if (error) throw new Error(item.id + ': ' + error);
    const rect = await page.locator('#formula').boundingBox();
    if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error(item.id + ': formula has no visible bounds');
    await page.screenshot({ path: item.output, clip: rect });
  }
  return { rendered: items.length };
}
"@
$codePath = Join-Path ([System.IO.Path]::GetTempPath()) 'formula-ocr-synthetic-render.js'
Set-Content -LiteralPath $codePath -Value $code -Encoding utf8

Push-Location $PSScriptRoot
$server = $null
try {
  $server = Start-Process -FilePath 'uv.exe' -ArgumentList @('run', '--python', '3.11', 'python', '-m', 'http.server', $port, '--bind', '127.0.0.1') -WorkingDirectory $RepositoryRoot -WindowStyle Hidden -PassThru
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $rendererUrl -TimeoutSec 1 | Out-Null
      break
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if ($server.HasExited) { throw 'temporary renderer server failed to start' }
  & npx.cmd '--yes' '--package' '@playwright/cli' 'playwright-cli' '--session' 'synthetic' 'open' $rendererUrl
  if ($LASTEXITCODE -ne 0) { throw 'playwright-cli open failed' }
  & npx.cmd '--yes' '--package' '@playwright/cli' 'playwright-cli' '--session' 'synthetic' 'run-code' '--filename' $codePath
  if ($LASTEXITCODE -ne 0) { throw 'playwright-cli render failed' }
  & npx.cmd '--yes' '--package' '@playwright/cli' 'playwright-cli' '--session' 'synthetic' 'close'
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
  Pop-Location
}

$samples = @($source.samples | ForEach-Object {
  $file = Join-Path $cropDirectory "$($_.id).png"
  if (-not (Test-Path -LiteralPath $file)) { throw "Missing rendered crop: $file" }
  [ordered]@{
    id = $_.id
    sourceType = 'synthetic-katex-render'
    inputFile = "crops/$($_.id).png"
    formulaType = $_.formulaType
    groundTruthLatex = $_.groundTruthLatex
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash
    allowCloudUpload = $true
    status = 'human-ground-truth-rendered'
  }
})
$manifest = [ordered]@{
  schemaVersion = 1
  name = 'synthetic-formulas-v1'
  generatedAt = '2026-09-21'
  renderer = 'KaTeX 0.16.27 / Chromium screenshot'
  license = 'Project-generated fixtures; ground-truth strings authored for evaluation'
  samples = $samples
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Encoding utf8
Write-Output "Rendered $($samples.Count) synthetic formula crops."
