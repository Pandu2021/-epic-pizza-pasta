$ErrorActionPreference = 'Stop'
$u = 'http://localhost:4000'

function Time-Call($name, $url) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Invoke-RestMethod -Uri $url -Method GET | Out-Null
  $sw.Stop()
  Write-Host ("$name took {0} ms" -f $sw.ElapsedMilliseconds)
}

Time-Call 'GET /api/menu'                "$u/api/menu"
Time-Call 'GET /api/menu?category=pizza'  "$u/api/menu?category=pizza"
Time-Call 'GET /api/menu/search?q=margherita' "$u/api/menu/search?q=margherita"
