# Keep-Alive Ping (Temporary Free Tier Mitigation)

This repository includes a lightweight script to gently ping the deployed Render service every ~14 minutes to mitigate cold starts on the **free tier**. This is **not** a substitute for proper scaling or upgrading to a paid plan and should be removed once no longer needed.

## Files

- `scripts/keepalive.mjs` – Performs a single GET request (default endpoint should be something cheap like `/health` or `/`). Accepts environment variable `KEEPALIVE_URL`.
- `.github/workflows/keepalive.yml` – GitHub Actions workflow that runs the script on a cron schedule every 14 minutes.
- `scripts/keepalive.test.mjs` – Simple local test to ensure the ping function works.

## Environment Variable

Set a repository secret named `KEEPALIVE_URL` pointing to your public endpoint, e.g.
```
https://your-service.onrender.com/health
```
Pick the **lightest** possible endpoint. Avoid endpoints that trigger database writes, large downstream API calls, or heavy computation.

## Local Usage

```bash
KEEPALIVE_URL="https://your-service.onrender.com/health" node scripts/keepalive.mjs --once
```
Or continuous mode (interval defaults to 14 minutes):
```bash
KEEPALIVE_URL="https://your-service.onrender.com/health" node scripts/keepalive.mjs
```
Optional: override interval (minutes):
```bash
KEEPALIVE_INTERVAL_MINUTES=20 KEEPALIVE_URL="https://..." node scripts/keepalive.mjs
```

## GitHub Actions Schedule
The cron expression used: `*/14 * * * *` meaning every 14 minutes. This yields ~4–5 pings per hour, low enough to respect Render fair use.

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
