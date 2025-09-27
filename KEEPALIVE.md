# Keep-Alive Ping (Temporary Free Tier Mitigation)

This repository includes a lightweight script to gently ping the deployed Render service every ~14 minutes to mitigate cold starts on the **free tier**. This is **not** a substitute for proper scaling or upgrading to a paid plan and should be removed once no longer needed.

## Files

- `scripts/keepalive.mjs` – Performs lightweight GET requests to one or more endpoints. Accepts env `KEEPALIVE_URLS` (comma-separated) or `KEEPALIVE_URL` (single). Defaults to pinging:
	- `https://api.epicfoodorders.com/api/health`
	- `https://api.epicfoodorders.com/api/menu`
- `.github/workflows/keepalive.yml` – GitHub Actions workflow that runs the script on a cron schedule every 14 minutes.
- `scripts/keepalive.test.mjs` – Simple local test to ensure the ping function works.

## Environment Variable

You can set repository secrets:

- `KEEPALIVE_URLS` to a comma-separated list (preferred), e.g.
	```
	https://api.epicfoodorders.com/api/health,https://api.epicfoodorders.com/api/menu
	```
- or `KEEPALIVE_URL` to a single URL.

Pick the **lightest** possible endpoint. Avoid endpoints that trigger database writes, large downstream API calls, or heavy computation.

## Local Usage

Windows PowerShell (one-shot):
```powershell
$env:KEEPALIVE_URLS = "https://api.epicfoodorders.com/api/health,https://api.epicfoodorders.com/api/menu"; node scripts/keepalive.mjs --once
```
Continuous (default every 14 minutes):
```powershell
$env:KEEPALIVE_URLS = "https://api.epicfoodorders.com/api/health,https://api.epicfoodorders.com/api/menu"; node scripts/keepalive.mjs
```
Override interval (minutes):
```powershell
$env:KEEPALIVE_INTERVAL_MINUTES = "20"; $env:KEEPALIVE_URLS = "https://..."; node scripts/keepalive.mjs
```

## GitHub Actions Schedule
The cron expression used: `*/14 * * * *` meaning every 14 minutes. This yields ~4–5 ping batches per hour, low enough to respect fair use.

## Fair Use & Disclaimer
- Do not decrease the interval further; that may violate fair use.
- Remove this when moving off free tier.
- Monitor logs for any unexpected load.
- If the service still sleeps, consider alternative hosting or native warmup features.

## Test
Run the included simple test:
```bash
node scripts/keepalive.test.mjs
```

## Removal
When no longer needed: delete `scripts/keepalive.mjs`, its test, workflow file, and this doc.
