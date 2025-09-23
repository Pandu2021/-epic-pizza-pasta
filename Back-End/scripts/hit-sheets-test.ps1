$ErrorActionPreference = 'Stop'

$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrf = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/csrf' -Method GET -WebSession $s
$token = $csrf.csrfToken
Write-Host "CSRF token: $token"

$response = Invoke-RestMethod -Uri 'http://localhost:4000/api/health/sheets/test-append' -Method POST -WebSession $s -Headers @{ 'X-CSRF-Token' = $token }
$response | ConvertTo-Json -Depth 5
