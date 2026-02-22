param(
  [string]$InputFile,
  [int]$MaxWaitSeconds = 45
)

$ErrorActionPreference = "Stop"

$benchDir = "c:/universe/software development/me/Physics Formula OCR/formula-ocr/output/playwright/pdf-benchmark"
$stdout = Join-Path $benchDir "devserver.stdout.log"
$stderr = Join-Path $benchDir "devserver.stderr.log"
$pidFile = Join-Path $benchDir "devserver.pid"

$proc = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--host","127.0.0.1","--port","5173" -WorkingDirectory "c:/universe/software development/me/Physics Formula OCR/formula-ocr" -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii
Set-Location -Path $benchDir

function Get-DevServerUrl([string]$logPath, [int]$maxWaitSeconds = 10) {
  $deadline = (Get-Date).AddSeconds($maxWaitSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $logPath) {
      $content = Get-Content -Path $logPath -Raw
      if ($content -match 'http://127\.0\.0\.1:(\d+)/') {
        return "http://127.0.0.1:$($Matches[1])"
      }
    }
    Start-Sleep -Milliseconds 200
  }
  return "http://127.0.0.1:5173"
}

function Get-LatestSnapshot([string]$dir) {
  $snapDir = Join-Path $dir ".playwright-cli"
  if (-not (Test-Path -LiteralPath $snapDir)) { return $null }
  $snap = Get-ChildItem -Path $snapDir -Filter "*.yml" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($snap) { return $snap.FullName }
  return $null
}

function Get-Metrics([string]$snapshot) {
  if (-not $snapshot) { return [pscustomobject]@{ pages=$null; formulas=$null; type=$null; confidence=$null } }
  $lines = Get-Content -Path $snapshot
  $pages = ($lines | Select-String -Pattern '\u5171 (\d+) \u9875' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  $formulas = ($lines | Select-String -Pattern '(\d+) \u4E2A\u516C\u5F0F' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  if (-not $formulas) {
    $formulas = ($lines | Select-String -Pattern '(\d+) \u516C\u5F0F' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  }
  $type = $null
  $confidence = $null
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '\u72EC\u7ACB|\u884C\u5185') {
      if (-not $type) { $type = $Matches[0] }
      for ($j=$i; $j -lt [Math]::Min($i+6, $lines.Length); $j++) {
        if ($lines[$j] -match '(\d+)%') { $confidence = $Matches[1]; break }
      }
      if ($confidence) { break }
    }
  }
  return [pscustomobject]@{ pages=$pages; formulas=$formulas; type=$type; confidence=$confidence }
}

$localFiles = @()
if ($InputFile) {
  $localFiles = @($InputFile)
} else {
  $localFiles = Get-ChildItem -Path $benchDir -Filter "*.pdf" | Select-Object -ExpandProperty FullName
}

$devUrl = Get-DevServerUrl $stdout
$openProc = Start-Process -FilePath "npx.cmd" -ArgumentList "--yes","@playwright/cli","open",$devUrl -WorkingDirectory $benchDir -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 1500

$results = @()
foreach ($file in $localFiles) {
  npx --yes @playwright/cli reload | Out-Null
  npx --yes @playwright/cli eval "() => { const buttons = Array.from(document.querySelectorAll('button')); for (const b of buttons) { if (b.innerText && b.innerText.includes('文档解析')) { b.click(); return true; } } return false; }" | Out-Null

  npx --yes @playwright/cli eval "document.querySelector('input[type=file]')?.click()" | Out-Null
  npx --yes @playwright/cli upload $file | Out-Null

  $start = Get-Date
  $ready = $false
  $maxLoops = [Math]::Max(1, [Math]::Ceiling($MaxWaitSeconds * 1000 / 500))
  for ($i=0; $i -lt $maxLoops; $i++) {
    $evalOut = (npx --yes @playwright/cli eval "document.body.innerText.includes('识别全部')" | Out-String)
    if ($evalOut -match 'true') { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  $elapsedMs = [Math]::Round(((Get-Date) - $start).TotalMilliseconds)

  npx --yes @playwright/cli snapshot | Out-Null
  $snap = Get-LatestSnapshot $benchDir
  $metrics = Get-Metrics $snap
  npx --yes @playwright/cli screenshot | Out-Null

  $results += [pscustomobject]@{
    file = (Split-Path $file -Leaf)
    ready = $ready
    elapsed_ms = $elapsedMs
    pages = $metrics.pages
    formulas = $metrics.formulas
    type = $metrics.type
    confidence = if ($metrics.confidence) { "$($metrics.confidence)%" } else { $null }
    snapshot = $snap
  }
}

npx --yes @playwright/cli close | Out-Null
$openProc.Refresh()
if ($openProc -and -not $openProc.HasExited) { Stop-Process -Id $openProc.Id -ErrorAction SilentlyContinue }
$devPid = Get-Content -Path $pidFile -ErrorAction SilentlyContinue
if ($devPid) { Stop-Process -Id $devPid -ErrorAction SilentlyContinue }

$results | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $benchDir "results.json")
$results | ConvertTo-Csv -NoTypeInformation | Set-Content -Path (Join-Path $benchDir "results.csv")

$results | Format-Table -AutoSize | Out-String
