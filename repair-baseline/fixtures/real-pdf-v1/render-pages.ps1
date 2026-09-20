param(
  [string]$PapersRoot = "C:/universe/MyStudy/atom/Categorized Papers",
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

$manifest = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "manifest.json") | ConvertFrom-Json
$outputDirectory = Join-Path $RepositoryRoot "tmp/pdfs/accuracy-pages"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

foreach ($source in $manifest.sources) {
  $pdfPath = Join-Path $PapersRoot $source.relativePath
  if (-not (Test-Path -LiteralPath $pdfPath)) {
    throw "Missing source PDF: $pdfPath"
  }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $pdfPath).Hash
  if ($hash -ne $source.sha256) {
    throw "Source hash mismatch: $($source.relativePath)"
  }
  foreach ($page in $source.pages) {
    $prefix = Join-Path $outputDirectory "$($source.key)-p$page"
    & pdftoppm -f $page -l $page -singlefile -png -r $manifest.renderDpi -- $pdfPath $prefix
    if ($LASTEXITCODE -ne 0) {
      throw "pdftoppm failed for $($source.relativePath), page $page"
    }
  }
}

Write-Output "Rendered $($manifest.evaluatedPages.Count) benchmark pages in $outputDirectory"
