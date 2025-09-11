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
2. Set up Docker Compose environment:
   - Copy `docker-compose.env.example` to `docker-compose.env`
   - Set secure database credentials in `docker-compose.env`
3. Start infra:
   - `docker compose --env-file docker-compose.env up -d`  (from this folder)
4. Install deps & generate Prisma client:
   - `npm ci`
   - `npm run prisma:migrate`
5. Run dev:
   - `npm run start:dev`

API will be at http://localhost:4000

PostgreSQL (Docker Compose)
- User: Set in docker-compose.env (default: pizza)
- Password: Set in docker-compose.env (secure password required)
- DB name: Set in docker-compose.env (default: epic_pizza)

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
- Database credentials: Use `docker-compose.env` for database configuration (never commit actual credentials)
- Docker production: Environment variables are injected at runtime (no .env files in production images)
- CSRF flow: client hits `GET /api/auth/csrf` to obtain `XSRF-TOKEN` cookie, then sends token in `X-CSRF-Token` header for non-GET requests.
- Auth: `POST /api/auth/login` sets HttpOnly cookies `access_token` and `refresh_token`. Use `GET /api/auth/me` to fetch the current user. `POST /api/auth/refresh` rotates access token.

### Production deployment security
- Use proper secret management (Kubernetes secrets, Docker secrets, etc.)
- Never include actual `.env` files in Docker images
- Inject environment variables at runtime
- Regular security audits and dependency updates

## API Contract (short)
See `API-CONTRACT.md` for details.
