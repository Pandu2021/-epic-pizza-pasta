# Epic Pizza & Pasta — Back-End

Secure NestJS + Prisma + PostgreSQL service with PromptPay support.

Last updated: 2025-09-19

## Table of Contents

- Quick start
- Scripts
- Security
- Environment variables
- Architecture
- Testing
- API highlights
- Deployment

## Features (Done)
- Security middleware: helmet, CORS allowlist, validation, cookies, rate limit (global + auth), CSRF (double-submit)
- JWT auth (RS256) with HttpOnly cookies; role guard for admin
- Prisma schema & client; models: User, MenuItem, Order, OrderItem, Payment, WebhookEvent
- Admin endpoints (Users/Menu/Orders) with DTO validation
- Payments: PromptPay QR & webhook (HMAC signature verification)
- Logging: pino-http (request id) + morgan
- CI workflow: install → prisma generate → build → lint → test
- Dockerfile + docker-compose
- `.env.example`

## What's new
- Login lockout: 5 failed attempts per email+IP within 15 minutes returns 429
- Structured logging via pino-http with per-request IDs (X-Request-Id)
- HSTS auto-enabled in production; CSP toggle via env (`HELMET_CSP`)
- Strong DTO validation on admin controllers (users/menu/orders)
- Auth endpoints have tighter rate limits; body size limit is configurable (`BODY_LIMIT`)
- Trust proxy enabled for correct HTTPS/IP when behind reverse proxies
- Hardened .gitignore and added complete documentation files

## Roadmap (Next)
- Refresh token rotation + revocation store
- Wider audit logging persisted to DB
- OpenAPI/Swagger docs
- Security gates in CI (npm audit/Snyk), broader tests

## Stack
- Node.js 18+, NestJS 10, TypeScript 5
- Prisma ORM, PostgreSQL 16
- Security: helmet/HSTS, CORS allowlist, ValidationPipe, express-rate-limit, CSRF, JWT (RS256), role guard, HMAC webhook verify
- CI: GitHub Actions

## Scripts
- build: compile TypeScript to `dist`
- build:prod: prisma generate + compile
- start: run built server
- start:dev: run with tsx watcher
- prisma:generate / prisma:migrate / prisma:deploy
- seed:menu: seed menu items
- test / test:watch, lint, format

## Quick start (Windows PowerShell)
1) Copy `.env.example` → `.env` and fill variables
2) Install deps: `npm ci`
3) Database & Prisma
   - Local Postgres (or use docker-compose): `docker compose up -d db`
   - Generate client: `npm run prisma:generate`
   - Apply migrations: `npm run prisma:migrate`
   - Seed menu (optional): `npm run seed:menu`
4) Run
   - Dev: `npm run start:dev`
   - Prod (after build): `npm run build`; `npm run start:prod`

API default: http://localhost:4000

## Security
- Helmet headers; enable CSP via `HELMET_CSP=true`. HSTS auto-enabled in production.
- CORS allowlist via `CORS_ORIGINS` (comma-separated). Cookies: SameSite=Lax, Secure in prod.
- CSRF flow:
  1) Client calls `GET /api/auth/csrf` (best-effort on app start)
  2) Server sets `XSRF-TOKEN` (readable) and a secret cookie (httpOnly)
  3) For non-GET requests, client sends `X-CSRF-Token` header with the token value
- Lockout: 5 failed logins/15 mins per email+IP (429 thereafter).
- Tokens: Access/refresh with RS256. Configure TTLs and cookie secret.

Required env (subset):

```
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_PRIVATE_KEY=... (escaped PEM) 
JWT_PUBLIC_KEY=... (escaped PEM)
JWT_ACCESS_TTL=900s
JWT_REFRESH_TTL=7d
COOKIE_SECRET=...
CORS_ORIGINS=http://localhost:5173
PROMPTPAY_MERCHANT_ID=...
PROMPTPAY_WEBHOOK_SECRET=...
HELMET_CSP=false
BODY_LIMIT=200kb
```

## Architecture

- Modules: auth, menu, orders, payments, contact, estimate, health, admin
- Middleware: helmet, hpp, body limits, request id + pino-http, morgan, rate limit, CSRF
- Persistence: Prisma (User, MenuItem, Order, OrderItem, Payment, WebhookEvent)
- Config: PORT, CORS_ORIGINS, COOKIE_SECRET, BODY_LIMIT, HELMET_CSP, JWT*, DATABASE_URL

Notes: HSTS auto-enabled in production; CORS allowlist enforced; CSRF double-submit pattern.

## Testing

- Tooling: Vitest (suggest add Supertest for HTTP)
- Commands:
   - npm run test
   - npm run test:watch
- Suggested tests: auth (lockout, refresh), orders (DTO, pricing), payments (QR/webhook HMAC), security (CSRF 403, rate limit)

## API highlights
- GET `/api/health`
- POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/refresh`, POST `/api/auth/logout`
- POST `/api/orders`, GET `/api/orders/:id`
- POST `/api/payments/promptpay/create`, GET `/api/payments/:orderId/status`
- POST `/api/webhooks/promptpay`

See `API-CONTRACT.md` for details.

## Deployment
Behind reverse proxy with HTTPS (HSTS). Configure env & CORS origins. See root `DEPLOYMENT.md` and `render.yaml`.

## Payments: Omise (optional, test mode)

To test card payments with Omise in dev:

- Backend `.env` (server-only):
   - `OMISE_SECRET_KEY=sk_test_...`
   - `OMISE_PUBLIC_KEY=pk_test_...` (not strictly needed server-side, but OK)
- Frontend `.env` (browser):
   - `VITE_OMISE_PUBLIC_KEY=pk_test_...`

Notes
- Keys are test-mode; do not use in production. Keep secret key out of git (already in `.gitignore`).
- After setting keys, restart backend and frontend dev servers so env vars reload.
- Webhook (if enabled) must be publicly reachable; do not apply CSRF to webhook paths.

---
Documentation consolidation: Former files (SETUP/ARCHITECTURE/TESTING/DOCUMENTATION/SUMMARY/CHECKLIST) have been merged into this README. For API details, see `API-CONTRACT.md`. For deployment, see root `DEPLOYMENT.md`.

Changelog
- 2025-09: Lockout, pino-http request IDs, HSTS in prod, admin DTO validation, CSRF flow docs.
