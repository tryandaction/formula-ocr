param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

$manifestPath = Join-Path $PSScriptRoot "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$outputDirectory = Join-Path $PSScriptRoot "crops"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Add-Type -AssemblyName System.Drawing

foreach ($sample in $manifest.samples) {
  $sourcePath = Join-Path $RepositoryRoot $sample.pageImage
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing rendered page: $sourcePath"
  }
  $destinationPath = Join-Path $PSScriptRoot $sample.cropFile
  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  try {
    $rectangle = [System.Drawing.Rectangle]::new(
      [int]$sample.bbox.x,
      [int]$sample.bbox.y,
      [int]$sample.bbox.width,
      [int]$sample.bbox.height
    )
    $crop = $source.Clone($rectangle, $source.PixelFormat)
    try {
      $crop.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $crop.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

Write-Output "Generated $($manifest.samples.Count) formula crops in $outputDirectory"
