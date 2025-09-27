# Epic Pizza & Pasta — End-to-End Test Runner (PowerShell)
# Usage: In Back-End folder, run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\e2e.ps1
# Optional params:
#   -BaseUrl "http://localhost:4000/api" -PrinterName "HP LaserJet" -SkipPrinting

param(
  [string]$BaseUrl = 'http://localhost:4000/api',
  [string]$PrinterName,
  [switch]$SkipPrinting
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Section($title) { Write-Host "`n=== $title ===" -ForegroundColor Cyan }

function Wait-ForHealthy($url, $timeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri ("$url/health") -Method Get -TimeoutSec 3 -ErrorAction Stop
      if ($r) { return $true }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  return $false
}

function New-Json($obj) { $obj | ConvertTo-Json -Depth 10 }

# Keep a cookie-aware WebSession for CSRF + auth flows
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Get-CsrfToken {
  $resp = Invoke-WebRequest -Uri ("$BaseUrl/auth/csrf") -Method Get -WebSession $session -Headers @{ 'Accept'='application/json' }
  ($resp.Content | ConvertFrom-Json).csrfToken
}

function Post-Json($path, $bodyObj, $csrfToken) {
  $json = $bodyObj | ConvertTo-Json -Depth 10
  $resp = Invoke-WebRequest -Uri ("$BaseUrl$path") -Method Post -Body $json -ContentType 'application/json' -WebSession $session -Headers @{ 'X-CSRF-Token' = $csrfToken; 'Accept'='application/json'; 'Accept-Encoding'='identity' }
  @{
    Status = [int]$resp.StatusCode
    BodyRaw = $resp.Content
    Body = try { $resp.Content | ConvertFrom-Json } catch { $null }
  }
}

function Get-Json($path) {
  $resp = Invoke-WebRequest -Uri ("$BaseUrl$path") -Method Get -WebSession $session -Headers @{ 'Accept'='application/json' }
  @{
    Status = [int]$resp.StatusCode
    BodyRaw = $resp.Content
    Body = try { $resp.Content | ConvertFrom-Json } catch { $null }
  }
}

function Patch-Json($path, $bodyObj, $csrfToken) {
  $json = $bodyObj | ConvertTo-Json -Depth 10
  $resp = Invoke-WebRequest -Uri ("$BaseUrl$path") -Method Patch -Body $json -ContentType 'application/json' -WebSession $session -Headers @{ 'X-CSRF-Token' = $csrfToken; 'Accept'='application/json'; 'Accept-Encoding'='identity' }
  @{
    Status = [int]$resp.StatusCode
    BodyRaw = $resp.Content
    Body = try { $resp.Content | ConvertFrom-Json } catch { $null }
  }
}

function Try-CatchInvoke([scriptblock]$Block) {
  try { & $Block } catch {
    if ($_.Exception.Response) {
      $r = $_.Exception.Response
      $stream = $r.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); $content = $reader.ReadToEnd()
      return @{ Status = [int]$r.StatusCode; BodyRaw = $content; Body = try { $content | ConvertFrom-Json } catch { $null } }
    }
    throw
  }
}

# 0) Health
Section 'Health check'
if (-not (Wait-ForHealthy $BaseUrl 25)) { Write-Warning "Server not healthy at $BaseUrl" }
$health = Try-CatchInvoke { Get-Json '/health' }
Write-Host ($health.BodyRaw)

# 1) CSRF + Register + Login
Section 'Auth: register & login'
$csrf = Get-CsrfToken
Write-Host "CSRF: $csrf"
$email = "tester_$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$pass = 'Test12345'
$reg = Try-CatchInvoke { Post-Json '/auth/register' @{ email=$email; password=$pass; name='Tester'; phone='+66801230000' } $csrf }
Write-Host "Register => $($reg.Status)"; Write-Host $reg.BodyRaw

# Fresh CSRF for login (new secret each time)
$csrf = Get-CsrfToken
$login = Try-CatchInvoke { Post-Json '/auth/login' @{ email=$email; password=$pass } $csrf }
Write-Host "Login => $($login.Status)"; Write-Host $login.BodyRaw

# 2) Menu browse
Section 'Menu: list & search'
$menu = Try-CatchInvoke { Get-Json '/menu' }
Write-Host "Menu GET => $($menu.Status) items: $(@($menu.Body).Count)"
$search = Try-CatchInvoke { Get-Json '/menu/search?q=pizza' }
Write-Host "Search GET => $($search.Status) hits: $(@($search.Body).Count)"

# 3) Checkout: COD order
Section 'Create COD order'
$csrf = Get-CsrfToken
$payloadCod = @{ 
  customer = @{ name='COD User'; phone='+66801110000'; address='1 Cash St' }
  items = @(@{ id='pizza-margherita'; name='Margherita'; qty=1; price=359 })
  delivery = @{ type='delivery'; fee=39 }
  paymentMethod = 'cod'
}
$ordCod = Try-CatchInvoke { Post-Json '/orders' $payloadCod $csrf }
Write-Host "POST /orders (cod) => $($ordCod.Status)"; Write-Host $ordCod.BodyRaw
$orderIdCod = $ordCod.Body.orderId

# 4) ETA & status updates
Section 'ETA & status update'
if ($orderIdCod) {
  $eta = Try-CatchInvoke { Get-Json ("/orders/$orderIdCod/eta") }
  Write-Host "ETA => $($eta.Status)"; Write-Host $eta.BodyRaw
  $csrf = Get-CsrfToken
  $st1 = Try-CatchInvoke { Patch-Json ("/orders/$orderIdCod/status") @{ status='preparing' } $csrf }
  $st2 = Try-CatchInvoke { Patch-Json ("/orders/$orderIdCod/status") @{ status='out-for-delivery'; driverName='Somchai' } $csrf }
  $st3 = Try-CatchInvoke { Post-Json ("/orders/$orderIdCod/confirm-delivered") @{} $csrf }
  Write-Host "Status preparing => $($st1.Status)"
  Write-Host "Status out-for-delivery => $($st2.Status)"
  Write-Host "Confirm delivered => $($st3.Status)"
}

# 5) PromptPay flow (local QR) and then cancel/refund
Section 'PromptPay create + cancel/refund'
$csrf = Get-CsrfToken
$payloadPP = @{ 
  customer = @{ name='PP User'; phone='+66802220000'; address='2 QR St' }
  items = @(@{ id='pizza-margherita'; name='Margherita'; qty=1; price=359 })
  delivery = @{ type='pickup'; fee=0 }
  paymentMethod = 'promptpay'
}
$ordPP = Try-CatchInvoke { Post-Json '/orders' $payloadPP $csrf }
Write-Host "POST /orders (promptpay) => $($ordPP.Status)"; Write-Host $ordPP.BodyRaw
$orderIdPP = $ordPP.Body.orderId
if ($orderIdPP) {
  $ppCreate = Try-CatchInvoke { Post-Json '/payments/promptpay/create' @{ orderId=$orderIdPP; amount=($ordPP.Body.amountTotal) } $csrf }
  Write-Host "Create QR => $($ppCreate.Status)"; Write-Host $ppCreate.BodyRaw
  $stat1 = Try-CatchInvoke { Get-Json ("/payments/$orderIdPP/status") }
  Write-Host "Pay status before cancel => $($stat1.Status)"; Write-Host $stat1.BodyRaw
  $cancel = Try-CatchInvoke { Post-Json ("/orders/$orderIdPP/cancel") @{} $csrf }
  Write-Host "Cancel order => $($cancel.Status)"; Write-Host $cancel.BodyRaw
  Start-Sleep -Milliseconds 500
  $stat2 = Try-CatchInvoke { Get-Json ("/payments/$orderIdPP/status") }
  Write-Host "Pay status after cancel => $($stat2.Status)"; Write-Host $stat2.BodyRaw
}

# 6) Printing (optional)
if (-not $SkipPrinting.IsPresent) {
  Section 'Printing: list + PDF test'
  try {
    $env:WINDOWS_PRINTER_NAME = $PrinterName
    $p1 = node -e "console.log('node ok')" | Out-String
    Write-Host ($p1.Trim())
    $list = npx tsx .\scripts\list-printers.ts 2>&1 | Out-String
    Write-Host $list
    $pdf = npx tsx .\scripts\print-pdf.ts 2>&1 | Out-String
    Write-Host $pdf
  } catch { Write-Warning "Printing test failed: $($_.Exception.Message)" }
}

Section 'Done'
Write-Host 'E2E flow executed.' -ForegroundColor Green
