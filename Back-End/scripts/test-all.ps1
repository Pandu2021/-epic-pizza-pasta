# All-in-one backend test runner (PowerShell)
# Usage: Open PowerShell in Back-End folder and run: .\scripts\test-all.ps1
# Notes:
# - Requires Node.js and internet for Omise tests.
# - Uses Omise test keys from .env by default; you can override via environment variables.

param(
  [string]$BaseUrl = 'http://localhost:4000/api',
  [switch]$StartServer,
  [int]$ServerStartupTimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Ensure we run from Back-End root regardless of current directory
try { Set-Location -Path (Split-Path -Parent $PSScriptRoot) } catch {}

function Write-Section($title) {
  Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Wait-For($url, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep -Milliseconds 500 }
  }
  return $false
}

# Attempt to start server if requested
$serverProc = $null
if ($StartServer.IsPresent) {
  Write-Section 'Starting backend server'
  $null = npm run build | Out-Host
  $serverProc = Start-Process -FilePath node -ArgumentList 'dist/main.js' -PassThru -WindowStyle Hidden
  if (-not (Wait-For ("$BaseUrl/health") $ServerStartupTimeoutSec)) {
    Write-Warning "Server health endpoint not reachable at $BaseUrl within $ServerStartupTimeoutSec seconds. Proceeding anyway."
  }
}

# Collect results
$result = [ordered]@{
  health               = $null
  api_create_order     = $null
  cod_flow             = $null
  omise_promptpay      = $null
  omise_card           = $null
}

try {
  Write-Section 'Health check'
  try { $result.health = Invoke-RestMethod -Uri ("$BaseUrl/health") -Method Get -TimeoutSec 5 } catch { $result.health = @{ error = $_.Exception.Message } }
  $result.health | ConvertTo-Json -Compress | Write-Host

  Write-Section 'API smoke (create order with PromptPay)'
  $env:BASE_URL = $BaseUrl
  $apiOut = & .\scripts\test-api.ps1 2>&1
  $result.api_create_order = $apiOut -join "`n"
  Write-Output $result.api_create_order

  Write-Section 'COD flow (delivery & pickup)'
  $cod = node .\scripts\test-cod.mjs 2>&1
  $result.cod_flow = ($cod | Out-String)
  Write-Output $result.cod_flow

  Write-Section 'PromptPay via Omise'
  # Omise keys can come from environment or .env-backed process env
  $pp = node .\scripts\test-omise-promptpay.mjs 2>&1
  $result.omise_promptpay = ($pp | Out-String)
  Write-Output $result.omise_promptpay

  Write-Section 'Card via Omise'
  $card = node .\scripts\test-omise-card.mjs 2>&1
  $result.omise_card = ($card | Out-String)
  Write-Output $result.omise_card
}
finally {
  if ($serverProc) {
    try { Stop-Process -Id $serverProc.Id -Force } catch {}
  }
}

Write-Section 'Summary'
# Lightweight parsing to highlight key outcomes
function ContainsText($text, [string]$needle) {
  if (-not $text) { return $false }
  $s = ($text | Out-String)
  return $s -like "*${needle}*"
}
function MatchCount($text, [string]$pattern) {
  if (-not $text) { return 0 }
  $s = ($text | Out-String)
  return ([regex]::Matches($s, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)).Count
}

$summary = [ordered]@{}
$summary.health_ok = -not ($result.health -is [hashtable] -and $result.health.ContainsKey('error'))
$summary.api_order_created = ContainsText $result.api_create_order 'POST /orders STATUS: 201'
$summary.cod_delivery_ok = (MatchCount $result.cod_flow '\[COD Delivery\][^\n]*=>\s*201') -gt 0
$summary.cod_pickup_ok = (MatchCount $result.cod_flow '\[COD Pickup\][^\n]*=>\s*201') -gt 0
$summary.omise_promptpay_ok = ContainsText $result.omise_promptpay 'POST /payments/omise/promptpay => 201'
$summary.omise_card_ok = ContainsText $result.omise_card '"status":"successful"' -or (ContainsText $result.omise_card 'POST /payments/omise/charge => 201')

$summary | ConvertTo-Json -Compress | Write-Host

Write-Section 'Raw outputs path'
# Optionally, write raw outputs to temp files for inspection
$dir = Join-Path $env:TEMP ("pizza-tests-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $dir | Out-Null
@{
  health = $result.health | ConvertTo-Json -Depth 5
  api_create_order = $result.api_create_order
  cod_flow = $result.cod_flow
  omise_promptpay = $result.omise_promptpay
  omise_card = $result.omise_card
}.GetEnumerator() | ForEach-Object {
  Set-Content -Path (Join-Path $dir ($_.Key + '.log')) -Value ($_.Value)
}
Write-Host $dir
