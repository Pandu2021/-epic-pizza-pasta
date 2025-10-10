# Go-Live Checklist — Epic Pizza & Pasta Backend

This checklist consolidates the minimum steps we verified for production. Tick each item before promoting a build.

## 1. Environment & Secrets
- [ ] `DATABASE_URL` points to managed PostgreSQL with SSL enforced.
- [ ] `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` configured (PEM, escaped newlines).
- [ ] `COOKIE_SECRET` random 32+ chars.
- [ ] `CORS_ORIGINS` includes production FE origins only.
- [ ] `PROMPTPAY_MERCHANT_ID`, `PROMPTPAY_WEBHOOK_SECRET` (and Omise keys if applicable).
- [ ] Optional messaging creds: `TWILIO_*`, `LINE_CHANNEL_ACCESS_TOKEN`.
- [ ] `API_BASE_URL` points to the deployed backend (e.g. https://epic-pizza-backend.onrender.com/api).
- [ ] `HELMET_CSP=true` when CSP rollout is ready.
- [ ] `PREWARM_MENU=true` for cold-start mitigation on Render/containers.

## 2. Database
- [ ] `prisma migrate deploy` executed against production database.
- [ ] Run `npm run seed:menu` or import real menu items.
- [ ] Confirm indices exist (see `prisma/migrations/*add_menu_indexes`).

## 3. Application Hardening
- [x] Request IDs now surface via `X-Request-Id` header for tracing.
- [x] Order APIs require authentication (owner or admin) and admin-only status updates.
- [x] Optional customer email accepted during checkout for receipt delivery.

## 4. Observability & Ops
- [ ] Configure structured log sink (pino) -> e.g. Render, Datadog.
- [ ] Set up uptime / keepalive job (see `/scripts/keepalive.*`).
- [ ] Enable alerting on Prisma query errors + payment webhooks (via `webhook_event` table).

## 5. Validation Before Deploy
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Smoke test against staging API (login, create order, promptpay & card flow, webhook replay).
- [ ] Run `npm run test:all` if Windows runner available for printer scripts.
- [ ] Review `npm audit` output; ongoing moderate issues require vendor patches or compensating controls.

## 6. Post-Deploy Checks
- [ ] Hit `/api/health` expecting `{ ok: true }`.
- [ ] Confirm CSRF token endpoint works for SPA.
- [ ] Validate SSE stream `/api/orders/:id/stream` from authenticated FE client.
- [ ] Verify receipts emailed for card and PromptPay flows.

Keeping this list in source control ensures regressions and new teammates have a single reference for production readiness.
