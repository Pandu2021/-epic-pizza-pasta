# Epic Pizza & Pasta — Back-End

This backend is a secure NestJS + Prisma + PostgreSQL service with PromptPay support.

## What’s included (Done)
- NestJS bootstrap with security middleware (helmet, CORS, validation, cookies, rate limit, CSRF)
- Prisma schema (PostgreSQL) and generated client
- Core entities: User, MenuItem, Order, OrderItem, Payment, WebhookEvent
- API routes:
  - GET `/api/health`
  - POST `/api/orders` (creates order + pending payment; returns PromptPay QR payload when paymentMethod=promptpay)
  - GET `/api/orders/:id`
  - POST `/api/payments/promptpay/create` (returns QR payload)
  - POST `/api/webhooks/promptpay` (HMAC signature check + updates payment/order)
- Utils: PromptPay QR payload builder (dev mock), webhook signature verify
- Dockerfile + docker-compose (Postgres + Redis)
- CI workflow (install → prisma generate → build → lint → test)
- .env.example with all required variables

## Not yet (Next up)
- OpenAPI/Swagger docs
- Admin endpoints (CRUD for menu/users/orders)
- Background jobs (BullMQ) for email/print/sheets
- Rate limiting and mTLS/WAF hardening
- Tests (unit/integration) coverage

## Stack
- Node.js 20, NestJS 10, TypeScript 5
- Prisma ORM, PostgreSQL 16, Redis 7
- Security: helmet, CORS allowlist, global validation, rate limiting, CSRF (double-submit), JWT auth (RS256), role guard, HMAC webhook verification
- CI: GitHub Actions
- Container: Docker

## Quick start (Windows PowerShell)
1. Copy `.env.example` to `.env` and adjust values.
2. Start infra:
   - `docker compose up -d`  (from this folder)
3. Install deps & generate Prisma client:
   - `npm ci`
   - `npm run prisma:migrate`
4. Run dev:
   - `npm run start:dev`

API will be at http://localhost:4000

PostgreSQL (Docker Compose)
- Configured via `.env` (see `.env.example`: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
- Ports are bound to localhost only: 127.0.0.1:5432
- Prisma uses `DATABASE_URL` which should match the above values

### Seed menu data (optional)
To load initial menu items into PostgreSQL:
1. Edit `prisma/seed/menu.json` as needed (copy from Front-End `src/data/menu.ts` logically).
2. Run the seed:
   - `npm run seed:menu`
This upserts items by `id` when provided.

### Security notes
- Set JWT keys and secrets in `.env` (see `.env.example`):
   - JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_ACCESS_TTL, JWT_REFRESH_TTL
   - COOKIE_SECRET, CSRF_SECRET
   - CORS_ORIGINS
- CSRF flow: client hits `GET /api/auth/csrf` to obtain `XSRF-TOKEN` cookie, then sends token in `X-CSRF-Token` header for non-GET requests.
- Auth: `POST /api/auth/login` sets HttpOnly cookies `access_token` and `refresh_token`. Use `GET /api/auth/me` to fetch the current user. `POST /api/auth/refresh` rotates access token.

## API Contract (short)
See `API-CONTRACT.md` for details.

---
Deployment
- For step-by-step cPanel deployment instructions, see the root `DEPLOYMENT.md`.
