# Skrip test API sederhana untuk proyek Back-End
# Cara pakai: buka PowerShell, masuk ke folder Back-End lalu: .\scripts\test-api.ps1

$base = 'http://localhost:4000/api'
$health = "$base/health"
$orders = "$base/orders"
${csrfEndpoint} = "$base/auth/csrf"

function Wait-ForServer {
    param(
        [int]$TimeoutSeconds = 15
    )
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
        try {
            $r = Invoke-RestMethod -Uri $health -Method Get -TimeoutSec 3 -ErrorAction Stop
            Write-Output "Server sehat: $($r | ConvertTo-Json -Compress)"
            return $true
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Output "Gagal terhubung ke $health dalam $TimeoutSeconds detik"
    return $false
}

if (-not (Wait-ForServer -TimeoutSeconds 20)) { exit 1 }

# Obtain CSRF token (and cookies) using a web session
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $csrfResp = Invoke-WebRequest -Uri ${csrfEndpoint} -WebSession $session -Method Get -ErrorAction Stop
    $csrfJson = $csrfResp.Content | ConvertFrom-Json
    $csrfToken = $csrfJson.csrfToken
    Write-Output "CSRF token acquired: $csrfToken"
} catch {
    Write-Output "Failed to get CSRF token: $($_.Exception.Message)"
}

# GET /orders
Write-Output "\nGET $orders"
try {
    $resp = Invoke-RestMethod -Uri $orders -Method Get -ErrorAction Stop
    Write-Output ($resp | ConvertTo-Json -Depth 5)
} catch {
    # try to get response body
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        Write-Output "GET /orders HTTP ERROR BODY:"
        Write-Output $content
    } else {
        Write-Output "GET /orders error: $($_.Exception.Message)"
    }
}

# POST /orders (contoh payload yang memenuhi CreateOrderDto)
$body = @{ 
    customer = @{ name = 'Test User'; phone = '+66801234567'; address = '123 Test St' }
    items = @(@{ id = 'pizza-margherita'; name = 'Margherita'; qty = 1; price = 359 })
    delivery = @{ type = 'delivery'; fee = 39 }
    paymentMethod = 'promptpay'
} | ConvertTo-Json -Depth 5

Write-Output "\nPOST $orders"
try {
    $resp = Invoke-WebRequest -Uri $orders -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop -WebSession $session -Headers @{ 'X-CSRF-Token' = $csrfToken; 'Accept' = 'application/json'; 'Accept-Encoding' = 'identity' }
    Write-Output ("POST /orders STATUS: " + $resp.StatusCode)
    Write-Output ("BODY: " + $resp.Content)
} catch {
    if ($_.Exception.Response) {
        $r = $_.Exception.Response
        $status = [int]$r.StatusCode
        $stream = $r.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        Write-Output ("POST /orders STATUS: $status")
        Write-Output "POST /orders HTTP ERROR BODY:"
        Write-Output $content
    } else {
        Write-Output "POST /orders error: $($_.Exception.Message)"
    }
}
