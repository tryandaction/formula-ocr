param(
  [string]$InputFile,
  [int]$MaxDetectSeconds = 90,
  [int]$MaxOcrSeconds = 90,
  [int]$CheckIntervalMs = 2000
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

function Invoke-Eval([string]$expr) {
  $out = (npx --yes @playwright/cli eval $expr | Out-String)
  $lines = $out -split "`r?`n"
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '### Result') {
      for ($j=$i+1; $j -lt $lines.Length; $j++) {
        $line = $lines[$j].Trim()
        if ($line -match '^### ') { break }
        if ($line.Length -gt 0) { return $line }
      }
    }
  }
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

function Test-BackendHealth() {
  $url = "https://formula-ocr-api.formula-ocr.workers.dev/api/health"
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 6
    return ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300)
  } catch {
    return $false
  }
}

$localAvailable = $false
function Test-LocalHealth() {
  $url = "http://localhost:8502/health"
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300)
  } catch {
    return $false
  }
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

$backendAvailable = Test-BackendHealth
$localAvailable = Test-LocalHealth
$ocrProvider = $null
if ($backendAvailable) {
  $ocrProvider = "backend"
} elseif ($localAvailable) {
  $ocrProvider = "local"
  npx --yes @playwright/cli eval "localStorage.setItem('formula_ocr_selected_provider','local')" | Out-Null
}

$results = @()
foreach ($file in $localFiles) {
  npx --yes @playwright/cli reload | Out-Null
  npx --yes @playwright/cli eval "() => { const buttons = Array.from(document.querySelectorAll('button')); for (const b of buttons) { if (b.innerText && b.innerText.includes('文档解析')) { b.click(); return true; } } return false; }" | Out-Null
  npx --yes @playwright/cli eval "document.querySelector('input[type=file]')?.click()" | Out-Null
  npx --yes @playwright/cli upload $file | Out-Null

  $detectStart = Get-Date
  $detectReady = $false
  $detectLoops = [Math]::Max(1, [Math]::Ceiling($MaxDetectSeconds * 1000 / $CheckIntervalMs))
  for ($i=0; $i -lt $detectLoops; $i++) {
    $readyText = Invoke-Eval "() => { const text = document.body.innerText; return JSON.stringify({ hasButton: text.includes('识别全部'), detecting: text.includes('检测中') }); }"
    if ($readyText) {
      $status = $readyText | ConvertFrom-Json
      if ($status.hasButton -and -not $status.detecting) { $detectReady = $true; break }
    }
    Start-Sleep -Milliseconds $CheckIntervalMs
  }
  $detectElapsedMs = [Math]::Round(((Get-Date) - $detectStart).TotalMilliseconds)

  npx --yes @playwright/cli snapshot | Out-Null
  $snap = Get-LatestSnapshot $benchDir
  $metrics = Get-Metrics $snap
  $formulaCount = 0
  if ($metrics.formulas) { $formulaCount = [int]$metrics.formulas }

  $ocrStart = Get-Date
  $ocrDone = $false
  $ocrError = $null
  if ($ocrProvider) {
    # Trigger OCR for all formulas (desktop button has a stable title)
    npx --yes @playwright/cli eval "() => { const btn = document.querySelector('button[title=\"识别所有页面的公式\"]'); if (btn) { btn.classList.remove('hidden'); btn.style.display = 'flex'; btn.click(); return true; } return false; }" | Out-Null

    $noProgressLoops = 0
    $maxNoProgressLoops = [Math]::Max(1, [Math]::Ceiling(20000 / $CheckIntervalMs))
    $ocrLoops = [Math]::Max(1, [Math]::Ceiling($MaxOcrSeconds * 1000 / $CheckIntervalMs))
    for ($i=0; $i -lt $ocrLoops; $i++) {
      $jsonText = Invoke-Eval "() => { const text = document.body.innerText; const done = (text.match(/已识别/g) || []).length + (text.match(/识别失败/g) || []).length; return JSON.stringify({ processing: text.includes('识别中'), doneCount: done }); }"
      if ($jsonText) {
        $status = $jsonText | ConvertFrom-Json
        $processing = [bool]$status.processing
        $doneCount = [int]$status.doneCount
        if (-not $processing -and ($formulaCount -eq 0 -or $doneCount -ge $formulaCount)) { $ocrDone = $true; break }
        if (-not $processing -and $doneCount -eq 0) {
          $noProgressLoops++
          if ($noProgressLoops -eq 2) {
            # Fallback: click individual formula buttons
            npx --yes @playwright/cli eval "() => { const buttons = Array.from(document.querySelectorAll('button')); for (const b of buttons) { if (b.innerText && b.innerText.includes('点击识别公式')) { b.click(); } } return true; }" | Out-Null
          }
          if ($noProgressLoops -ge $maxNoProgressLoops) {
            $ocrError = "OCR_NOT_STARTED"
            break
          }
        } else {
          $noProgressLoops = 0
        }
      }
      Start-Sleep -Milliseconds $CheckIntervalMs
    }
  } else {
    $ocrError = "NO_OCR_PROVIDER"
  }
  $ocrElapsedMs = [Math]::Round(((Get-Date) - $ocrStart).TotalMilliseconds)

  npx --yes @playwright/cli snapshot | Out-Null
  $finalSnap = Get-LatestSnapshot $benchDir
  npx --yes @playwright/cli screenshot | Out-Null

  $results += [pscustomobject]@{
    file = (Split-Path $file -Leaf)
    detect_ready = $detectReady
    detect_ms = $detectElapsedMs
    ocr_done = $ocrDone
    ocr_ms = $ocrElapsedMs
    ocr_error = $ocrError
    backend_available = $backendAvailable
    local_available = $localAvailable
    ocr_provider = $ocrProvider
    pages = $metrics.pages
    formulas = $metrics.formulas
    type = $metrics.type
    confidence = if ($metrics.confidence) { "$($metrics.confidence)%" } else { $null }
    snapshot = $finalSnap
  }
}

npx --yes @playwright/cli close | Out-Null
$openProc.Refresh()
if ($openProc -and -not $openProc.HasExited) { Stop-Process -Id $openProc.Id -ErrorAction SilentlyContinue }
$devPid = Get-Content -Path $pidFile -ErrorAction SilentlyContinue
if ($devPid) { Stop-Process -Id $devPid -ErrorAction SilentlyContinue }

$results | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $benchDir "ocr-results.json")
$results | ConvertTo-Csv -NoTypeInformation | Set-Content -Path (Join-Path $benchDir "ocr-results.csv")

$results | Format-Table -AutoSize | Out-String
