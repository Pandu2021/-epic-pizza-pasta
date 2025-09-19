# Epic Pizza & Pasta — Back-End Documentation

Last updated: 2025-09-19

## Overview
NestJS + Prisma + PostgreSQL API with JWT auth, CSRF protection, rate limiting, DTO validation, and PromptPay integration.

## Features
- Auth: Register/Login/Logout, profile update; JWT (RS256) with HttpOnly cookies (access/refresh)
- Security: Helmet (HSTS in production), HPP, CORS allowlist, body size limits, CSRF (double-submit), rate limiting (global + auth), ValidationPipe
- Admin: Users/Menu/Orders endpoints with DTO validation and role guard
- Payments: PromptPay QR create/status and webhook signature verification
- Logging: pino-http (request id) + morgan
- Prisma models: User, MenuItem, Order, OrderItem, Payment, WebhookEvent

## Environment
- PORT, NODE_ENV
- DATABASE_URL
- JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_ACCESS_TTL, JWT_REFRESH_TTL
- COOKIE_SECRET
- CORS_ORIGINS
- PROMPTPAY_MERCHANT_ID, PROMPTPAY_WEBHOOK_SECRET
- HELMET_CSP (bool: enable CSP)
- BODY_LIMIT (default 200kb)

## Setup (Windows PowerShell)
1) Copy `.env.example` to `.env` and set values
2) Install & generate
- npm ci
- npm run prisma:migrate
3) Dev
- npm run start:dev
4) Build
- npm run build

## API Summary
- Health: GET `/api/health`
- Auth: GET `/api/auth/csrf`, POST `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/refresh`, POST `/api/auth/logout`
- Orders: POST `/api/orders`, GET `/api/orders/:id`
- Payments: POST `/api/payments/promptpay/create`, GET `/api/payments/:orderId/status`
- Webhook: POST `/api/webhooks/promptpay`
- Admin: `/api/admin/users`, `/api/admin/menu`, `/api/admin/orders`

## Security Notes
- Cookies: HttpOnly, SameSite=Lax, Secure in production
- CSRF: `GET /api/auth/csrf` → set `XSRF-TOKEN` cookie; send in `X-CSRF-Token` header on non-GET
- Login lockout: 5 fails/15min per email+IP
- CSP: enable via `HELMET_CSP=true` after verifying allowed sources
- Behind proxy: `app.set('trust proxy', 1)`

## Development Tips
- Use `scripts/generate-jwt-keys.js` to generate RS256 keys (paste escaped keys into env)
- Seed menu: `npm run seed:menu`

## Roadmap
- Refresh token rotation + revocation (DB-backed)
- Persisted audit logs for admin operations
- Swagger/OpenAPI docs
- Security checks in CI (npm audit/Snyk); add e2e tests

See also: README.md, SETUP.md, ARCHITECTURE.md, TESTING.md, API-CONTRACT.md
